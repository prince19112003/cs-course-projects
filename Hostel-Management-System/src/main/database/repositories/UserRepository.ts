import { eq, or, like, and, count, desc } from 'drizzle-orm';
import { getDb, persistDatabase } from '../connection.js';
import { users, User, NewUser } from '../schema/users.js';
import { rolePermissions } from '../schema/roles.js';
import { userHostels } from '../schema/roles.js';

export interface UserSearchParams {
  query?: string;
  role?: string;
  status?: 'active' | 'suspended' | 'all';
  limit?: number;
  offset?: number;
}

export class UserRepository {
  static async findById(id: string): Promise<User | null> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return rows[0] || null;
  }

  static async findByPhone(phone: string): Promise<User | null> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.phone, phone.trim())).limit(1);
    return rows[0] || null;
  }

  static async findByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.trim();
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.email, clean.toLowerCase()), eq(users.phone, clean)))
      .limit(1);
    return rows[0] || null;
  }

  static async countActiveSuperAdmins(): Promise<number> {
    const db = getDb();
    const result = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'super_admin'), eq(users.isActive, 1)));
    return result[0]?.value || 0;
  }

  static async count(): Promise<number> {
    const db = getDb();
    const result = await db.select({ value: count() }).from(users);
    return result[0]?.value || 0;
  }

  static async getPaginated(params: UserSearchParams = {}): Promise<{ data: User[]; total: number }> {
    const db = getDb();
    const { query, role, status, limit = 50, offset = 0 } = params;

    const conditions = [];

    if (role && role !== 'all') {
      conditions.push(eq(users.role, role));
    }

    if (status && status !== 'all') {
      const activeInt = status === 'active' ? 1 : 0;
      conditions.push(eq(users.isActive, activeInt));
    }

    if (query && query.trim().length > 0) {
      const q = `%${query.trim()}%`;
      conditions.push(
        or(
          like(users.name, q),
          like(users.email, q),
          like(users.phone, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(users)
        .where(whereClause),
    ]);

    return {
      data,
      total: totalResult[0]?.value || 0,
    };
  }

  static async create(data: NewUser): Promise<User> {
    const db = getDb();
    await db.insert(users).values({
      ...data,
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
    });
    persistDatabase();
    const created = await this.findById(data.id);
    return created!;
  }

  static async update(id: string, updates: Partial<NewUser>): Promise<User | null> {
    const db = getDb();
    const now = Date.now();
    await db
      .update(users)
      .set({ ...updates, updatedAt: now })
      .where(eq(users.id, id));
    persistDatabase();
    return this.findById(id);
  }

  static async updatePasswordHash(id: string, passwordHash: string, forcePasswordChange = false): Promise<boolean> {
    const db = getDb();
    const now = Date.now();
    await db
      .update(users)
      .set({
        passwordHash,
        forcePasswordChange: forcePasswordChange ? 1 : 0,
        updatedAt: now,
      })
      .where(eq(users.id, id));
    persistDatabase();
    return true;
  }

  static async toggleStatus(id: string, isActive: number): Promise<boolean> {
    const db = getDb();
    const now = Date.now();
    await db
      .update(users)
      .set({ isActive, updatedAt: now })
      .where(eq(users.id, id));
    persistDatabase();
    return true;
  }

  static async updateLastLogin(id: string): Promise<void> {
    const db = getDb();
    await db.update(users).set({ lastLoginAt: Date.now() }).where(eq(users.id, id));
    persistDatabase();
  }

  static async getUserWithRoleAndPermissions(id: string): Promise<{
    user: User;
    permissions: string[];
    assignedHostels: string[];
  } | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const db = getDb();

    // Fetch permissions mapped to the user's role
    const permRows = await db
      .select({ permissionCode: rolePermissions.permissionCode })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, user.role));

    const permissions = permRows.map((r) => r.permissionCode);

    // If super_admin, guarantee wildcard
    if (user.role === 'super_admin' && !permissions.includes('*')) {
      permissions.push('*');
    }

    // Fetch assigned hostels
    const hostelRows = await db
      .select({ hostelId: userHostels.hostelId })
      .from(userHostels)
      .where(eq(userHostels.userId, user.id));

    const assignedHostels = hostelRows.map((r) => r.hostelId);

    return {
      user,
      permissions,
      assignedHostels,
    };
  }

  static async assignHostels(userId: string, hostelIds: string[]): Promise<void> {
    const db = getDb();
    const now = Date.now();

    // Delete existing
    await db.delete(userHostels).where(eq(userHostels.userId, userId));

    // Insert new
    for (const hostelId of hostelIds) {
      await db.insert(userHostels).values({
        userId,
        hostelId,
        assignedAt: now,
      });
    }

    persistDatabase();
  }

  static async getUserHostels(userId: string): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ hostelId: userHostels.hostelId })
      .from(userHostels)
      .where(eq(userHostels.userId, userId));
    return rows.map((r) => r.hostelId);
  }
}
