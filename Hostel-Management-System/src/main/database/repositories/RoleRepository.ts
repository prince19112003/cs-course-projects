import { eq } from 'drizzle-orm';
import { getDb, persistDatabase } from '../connection.js';
import { roles, permissions, rolePermissions, Role, Permission } from '../schema/roles.js';

export class RoleRepository {
  static async getRoles(): Promise<Role[]> {
    const db = getDb();
    return db.select().from(roles);
  }

  static async getRoleById(id: string): Promise<Role | null> {
    const db = getDb();
    const rows = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return rows[0] || null;
  }

  static async getPermissions(): Promise<Permission[]> {
    const db = getDb();
    return db.select().from(permissions);
  }

  static async getRolePermissions(roleId: string): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ code: rolePermissions.permissionCode })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.code);
  }

  static async updateRolePermissions(roleId: string, permissionCodes: string[]): Promise<void> {
    const db = getDb();

    // Do not modify system super_admin role permissions
    const role = await this.getRoleById(roleId);
    if (!role) {
      throw new Error(`ROLE_NOT_FOUND: Role ${roleId} does not exist.`);
    }

    if (role.id === 'super_admin') {
      throw new Error('SUPER_ADMIN_PERMISSIONS_IMMUTABLE: Super Admin permissions cannot be modified.');
    }

    // Delete existing
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Insert new
    for (const code of permissionCodes) {
      await db.insert(rolePermissions).values({
        roleId,
        permissionCode: code,
      });
    }

    persistDatabase();
  }
}
