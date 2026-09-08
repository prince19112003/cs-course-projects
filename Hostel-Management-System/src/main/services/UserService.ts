import { UserRepository, UserSearchParams } from '../database/repositories/UserRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { RoleRepository } from '../database/repositories/RoleRepository.js';
import { User } from '../database/schema/users.js';
import { hashPassword, validatePasswordRequirements } from '../utils/password.js';
import { SessionManager } from './SessionManager.js';
import { generateEntityId } from '../database/utils/id-generator.js';

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: string;
  password?: string;
  hostelIds?: string[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  hostelIds?: string[];
}

export class UserService {
  /**
   * Creates a new administrative or staff operator.
   */
  static async createUser(sessionToken: string, data: CreateUserInput, workstation = 'localhost'): Promise<Omit<User, 'passwordHash'>> {
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
      throw new Error('UNAUTHENTICATED: No active session.');
    }

    const hasPerm = session.permissions.includes('*') || session.permissions.includes('users:manage');
    if (!hasPerm) {
      throw new Error('FORBIDDEN: You do not have permission to create users.');
    }

    // Privilege Escalation Guard: Cannot create a user with a higher role than own
    if (data.role === 'super_admin' && session.role !== 'super_admin') {
      throw new Error('FORBIDDEN_PRIVILEGE_ESCALATION: Only Super Administrators can create Super Administrator accounts.');
    }

    // Validate role exists
    const roleRecord = await RoleRepository.getRoleById(data.role);
    if (!roleRecord) {
      throw new Error(`INVALID_ROLE: Role '${data.role}' is not recognized in the system.`);
    }

