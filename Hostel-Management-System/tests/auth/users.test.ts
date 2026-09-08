import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../../src/main/database/connection.js';
import { AuthService } from '../../src/main/services/AuthService.js';
import { UserService } from '../../src/main/services/UserService.js';
import { SessionManager } from '../../src/main/services/SessionManager.js';
import { UserRepository } from '../../src/main/database/repositories/UserRepository.js';

describe('UserService Administration & Integrity Constraints', () => {
  let adminToken: string;

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });
    SessionManager.clearAll();

    const setup = await AuthService.completeFirstTimeSetup({
      institutionName: 'Alpha Academy',
      name: 'System Admin',
      email: 'admin@alpha.edu',
      phone: '9876543210',
      password: 'Admin#Password2026',
    });
    adminToken = setup.token;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates user with auto-generated ID, hashed password, and retrieves in paginated list', async () => {
    const user = await UserService.createUser(adminToken, {
      name: 'Caretaker Jim',
      email: 'jim@alpha.edu',
      phone: '9123456780',
      role: 'staff',
      password: 'Jim#Staff2026',
    });

    expect(user.id.startsWith('USR-')).toBe(true);
    expect(user.name).toBe('Caretaker Jim');
    expect(user.role).toBe('staff');
    expect(user.isActive).toBe(1);

    // Verify in paginated list
    const list = await UserService.getUsers(adminToken, { query: 'Jim' });
    expect(list.total).toBe(1);
    expect(list.data[0].id).toBe(user.id);
  });

  it('rejects duplicate email or phone during user creation', async () => {
    await UserService.createUser(adminToken, {
      name: 'Warden Amy',
      email: 'amy@alpha.edu',
      phone: '9000000001',
      role: 'warden',
      password: 'Password123#',
    });

    // Duplicate email
    await expect(
      UserService.createUser(adminToken, {
        name: 'Amy Duplicate',
        email: 'amy@alpha.edu',
        phone: '9000000002',
        role: 'warden',
        password: 'Password123#',
      })
    ).rejects.toThrow('DUPLICATE_EMAIL');

    // Duplicate phone
    await expect(
      UserService.createUser(adminToken, {
        name: 'Another User',
        email: 'other@alpha.edu',
        phone: '9000000001',
        role: 'warden',
        password: 'Password123#',
      })
    ).rejects.toThrow('DUPLICATE_PHONE');
  });

  it('prevents user from modifying their own role', async () => {
    // Admin attempts to change own role to viewer
    await expect(
      UserService.updateUser(adminToken, 'USR-0001', {
        role: 'viewer',
      })
    ).rejects.toThrow('FORBIDDEN_SELF_MODIFICATION');
  });

  it('prevents administrator from deactivating their own account', async () => {
    await expect(
      UserService.toggleUserStatus(adminToken, 'USR-0001', false)
    ).rejects.toThrow('FORBIDDEN_SELF_MODIFICATION');
  });

  it('prevents deactivating the only active Super Administrator', async () => {
    // Create secondary admin
    const secondUser = await UserService.createUser(adminToken, {
      name: 'Admin Two',
      email: 'admintwo@alpha.edu',
      phone: '9000000099',
      role: 'admin',
      password: 'Password123#',
    });

    const secondLogin = await AuthService.login('admintwo@alpha.edu', 'Password123#');

    // Attempting to deactivate USR-0001 (the only super_admin) from another admin
    await expect(
      UserService.toggleUserStatus(secondLogin.token, 'USR-0001', false)
    ).rejects.toThrow('FORBIDDEN');
  });
});
