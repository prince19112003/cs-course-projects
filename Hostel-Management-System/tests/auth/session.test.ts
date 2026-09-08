import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../../src/main/services/SessionManager.js';

describe('SessionManager & In-Memory Token Lifecycle', () => {
  beforeEach(() => {
    SessionManager.clearAll();
  });

  it('generates cryptographically unique 64-hex-character session tokens', () => {
    const { session, token } = SessionManager.createSession({
      userId: 'USR-0001',
      name: 'Super Admin',
      email: 'admin@nexus.edu',
      role: 'super_admin',
      permissions: ['*'],
    });

    expect(token).toBeDefined();
    expect(token.length).toBe(64); // 32 bytes hex
    expect(session.userId).toBe('USR-0001');
    expect(session.permissions).toContain('*');
  });

  it('retrieves active session and updates activity timestamp', () => {
    const { token } = SessionManager.createSession({
      userId: 'USR-0002',
      name: 'Hostel Warden',
      email: 'warden@nexus.edu',
      role: 'warden',
      permissions: ['students:view', 'allocations:manage'],
    });

    const session = SessionManager.getSession(token);
    expect(session).toBeDefined();
    expect(session?.name).toBe('Hostel Warden');
    expect(session?.permissions).toContain('allocations:manage');
  });

  it('destroys single session on logout', () => {
    const { token } = SessionManager.createSession({
      userId: 'USR-0003',
      name: 'Operator',
      email: 'operator@nexus.edu',
      role: 'data_entry',
      permissions: ['students:view'],
    });

    expect(SessionManager.getSession(token)).not.toBeNull();
    const destroyed = SessionManager.destroySession(token);
    expect(destroyed).toBe(true);
    expect(SessionManager.getSession(token)).toBeNull();
  });

  it('terminates all sessions for a specific user upon suspension or password reset', () => {
    const userA = 'USR-TARGET';
    const s1 = SessionManager.createSession({ userId: userA, name: 'A', email: 'a@test', role: 'staff', permissions: [] });
    const s2 = SessionManager.createSession({ userId: userA, name: 'A', email: 'a@test', role: 'staff', permissions: [] });
    const s3 = SessionManager.createSession({ userId: 'USR-OTHER', name: 'B', email: 'b@test', role: 'staff', permissions: [] });

    const purged = SessionManager.destroySessionsForUser(userA);
    expect(purged).toBe(2);

    expect(SessionManager.getSession(s1.token)).toBeNull();
    expect(SessionManager.getSession(s2.token)).toBeNull();
    expect(SessionManager.getSession(s3.token)).not.toBeNull();
  });

  it('produces sanitized profile without exposing internal fields to renderer', () => {
    const { session } = SessionManager.createSession({
      userId: 'USR-0001',
      name: 'Admin',
      email: 'admin@nexus.edu',
      role: 'super_admin',
      permissions: ['*'],
      forcePasswordChange: true,
    });

    const sanitized = SessionManager.sanitize(session);
    expect(sanitized.userId).toBe('USR-0001');
    expect(sanitized.forcePasswordChange).toBe(true);
    expect((sanitized as any).token).toBeUndefined();
    expect((sanitized as any).createdAt).toBeUndefined();
  });
});