    // Validate duplicates
    const existingEmail = await UserRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new Error(`DUPLICATE_EMAIL: A user with email '${data.email}' already exists.`);
    }

    const existingPhone = await UserRepository.findByPhone(data.phone);
    if (existingPhone) {
      throw new Error(`DUPLICATE_PHONE: A user with phone '${data.phone}' already exists.`);
    }

    // Temporary password generation if not provided
    const rawPassword = data.password || `Nexus@${Math.floor(100000 + Math.random() * 900000)}`;
    const passVal = validatePasswordRequirements(rawPassword);
    if (!passVal.valid) {
      throw new Error(`INVALID_PASSWORD: ${passVal.error}`);
    }

    const passwordHash = await hashPassword(rawPassword);
    const userId = generateEntityId('USR');
    const now = Date.now();

    const created = await UserRepository.create({
      id: userId,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
      passwordHash,
      role: data.role,
      isActive: 1,
      forcePasswordChange: 1, // Must change temp password on first login
      createdAt: now,
      updatedAt: now,
    });

    if (data.hostelIds && data.hostelIds.length > 0) {
      await UserRepository.assignHostels(userId, data.hostelIds);
    }

    await AuditRepository.log({
      userId: session.userId,
      userRole: session.role,
      action: 'USER_CREATED',
      entityType: 'users',
      entityId: userId,
      changesSummary: JSON.stringify({ name: created.name, email: created.email, role: created.role }),
      ipHostname: workstation,
    });

    const { passwordHash: _, ...safeUser } = created;
    return safeUser;
  }

  /**
   * Updates an existing operator's profile, role, or hostel assignments.
   */
  static async updateUser(
    sessionToken: string,
    targetUserId: string,
    updates: UpdateUserInput,
    workstation = 'localhost'
  ): Promise<Omit<User, 'passwordHash'>> {
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
      throw new Error('UNAUTHENTICATED: No active session.');
    }

    const hasPerm = session.permissions.includes('*') || session.permissions.includes('users:manage');
    if (!hasPerm) {
      throw new Error('FORBIDDEN: You do not have permission to update users.');
    }

    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error(`USER_NOT_FOUND: User '${targetUserId}' not found.`);
    }

    // Privilege escalation guard
    if (targetUser.role === 'super_admin' && session.role !== 'super_admin') {
      throw new Error('FORBIDDEN_PRIVILEGE_ESCALATION: Cannot modify a Super Administrator account.');
    }

    if (updates.role && updates.role === 'super_admin' && session.role !== 'super_admin') {
      throw new Error('FORBIDDEN_PRIVILEGE_ESCALATION: Only Super Administrators can promote users to Super Administrator.');
    }

    // Cannot modify own role
    if (session.userId === targetUserId && updates.role && updates.role !== targetUser.role) {
      throw new Error('FORBIDDEN_SELF_MODIFICATION: You cannot change your own role.');
    }

    // Check email / phone conflict
    if (updates.email && updates.email.toLowerCase().trim() !== targetUser.email) {
      const conflict = await UserRepository.findByEmail(updates.email);
      if (conflict && conflict.id !== targetUserId) {
        throw new Error(`DUPLICATE_EMAIL: Email '${updates.email}' is already in use.`);
      }
    }

    if (updates.phone && updates.phone.trim() !== targetUser.phone) {
      const conflict = await UserRepository.findByPhone(updates.phone);
      if (conflict && conflict.id !== targetUserId) {
        throw new Error(`DUPLICATE_PHONE: Phone '${updates.phone}' is already in use.`);
      }
    }

    const updated = await UserRepository.update(targetUserId, {
      name: updates.name ? updates.name.trim() : undefined,
      email: updates.email ? updates.email.toLowerCase().trim() : undefined,
      phone: updates.phone ? updates.phone.trim() : undefined,
      role: updates.role,
    });

    if (updates.hostelIds) {
      await UserRepository.assignHostels(targetUserId, updates.hostelIds);
    }

    await AuditRepository.log({
      userId: session.userId,
      userRole: session.role,
      action: 'USER_UPDATED',
      entityType: 'users',
      entityId: targetUserId,
      changesSummary: JSON.stringify({ updates }),
      ipHostname: workstation,
    });

    const { passwordHash: _, ...safeUser } = updated!;
    return safeUser;
  }

  /**
   * Activates or deactivates an operator account. Immediately invalidates sessions if deactivated.
   */
  static async toggleUserStatus(
    sessionToken: string,
    targetUserId: string,
    isActive: boolean,
    workstation = 'localhost'
  ): Promise<boolean> {
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
      throw new Error('UNAUTHENTICATED: No active session.');
    }

    const hasPerm = session.permissions.includes('*') || session.permissions.includes('users:manage');
    if (!hasPerm) {
      throw new Error('FORBIDDEN: You do not have permission to change user status.');
    }

    // Cannot disable own account
    if (session.userId === targetUserId && !isActive) {
      throw new Error('FORBIDDEN_SELF_MODIFICATION: You cannot deactivate your own administrative account.');
    }

    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error(`USER_NOT_FOUND: User '${targetUserId}' not found.`);
    }

    // Cannot deactivate last active super admin
    if (targetUser.role === 'super_admin' && !isActive) {
      const activeSuperCount = await UserRepository.countActiveSuperAdmins();
      if (activeSuperCount <= 1) {
        throw new Error('FORBIDDEN_LAST_ADMIN: Cannot deactivate the only active Super Administrator in the system.');
      }
    }

    await UserRepository.toggleStatus(targetUserId, isActive ? 1 : 0);

    // If deactivated, immediately terminate active sessions
    if (!isActive) {
      SessionManager.destroySessionsForUser(targetUserId);
    }

    await AuditRepository.log({
      userId: session.userId,
      userRole: session.role,
      action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      entityType: 'users',
      entityId: targetUserId,
      changesSummary: JSON.stringify({ target: targetUser.email, newStatus: isActive ? 'active' : 'suspended' }),
      ipHostname: workstation,
    });

    return true;
  }

  /**
   * Returns a paginated list of users with passwordHash stripped.
   */
  static async getUsers(
    sessionToken: string,
    params: UserSearchParams = {}
  ): Promise<{ data: Array<Omit<User, 'passwordHash'>>; total: number }> {
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
      throw new Error('UNAUTHENTICATED: No active session.');
    }

    const hasPerm =
      session.permissions.includes('*') ||
      session.permissions.includes('users:view') ||
      session.permissions.includes('users:manage');

    if (!hasPerm) {
      throw new Error('FORBIDDEN: You do not have permission to view users.');
    }

    const result = await UserRepository.getPaginated(params);
    const safeData = result.data.map(({ passwordHash: _, ...safe }) => safe);

    return {
      data: safeData,
      total: result.total,
    };
  }
}
