import crypto from 'crypto';

export interface ActiveSession {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedHostelIds: string[];
  permissions: string[];
  forcePasswordChange: boolean;
  createdAt: number;
  lastActivityAt: number;
}

export interface SanitizedSessionUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedHostelIds: string[];
  permissions: string[];
  forcePasswordChange: boolean;
}

const SESSION_EXPIRY_MS = 120 * 60 * 1000; // 120 minutes idle timeout

export class SessionManager {
  private static sessions = new Map<string, ActiveSession>();

  /**
   * Creates an authenticated session, generating a 256-bit cryptographically secure token.
   */
  static createSession(params: {
    userId: string;
    name: string;
    email: string;
    role: string;
    assignedHostelIds?: string[];
    permissions: string[];
    forcePasswordChange?: boolean;
  }): { session: ActiveSession; token: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const session: ActiveSession = {
      token,
      userId: params.userId,
      name: params.name,
      email: params.email,
      role: params.role,
      assignedHostelIds: params.assignedHostelIds || [],
      permissions: params.permissions,
      forcePasswordChange: Boolean(params.forcePasswordChange),
      createdAt: now,
      lastActivityAt: now,
    };

    this.sessions.set(token, session);
    return { session, token };
  }

  /**
   * Retrieves an active session, checking idle expiration.
   */
  static getSession(token: string): ActiveSession | null {
    if (!token) return null;
    const session = this.sessions.get(token);

    if (!session) return null;

    const now = Date.now();
    if (now - session.lastActivityAt > SESSION_EXPIRY_MS) {
      // Expired due to inactivity
      this.sessions.delete(token);
      return null;
    }

    // Refresh last activity timestamp
    session.lastActivityAt = now;
    return session;
  }

  /**
   * Destroys an active session (logout).
   */
  static destroySession(token: string): boolean {
    return this.sessions.delete(token);
  }

  /**
   * Invalidates all active sessions for a specific user (used on deactivation or password reset).
   */
  static destroySessionsForUser(userId: string): number {
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  /**
   * Returns a sanitized user profile safe for exposure to the Renderer.
   */
  static sanitize(session: ActiveSession): SanitizedSessionUser {
    return {
      userId: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      assignedHostelIds: session.assignedHostelIds,
      permissions: session.permissions,
      forcePasswordChange: session.forcePasswordChange,
    };
  }

  /**
   * Clears all sessions (useful for tests).
   */
  static clearAll(): void {
    this.sessions.clear();
  }
}
