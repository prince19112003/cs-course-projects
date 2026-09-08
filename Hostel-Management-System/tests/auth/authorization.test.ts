import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../../src/main/database/connection.js';
import { AuthService } from '../../src/main/services/AuthService.js';
import { UserService } from '../../src/main/services/UserService.js';
import { SessionManager } from '../../src/main/services/SessionManager.js';
import { AuditRepository } from '../../src/main/database/repositories/AuditRepository.js';
import { requireAuth, requirePermission } from '../../src/main/ipc/guard.js';

describe('Service-Level Authorization & RBAC Middleware Guards', () => {
  let superAdminToken: string;
  let wardenToken: string;

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });
    SessionManager.clearAll();

    // 1. Setup Super Admin
    const setup = await AuthService.completeFirstTimeSetup({
      institutionName: 'Campus Alpha',
      name: 'Super Director',
      email: 'director@campus.edu',
      phone: '9900000001',
      password: 'Admin#Master2026',
    });
    superAdminToken = setup.token;

    // 2. Create Warden
    const wardenUser = await UserService.createUser(superAdminToken, {
      name: 'Warden Jane',
      email: 'jane.warden@campus.edu',
      phone: '9900000002',
      role: 'warden',
      password: 'Warden#Pass2026',
    });

    const wardenLogin = await AuthService.login('jane.warden@campus.edu', 'Warden#Pass2026');
    wardenToken = wardenLogin.token;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('rejects unauthenticated IPC requests with UNAUTHENTICATED error', async () => {
    const protectedAction = requireAuth(async (_session) => {
      return { success: true, data: 'secure_data' };
    });

    // Call with empty token
    const res1 = await protectedAction({} as any, '');
    expect(res1.success).toBe(false);
    expect(res1.error?.code).toBe('UNAUTHENTICATED');

    // Call with invalid/forged token
    const res2 = await protectedAction({} as any, 'non_existent_token_12345');
    expect(res2.success).toBe(false);
    expect(res2.error?.code).toBe('UNAUTHENTICATED');
  });

  it('allows Super Admin wildcard (*) to execute any permission-guarded action', async () => {
    const backupAction = requirePermission('backup:create', async (_session) => {
      return { success: true, data: 'backup_created' };
    });

    const res = await backupAction({} as any, superAdminToken);
    expect(res.success).toBe(true);
    expect(res.data).toBe('backup_created');
  });

  it('allows operator with matching permission and rejects mismatched permission with FORBIDDEN', async () => {
    // Action requiring allocations:manage (Warden has this permission)
    const allocateAction = requirePermission('allocations:manage', async (_session) => {
      return { success: true, data: 'bed_allocated' };
    });

    const resWarden = await allocateAction({} as any, wardenToken);
    expect(resWarden.success).toBe(true);
    expect(resWarden.data).toBe('bed_allocated');

    // Action requiring backup:restore (Warden does NOT have this permission)
    const restoreAction = requirePermission('backup:restore', async (_session) => {
      return { success: true, data: 'restored' };
    });

    const resForbidden = await restoreAction({} as any, wardenToken);
    expect(resForbidden.success).toBe(false);
    expect(resForbidden.error?.code).toBe('FORBIDDEN');
    expect(resForbidden.error?.message).toContain("requires permission 'backup:restore'");

    // Verify audit log captured the security violation attempt
    const recentAudits = await AuditRepository.getRecent(10);
    const violation = recentAudits.find((a) => a.action === 'UNAUTHORIZED_ACCESS_ATTEMPT');
    expect(violation).toBeDefined();
  });

  it('enforces privilege escalation defense: warden cannot create a super_admin', async () => {
    await expect(
      UserService.createUser(wardenToken, {
        name: 'Sneaky User',
        email: 'sneaky@campus.edu',
        phone: '9900000003',
        role: 'super_admin', // Escalation!
        password: 'Password123!',
      })
    ).rejects.toThrow('FORBIDDEN');
  });
});
