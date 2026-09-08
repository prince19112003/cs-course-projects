import { IpcMainInvokeEvent } from 'electron';
import { Result } from '../../shared/types.js';
import { SessionManager, ActiveSession } from '../services/SessionManager.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';

export type AuthorizedHandler<T = any> = (session: ActiveSession, ...args: any[]) => Promise<Result<T>>;

/**
 * Higher-order IPC guard requiring a valid, active session.
 */
export function requireAuth<T>(handler: AuthorizedHandler<T>) {
  return async (_event: IpcMainInvokeEvent, token: string, ...args: any[]): Promise<Result<T>> => {
    if (!token) {
      return {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'No active session provided.' },
      };
    }

    const session = SessionManager.getSession(token);
    if (!session) {
      return {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session has expired or is invalid. Please log in again.' },
      };
    }

    try {
      return await handler(session, ...args);
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (err as Error).message },
      };
    }
  };
}

/**
 * Higher-order IPC guard requiring a specific granular permission code (or super_admin '*').
 */
export function requirePermission<T>(permissionCode: string, handler: AuthorizedHandler<T>) {
  return async (_event: IpcMainInvokeEvent, token: string, ...args: any[]): Promise<Result<T>> => {
    if (!token) {
      return {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'No active session provided.' },
      };
    }

    const session = SessionManager.getSession(token);
    if (!session) {
      return {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session has expired or is invalid. Please log in again.' },
      };
    }

    const hasPermission = session.permissions.includes('*') || session.permissions.includes(permissionCode);
    if (!hasPermission) {
      // Log unauthorized attempt to audit log
      await AuditRepository.log({
        userId: session.userId,
        userRole: session.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'ipc_permission',
        changesSummary: JSON.stringify({ requiredPermission: permissionCode }),
        ipHostname: 'localhost',
      });

      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient privileges: requires permission '${permissionCode}'.`,
        },
      };
    }

    try {
      return await handler(session, ...args);
    } catch (err) {
      return {
        success: false,
        error: { code: 'SERVICE_ERROR', message: (err as Error).message },
      };
    }
  };
}
