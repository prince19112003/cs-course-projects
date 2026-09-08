import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { AuthService } from '../../src/main/services/AuthService.js';
import { UserRepository } from '../../src/main/database/repositories/UserRepository.js';
import { AuditRepository } from '../../src/main/database/repositories/AuditRepository.js';
import { RateLimiter } from '../../src/main/services/RateLimiter.js';
import { SessionManager } from '../../src/main/services/SessionManager.js';
import { users } from '../../src/main/database/schema/users.js';
import { hashPassword } from '../../src/main/utils/password.js';

describe('AuthService Operations & Offline Workflows', () => {
  beforeEach(() => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });
    RateLimiter.clearAll();
    SessionManager.clearAll();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('completes First-Time Setup Wizard and rejects duplicate setup attempts', async () => {
    // 1. Initially check setup needed
    const status1 = await AuthService.checkSetupStatus();
    expect(status1.setupNeeded).toBe(true);

    // 2. Complete setup
    const setupResult = await AuthService.completeFirstTimeSetup({
      institutionName: 'National Tech Campus',
      name: 'Dr. Sarah Connor',
      email: 'chief.warden@ntc.edu',
      phone: '9988776655',
      password: 'Master@Secure2026',
    });

    expect(setupResult.token).toBeDefined();
    expect(setupResult.user.userId).toBe('USR-0001');
    expect(setupResult.user.role).toBe('super_admin');
    expect(setupResult.user.permissions).toContain('*');

    // 3. Setup should no longer be needed
    const status2 = await AuthService.checkSetupStatus();
    expect(status2.setupNeeded).toBe(false);

    // 4. Duplicate setup must throw error
    await expect(
      AuthService.completeFirstTimeSetup({
        institutionName: 'Another Campus',
        name: 'Attacker',
        email: 'attacker@evil.local',
        phone: '1111111111',
        password: 'Attack@Pass123',
      })
    ).rejects.toThrow('SETUP_ALREADY_COMPLETED');
  });

  it('authenticates valid credentials and rejects incorrect passwords', async () => {
    // Seed initial admin
    const setup = await AuthService.completeFirstTimeSetup({
      institutionName: 'Test Campus',
      name: 'Admin User',
      email: 'admin@test.local',
      phone: '9876543210',
      password: 'Strong#Admin123',
    });

    // Login with valid email
    const loginEmail = await AuthService.login('admin@test.local', 'Strong#Admin123');
    expect(loginEmail.token).toBeDefined();
    expect(loginEmail.user.name).toBe('Admin User');

    // Login with valid phone
    const loginPhone = await AuthService.login('9876543210', 'Strong#Admin123');
    expect(loginPhone.token).toBeDefined();

    // Login with wrong password
    await expect(AuthService.login('admin@test.local', 'Wrong#Password999')).rejects.toThrow('INVALID_CREDENTIALS');

    // Login with non-existent identifier
    await expect(AuthService.login('ghost@test.local', 'SomePassword123!')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('rejects suspended accounts with ACCOUNT_SUSPENDED', async () => {
    const setup = await AuthService.completeFirstTimeSetup({
      institutionName: 'Test Campus',
      name: 'Admin',
      email: 'admin@test.local',
      phone: '1234567890',
      password: 'Admin#Pass123',
    });

    // Create a staff user and suspend them
    const now = Date.now();
    const passHash = await hashPassword('Staff@Pass123');
    await UserRepository.create({
      id: 'USR-STAFF-01',
      name: 'John Staff',
      email: 'john@test.local',
      phone: '5555555555',
      passwordHash: passHash,
      role: 'staff',
      isActive: 0, // Suspended
      forcePasswordChange: 0,
      createdAt: now,
      updatedAt: now,
    });

    await expect(AuthService.login('john@test.local', 'Staff@Pass123')).rejects.toThrow('ACCOUNT_SUSPENDED');
  });

  it('allows user to change their password and records audit entry', async () => {
    const setup = await AuthService.completeFirstTimeSetup({
      institutionName: 'Test Campus',
      name: 'Admin',
      email: 'admin@test.local',
      phone: '1234567890',
      password: 'Old#Password123',
    });

    // Change password with wrong current password should fail
    await expect(
      AuthService.changePassword(setup.token, 'WrongOldPass!', 'New#StrongPass456')
    ).rejects.toThrow('INVALID_CURRENT_PASSWORD');

    // Change password with weak new password should fail
    await expect(
      AuthService.changePassword(setup.token, 'Old#Password123', 'short')
    ).rejects.toThrow('INVALID_PASSWORD');

    // Successful change
    await AuthService.changePassword(setup.token, 'Old#Password123', 'New#StrongPass456');

    // Old password should now fail
    await expect(AuthService.login('admin@test.local', 'Old#Password123')).rejects.toThrow('INVALID_CREDENTIALS');

    // New password should succeed
    const newLogin = await AuthService.login('admin@test.local', 'New#StrongPass456');
    expect(newLogin.token).toBeDefined();

    // Verify audit record exists
    const recentAudits = await AuditRepository.getRecent(10);
    const passAudit = recentAudits.find((a) => a.action === 'AUTH_PASSWORD_CHANGED');
    expect(passAudit).toBeDefined();
  });

  it('allows authorized administrator to reset another user password with secondary re-authentication', async () => {
    const adminSetup = await AuthService.completeFirstTimeSetup({
      institutionName: 'Test Campus',
      name: 'Admin Boss',
      email: 'boss@test.local',
      phone: '9999999999',
      password: 'Boss#Master123',
    });

    // Create a warden user
    const now = Date.now();
    const passHash = await hashPassword('Old#WardenPass1');
    const warden = await UserRepository.create({
      id: 'USR-WARDEN-01',
      name: 'Warden Bob',
      email: 'bob@test.local',
      phone: '8888888888',
      passwordHash: passHash,
      role: 'warden',
      isActive: 1,
      forcePasswordChange: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Login warden to create active session
    const wardenLogin = await AuthService.login('bob@test.local', 'Old#WardenPass1');
    expect(SessionManager.getSession(wardenLogin.token)).not.toBeNull();

    // Reset with wrong admin confirmation password should fail
    await expect(
      AuthService.resetUserPassword(
        adminSetup.token,
        warden.id,
        'New#WardenPass2',
        'WrongAdminConfirmation!'
      )
    ).rejects.toThrow('INVALID_ADMIN_PASSWORD');

    // Reset with correct admin confirmation password succeeds
    await AuthService.resetUserPassword(
      adminSetup.token,
      warden.id,
      'New#WardenPass2',
      'Boss#Master123'
    );

    // Warden's previous session must be terminated immediately
    expect(SessionManager.getSession(wardenLogin.token)).toBeNull();

    // Warden logs in with new password and forcePasswordChange is true
    const newWardenLogin = await AuthService.login('bob@test.local', 'New#WardenPass2');
    expect(newWardenLogin.token).toBeDefined();
    expect(newWardenLogin.user.forcePasswordChange).toBe(true);

    // Verify audit record exists
    const recentAudits = await AuditRepository.getRecent(10);
    const resetAudit = recentAudits.find((a) => a.action === 'AUTH_PASSWORD_RESET');
    expect(resetAudit).toBeDefined();
    expect(resetAudit?.entityId).toBe(warden.id);
  });
});
