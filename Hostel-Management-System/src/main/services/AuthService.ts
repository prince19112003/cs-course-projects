import { UserRepository } from '../database/repositories/UserRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { InfrastructureRepository } from '../database/repositories/InfrastructureRepository.js';
import { getDb, persistDatabase } from '../database/connection.js';
import { institutions } from '../database/schema/institutions.js';
import { hashPassword, verifyPassword, validatePasswordRequirements } from '../utils/password.js';
import { RateLimiter } from './RateLimiter.js';
import { SessionManager, SanitizedSessionUser } from './SessionManager.js';
import { eq } from 'drizzle-orm';

export interface SetupInput {
  institutionName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: SanitizedSessionUser;
}

export class AuthService {
  /**
   * Detects whether the application requires First-Time Setup Wizard.
   */
  static async checkSetupStatus(): Promise<{ setupNeeded: boolean }> {
    const adminCount = await UserRepository.countActiveSuperAdmins();
    return { setupNeeded: adminCount === 0 };
  }

  /**
   * Executes initial First-Time Setup, creating the master Super Admin USR-0001.
   */
  static async completeFirstTimeSetup(data: SetupInput, workstation = 'localhost'): Promise<LoginResult> {
    const adminCount = await UserRepository.countActiveSuperAdmins();
    if (adminCount > 0) {
      throw new Error('SETUP_ALREADY_COMPLETED: A Super Administrator is already configured.');
    }

    // Validate password complexity
    const passVal = validatePasswordRequirements(data.password);
    if (!passVal.valid) {
      throw new Error(`INVALID_PASSWORD: ${passVal.error}`);
    }

    if (!data.name || !data.email || !data.phone) {
      throw new Error('MISSING_FIELDS: All setup fields are required.');
    }

    const now = Date.now();
    const passwordHash = await hashPassword(data.password);

    // Update institution name if exists, or create
    const db = getDb();
    const instList = await db.select().from(institutions).limit(1);
    if (instList.length > 0) {
      await db
        .update(institutions)
        .set({ name: data.institutionName.trim(), updatedAt: now })
        .where(eq(institutions.id, instList[0].id));
    } else {
      await db.insert(institutions).values({
        id: 'INST-0001',
        name: data.institutionName.trim(),
        code: 'MAIN',
        address: 'Main Campus, Tech Enclave',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Check if USR-0001 exists
    const existing = await UserRepository.findById('USR-0001');
    let user;
    if (existing) {
      user = await UserRepository.update('USR-0001', {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone.trim(),
        passwordHash,
        role: 'super_admin',
        isActive: 1,
        forcePasswordChange: 0,
      });
    } else {
      user = await UserRepository.create({
        id: 'USR-0001',
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone.trim(),
        passwordHash,
        role: 'super_admin',
        isActive: 1,
        forcePasswordChange: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    persistDatabase();

    // Log setup to audit
    await AuditRepository.log({
      userId: user!.id,
      userRole: 'super_admin',
      action: 'AUTH_INITIAL_SETUP_COMPLETED',
      entityType: 'users',
      entityId: user!.id,
      changesSummary: JSON.stringify({ institution: data.institutionName, email: user!.email }),
      ipHostname: workstation,
    });

    // Create session
    const { session, token } = SessionManager.createSession({
      userId: user!.id,
      name: user!.name,
      email: user!.email,
      role: 'super_admin',
      assignedHostelIds: ['ALL'],
      permissions: ['*'],
      forcePasswordChange: false,
    });

    return {
      token,
      user: SessionManager.sanitize(session),
    };
  }

  /**
   * Authenticates user with identifier (email or phone) and password.
   */
  static async login(identifier: string, password: string, workstation = 'localhost'): Promise<LoginResult> {
    const cleanId = identifier.trim();

    // 1. Rate limiting check
    const rateStatus = RateLimiter.checkRateLimit(cleanId);
    if (!rateStatus.allowed) {
      throw new Error(`RATE_LIMIT_EXCEEDED: ${rateStatus.reason}`);
    }

    // 2. Query user
    const user = await UserRepository.findByIdentifier(cleanId);
    if (!user) {
      const failInfo = RateLimiter.recordFailure(cleanId);
      await AuditRepository.log({
        userId: 'SYSTEM',
        userRole: 'anonymous',
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'users',
        changesSummary: JSON.stringify({ identifier: cleanId, reason: 'User not found', failures: failInfo.failures }),
        ipHostname: workstation,
      });
      throw new Error('INVALID_CREDENTIALS: Email/phone or password incorrect.');
    }

    // 3. Verify password
    const match = await verifyPassword(password, user.passwordHash);
    if (!match) {
      const failInfo = RateLimiter.recordFailure(cleanId);
      if (failInfo.locked) {
        await AuditRepository.log({
          userId: user.id,
          userRole: user.role,
          action: 'AUTH_ACCOUNT_LOCKED',
          entityType: 'users',
          entityId: user.id,
          changesSummary: JSON.stringify({ consecutiveFailures: failInfo.failures }),
          ipHostname: workstation,
        });
      } else {
        await AuditRepository.log({
          userId: user.id,
          userRole: user.role,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'users',
          entityId: user.id,
          changesSummary: JSON.stringify({ consecutiveFailures: failInfo.failures }),
          ipHostname: workstation,
        });
      }
      throw new Error('INVALID_CREDENTIALS: Email/phone or password incorrect.');
    }

    // 4. Verify user status
    if (user.isActive !== 1) {
      throw new Error('ACCOUNT_SUSPENDED: This user account is disabled. Contact your administrator.');
    }

    // 5. Successful login
    RateLimiter.reset(cleanId);
    await UserRepository.updateLastLogin(user.id);

    // Fetch full permissions and assigned hostels
    const userDetails = await UserRepository.getUserWithRoleAndPermissions(user.id);
    const permissions = userDetails?.permissions || [];
    const assignedHostels = userDetails?.assignedHostels || [];

    const { session, token } = SessionManager.createSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedHostelIds: assignedHostels.length > 0 ? assignedHostels : ['ALL'],
      permissions,
      forcePasswordChange: Boolean(user.forcePasswordChange),
    });

    await AuditRepository.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'users',
      entityId: user.id,
      ipHostname: workstation,
    });

    return {
      token,
      user: SessionManager.sanitize(session),
    };
  }

  /**
   * Logs out user and destroys the session.
   */
  static async logout(sessionToken: string, workstation = 'localhost'): Promise<void> {
    const session = SessionManager.getSession(sessionToken);
    if (session) {
      SessionManager.destroySession(sessionToken);
      await AuditRepository.log({
        userId: session.userId,
        userRole: session.role,
        action: 'AUTH_LOGOUT',
        entityType: 'users',
        entityId: session.userId,
        ipHostname: workstation,
      });
    }
  }

  /**
   * Changes current operator's password after verifying existing password.
   */
  static async changePassword(
    sessionToken: string,
    currentPassword: string,
    newPassword: string,
    workstation = 'localhost'
  ): Promise<void> {
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
      throw new Error('UNAUTHENTICATED: No active session found.');
    }

    const user = await UserRepository.findById(session.userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND: User account does not exist.');
    }

    const match = await verifyPassword(currentPassword, user.passwordHash);
    if (!match) {
      throw new Error('INVALID_CURRENT_PASSWORD: The current password you entered is incorrect.');
    }

    const passVal = validatePasswordRequirements(newPassword);
    if (!passVal.valid) {
      throw new Error(`INVALID_PASSWORD: ${passVal.error}`);
    }

    const newHash = await hashPassword(newPassword);
    await UserRepository.updatePasswordHash(user.id, newHash, false);

    // Update session state
    session.forcePasswordChange = false;

    await AuditRepository.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_PASSWORD_CHANGED',
      entityType: 'users',
      entityId: user.id,
      ipHostname: workstation,
    });
  }

  /**
   * Secondary password confirmation guard & administrative password reset.
   */
  static async resetUserPassword(
    adminSessionToken: string,
    targetUserId: string,
    newPassword: string,
    adminConfirmationPassword: string,
    workstation = 'localhost'
  ): Promise<void> {
    const adminSession = SessionManager.getSession(adminSessionToken);
    if (!adminSession) {
      throw new Error('UNAUTHENTICATED: No active session found.');
    }

    // Check permission
    const hasPerm = adminSession.permissions.includes('*') || adminSession.permissions.includes('users:manage');
    if (!hasPerm) {
      throw new Error('FORBIDDEN: You do not have permission to reset user passwords.');
    }

    // Secondary password re-authentication for high-risk operation
    const adminUser = await UserRepository.findById(adminSession.userId);
    if (!adminUser) {
      throw new Error('ADMIN_NOT_FOUND: Admin user not found.');
    }

    const adminMatch = await verifyPassword(adminConfirmationPassword, adminUser.passwordHash);
    if (!adminMatch) {
      await AuditRepository.log({
        userId: adminSession.userId,
        userRole: adminSession.role,
        action: 'HIGH_RISK_REAUTH_FAILED',
        entityType: 'users',
        entityId: targetUserId,
        changesSummary: JSON.stringify({ attemptedAction: 'PASSWORD_RESET' }),
        ipHostname: workstation,
      });
      throw new Error('INVALID_ADMIN_PASSWORD: Secondary administrator confirmation password is incorrect.');
    }

    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error(`USER_NOT_FOUND: User ${targetUserId} does not exist.`);
    }

    // Privilege escalation guard: A standard admin cannot reset a super_admin's password
    if (targetUser.role === 'super_admin' && adminSession.role !== 'super_admin') {
      throw new Error('FORBIDDEN_PRIVILEGE_ESCALATION: Only a Super Administrator can reset a Super Administrator password.');
    }

    const passVal = validatePasswordRequirements(newPassword);
    if (!passVal.valid) {
      throw new Error(`INVALID_PASSWORD: ${passVal.error}`);
    }

    const newHash = await hashPassword(newPassword);
    // Flag forcePasswordChange so the user is forced to change it on next login
    await UserRepository.updatePasswordHash(targetUserId, newHash, true);

    // Invalidate any active sessions for the target user
    SessionManager.destroySessionsForUser(targetUserId);

    await AuditRepository.log({
      userId: adminSession.userId,
      userRole: adminSession.role,
      action: 'AUTH_PASSWORD_RESET',
      entityType: 'users',
      entityId: targetUserId,
      changesSummary: JSON.stringify({ targetUser: targetUser.email, forcedChange: true }),
      ipHostname: workstation,
    });
  }
}
