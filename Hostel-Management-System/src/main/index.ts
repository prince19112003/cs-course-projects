import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppInfo, Result } from '../shared/types.js';
import { DatabaseService } from './database/services/DatabaseService.js';
import { StudentRepository } from './database/repositories/StudentRepository.js';
import { InfrastructureRepository } from './database/repositories/InfrastructureRepository.js';
import { AuthService } from './services/AuthService.js';
import { UserService } from './services/UserService.js';
import { SessionManager } from './services/SessionManager.js';
import { RoleRepository } from './database/repositories/RoleRepository.js';
import { AuditRepository } from './database/repositories/AuditRepository.js';
import { InfrastructureService } from './services/InfrastructureService.js';
import { AllocationService } from './services/AllocationService.js';
import { OccupancyCalculator } from './database/services/OccupancyCalculator.js';
import { StudentService } from './services/StudentService.js';
import { OperationsService } from './services/OperationsService.js';
import { BillingService } from './services/BillingService.js';
import { ReportingService } from './services/ReportingService.js';
import { BulkOperationsService } from './services/BulkOperationsService.js';
import { ImportExportService } from './services/ImportExportService.js';
import { BackupRestoreService } from './services/BackupRestoreService.js';
import { SearchService } from './services/SearchService.js';


// 1. Establish App Data Directory Hierarchy
const baseDataDir = path.join(app.getPath('appData'), 'NexusHostel');
const directories = {
  root: baseDataDir,
  data: path.join(baseDataDir, 'data'),
  backups: path.join(baseDataDir, 'backups'),
  logs: path.join(baseDataDir, 'logs'),
  documents: path.join(baseDataDir, 'documents'),
  photos: path.join(baseDataDir, 'photos'),
  temp: path.join(baseDataDir, 'temp'),
};

for (const dir of Object.values(directories)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 2. Local File Logger
const logFilePath = path.join(directories.logs, 'nexus-app.log');
function logMessage(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, details?: unknown) {
  const timestamp = new Date().toISOString();
  const detailStr = details ? ` | ${JSON.stringify(details)}` : '';
  const line = `[${timestamp}] [${level}] ${message}${detailStr}\n`;
  try {
    fs.appendFileSync(logFilePath, line, 'utf-8');
  } catch (err) {
    console.error('Failed writing to log file:', err);
  }
}

logMessage('INFO', 'Nexus Enterprise Application starting up...', {
  version: app.getVersion(),
  platform: process.platform,
  nodeVersion: process.version,
});

// 3. Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logMessage('WARN', 'Multiple application instances detected. Terminating secondary process.');
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    frame: false, // Windows frameless window with custom header
    title: 'Nexus Enterprise Hostel Management System',
    backgroundColor: '#F8FAFC',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
  });

  // Strict Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:5173;",
        ],
      },
    });
  });

  // Navigation Guard: Forbid navigating to arbitrary remote URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost:5173')) {
      event.preventDefault();
      logMessage('WARN', 'Blocked navigation attempt to remote URL:', url);
    }
  });

  // Deny new window popup creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logMessage('INFO', 'Main application window displayed.');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// 4. Secure IPC Handlers
ipcMain.handle('app:getInfo', (): Result<AppInfo> => {
  return {
    success: true,
    data: {
      version: app.getVersion(),
      name: 'Nexus Enterprise Hostel Management',
      isPackaged: app.isPackaged,
      platform: process.platform,
      appDataPath: directories.root,
    },
  };
});

ipcMain.handle('app:minimize', (): Result<boolean> => {
  if (mainWindow) {
    mainWindow.minimize();
    return { success: true, data: true };
  }
  return { success: false, error: { code: 'NO_WINDOW', message: 'No active window found' } };
});

ipcMain.handle('app:maximize', (): Result<boolean> => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { success: true, data: true };
  }
  return { success: false, error: { code: 'NO_WINDOW', message: 'No active window found' } };
});

ipcMain.handle('app:close', (): Result<boolean> => {
  if (mainWindow) {
    mainWindow.close();
    return { success: true, data: true };
  }
  return { success: false, error: { code: 'NO_WINDOW', message: 'No active window found' } };
});

ipcMain.handle('app:log', (_event, level: 'INFO' | 'WARN' | 'ERROR', msg: string, details?: unknown): Result<boolean> => {
  logMessage(level, msg, details);
  return { success: true, data: true };
});

ipcMain.handle('system:checkHealth', (): Result<{ status: string; storageOk: boolean }> => {
  return {
    success: true,
    data: {
      status: 'OPERATIONAL_OFFLINE',
      storageOk: fs.existsSync(directories.data),
    },
  };
});

// 5. Database IPC Handlers
ipcMain.handle('db:checkHealth', async (): Promise<Result<any>> => {
  try {
    const health = DatabaseService.getHealth();
    return { success: true, data: health };
  } catch (err) {
    const formatted = DatabaseService.formatError(err);
    return { success: false, error: formatted };
  }
});

ipcMain.handle('db:getStats', async (): Promise<Result<any>> => {
  try {
    const infraStats = await InfrastructureRepository.getStats();
    const studentCount = await StudentRepository.count();
    return {
      success: true,
      data: {
        ...infraStats,
        totalStudents: studentCount,
      },
    };
  } catch (err) {
    const formatted = DatabaseService.formatError(err);
    return { success: false, error: formatted };
  }
});

ipcMain.handle('db:getRoomMatrix', async (_event, hostelId?: string): Promise<Result<any>> => {
  try {
    const matrix = await InfrastructureRepository.getRoomMatrix(hostelId);
    return { success: true, data: matrix };
  } catch (err) {
    const formatted = DatabaseService.formatError(err);
    return { success: false, error: formatted };
  }
});

ipcMain.handle('db:searchStudents', async (_event, params: any): Promise<Result<any>> => {
  try {
    // Validate inputs
    const cleanParams = {
      query: typeof params?.query === 'string' ? params.query.slice(0, 100) : undefined,
      status: typeof params?.status === 'string' ? params.status.slice(0, 30) : undefined,
      limit: typeof params?.limit === 'number' ? Math.min(Math.max(params.limit, 1), 500) : 50,
      offset: typeof params?.offset === 'number' ? Math.max(params.offset, 0) : 0,
    };
    const result = await StudentRepository.search(cleanParams);
    return { success: true, data: result };
  } catch (err) {
    const formatted = DatabaseService.formatError(err);
    return { success: false, error: formatted };
  }
});

// 6. Authentication & Session IPC Handlers
ipcMain.handle('auth:checkSetup', async (): Promise<Result<{ setupNeeded: boolean }>> => {
  try {
    const status = await AuthService.checkSetupStatus();
    return { success: true, data: status };
  } catch (err) {
    return { success: false, error: { code: 'SETUP_CHECK_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('auth:setup', async (_event, data: any): Promise<Result<any>> => {
  try {
    const result = await AuthService.completeFirstTimeSetup(data);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'SETUP_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('auth:login', async (_event, credentials: any): Promise<Result<any>> => {
  try {
    if (!credentials?.identifier || !credentials?.password) {
      return { success: false, error: { code: 'MISSING_CREDENTIALS', message: 'Email/phone and password are required.' } };
    }
    const result = await AuthService.login(credentials.identifier, credentials.password);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'LOGIN_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('auth:logout', async (_event, token: string): Promise<Result<boolean>> => {
  try {
    await AuthService.logout(token);
    return { success: true, data: true };
  } catch (err) {
    return { success: false, error: { code: 'LOGOUT_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('auth:getSession', async (_event, token: string): Promise<Result<any>> => {
  try {
    const session = SessionManager.getSession(token);
    if (!session) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'No active session or session expired.' } };
    }
    return { success: true, data: SessionManager.sanitize(session) };
  } catch (err) {
    return { success: false, error: { code: 'SESSION_ERROR', message: (err as Error).message } };
  }
});

ipcMain.handle('auth:changePassword', async (_event, token: string, payload: any): Promise<Result<boolean>> => {
  try {
    await AuthService.changePassword(token, payload.currentPassword, payload.newPassword);
    return { success: true, data: true };
  } catch (err) {
    return { success: false, error: { code: 'PASSWORD_CHANGE_FAILED', message: (err as Error).message } };
  }
});

// 7. User Account Management IPC Handlers
ipcMain.handle('users:getPaginated', async (_event, token: string, params: any): Promise<Result<any>> => {
  try {
    const result = await UserService.getUsers(token, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'USER_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('users:create', async (_event, token: string, data: any): Promise<Result<any>> => {
  try {
    const user = await UserService.createUser(token, data);
    return { success: true, data: user };
  } catch (err) {
    return { success: false, error: { code: 'USER_CREATION_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('users:update', async (_event, token: string, userId: string, data: any): Promise<Result<any>> => {
  try {
    const user = await UserService.updateUser(token, userId, data);
    return { success: true, data: user };
  } catch (err) {
    return { success: false, error: { code: 'USER_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('users:toggleStatus', async (_event, token: string, userId: string, isActive: boolean): Promise<Result<boolean>> => {
  try {
    await UserService.toggleUserStatus(token, userId, isActive);
    return { success: true, data: true };
  } catch (err) {
    return { success: false, error: { code: 'USER_STATUS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('users:resetPassword', async (_event, token: string, payload: any): Promise<Result<boolean>> => {
  try {
    await AuthService.resetUserPassword(
      token,
      payload.targetUserId,
      payload.newPassword,
      payload.adminConfirmationPassword
    );
    return { success: true, data: true };
  } catch (err) {
    return { success: false, error: { code: 'PASSWORD_RESET_FAILED', message: (err as Error).message } };
  }
});

// 8. Roles, Permissions & Audit Trail Handlers
ipcMain.handle('roles:list', async (_event, token: string): Promise<Result<any>> => {
  try {
    const session = SessionManager.getSession(token);
    if (!session) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'No active session.' } };
    }
    const [roleList, permList] = await Promise.all([
      RoleRepository.getRoles(),
      RoleRepository.getPermissions(),
    ]);

    // Populate permissions for each role
    const rolesWithPerms = await Promise.all(
      roleList.map(async (r) => {
        const perms = await RoleRepository.getRolePermissions(r.id);
        return { ...r, permissions: perms };
      })
    );

    return {
      success: true,
      data: {
        roles: rolesWithPerms,
        permissions: permList,
      },
    };
  } catch (err) {
    return { success: false, error: { code: 'ROLES_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('roles:updatePermissions', async (_event, token: string, roleId: string, permissions: string[]): Promise<Result<boolean>> => {
  try {
    const session = SessionManager.getSession(token);
    if (!session) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'No active session.' } };
    }
    const hasPerm = session.permissions.includes('*') || session.permissions.includes('roles:manage');
    if (!hasPerm) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient privileges.' } };
    }

    await RoleRepository.updateRolePermissions(roleId, permissions);
    await AuditRepository.log({
      userId: session.userId,
      userRole: session.role,
      action: 'ROLE_PERMS_MODIFIED',
      entityType: 'roles',
      entityId: roleId,
      changesSummary: JSON.stringify({ permissionCount: permissions.length }),
      ipHostname: 'localhost',
    });

    return { success: true, data: true };
  } catch (err) {
    return { success: false, error: { code: 'ROLE_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('audit:list', async (_event, token: string, limit?: number): Promise<Result<any>> => {
  try {
    const session = SessionManager.getSession(token);
    if (!session) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'No active session.' } };
    }
    const hasPerm = session.permissions.includes('*') || session.permissions.includes('audit:view');
    if (!hasPerm) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient privileges to view audit logs.' } };
    }

    const logs = await AuditRepository.getRecent(limit || 100);
    return { success: true, data: logs };
  } catch (err) {
    return { success: false, error: { code: 'AUDIT_QUERY_FAILED', message: (err as Error).message } };
  }
});

// ----------------------------------------------------------------------------
// Hostels, Blocks, Floors, Rooms, Beds & Allocations IPC
// ----------------------------------------------------------------------------

// Helper to authenticate and verify permissions
function verifySessionAndPerm(token: string, requiredPerm: string): { user: any; error?: Result<any> } {
  const session = SessionManager.getSession(token);
  if (!session) {
    return { user: null, error: { success: false, error: { code: 'UNAUTHENTICATED', message: 'No active session.' } } };
  }
  const hasPerm = session.permissions.includes('*') || session.permissions.includes(requiredPerm);
  if (!hasPerm) {
    return { user: null, error: { success: false, error: { code: 'FORBIDDEN', message: `Missing required permission: ${requiredPerm}` } } };
  }
  return { user: { id: session.userId, ...session } };
}

// Hostels
ipcMain.handle('hostels:list', async (_event, token: string, includeInactive?: boolean): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const list = await InfrastructureService.getHostels(includeInactive);
    return { success: true, data: list };
  } catch (err) {
    return { success: false, error: { code: 'HOSTELS_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('hostels:getById', async (_event, token: string, id: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const hostel = await InfrastructureService.getHostelById(id);
    return { success: true, data: hostel };
  } catch (err) {
    return { success: false, error: { code: 'HOSTEL_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('hostels:create', async (_event, token: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const created = await InfrastructureService.createHostel(user, data);
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: { code: 'HOSTEL_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('hostels:update', async (_event, token: string, id: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const updated = await InfrastructureService.updateHostel(user, id, data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: { code: 'HOSTEL_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('hostels:toggleStatus', async (_event, token: string, id: string, isActive: boolean): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await InfrastructureService.toggleHostelStatus(user, id, isActive);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'HOSTEL_STATUS_FAILED', message: (err as Error).message } };
  }
});

// Blocks
ipcMain.handle('blocks:list', async (_event, token: string, hostelId?: string, includeInactive?: boolean): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const list = await InfrastructureService.getBlocks(hostelId, includeInactive);
    return { success: true, data: list };
  } catch (err) {
    return { success: false, error: { code: 'BLOCKS_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('blocks:create', async (_event, token: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const created = await InfrastructureService.createBlock(user, data);
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: { code: 'BLOCK_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('blocks:update', async (_event, token: string, id: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const updated = await InfrastructureService.updateBlock(user, id, data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: { code: 'BLOCK_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('blocks:toggleStatus', async (_event, token: string, id: string, isActive: boolean): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await InfrastructureService.toggleBlockStatus(user, id, isActive);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'BLOCK_STATUS_FAILED', message: (err as Error).message } };
  }
});

// Floors
ipcMain.handle('floors:list', async (_event, token: string, blockId?: string, includeInactive?: boolean): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const list = await InfrastructureService.getFloors(blockId, includeInactive);
    return { success: true, data: list };
  } catch (err) {
    return { success: false, error: { code: 'FLOORS_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('floors:create', async (_event, token: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const created = await InfrastructureService.createFloor(user, data);
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: { code: 'FLOOR_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('floors:update', async (_event, token: string, id: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const updated = await InfrastructureService.updateFloor(user, id, data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: { code: 'FLOOR_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('floors:toggleStatus', async (_event, token: string, id: string, isActive: boolean): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await InfrastructureService.toggleFloorStatus(user, id, isActive);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'FLOOR_STATUS_FAILED', message: (err as Error).message } };
  }
});

// Rooms
ipcMain.handle('rooms:list', async (_event, token: string, params?: any): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const list = await InfrastructureService.getRooms(params);
    return { success: true, data: list };
  } catch (err) {
    return { success: false, error: { code: 'ROOMS_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('rooms:getById', async (_event, token: string, id: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const room = await InfrastructureService.getRoomById(id);
    return { success: true, data: room };
  } catch (err) {
    return { success: false, error: { code: 'ROOM_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('rooms:create', async (_event, token: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const created = await InfrastructureService.createRoom(user, data);
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: { code: 'ROOM_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('rooms:update', async (_event, token: string, id: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const updated = await InfrastructureService.updateRoom(user, id, data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: { code: 'ROOM_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('rooms:toggleStatus', async (_event, token: string, id: string, status?: any, isArchived?: boolean): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await InfrastructureService.toggleRoomStatus(user, id, status, isArchived);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ROOM_STATUS_FAILED', message: (err as Error).message } };
  }
});

// Beds
ipcMain.handle('beds:list', async (_event, token: string, params?: any): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const list = await InfrastructureService.getBeds(params);
    return { success: true, data: list };
  } catch (err) {
    return { success: false, error: { code: 'BEDS_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('beds:create', async (_event, token: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const created = await InfrastructureService.createBed(user, data);
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: { code: 'BED_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('beds:update', async (_event, token: string, id: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const updated = await InfrastructureService.updateBed(user, id, data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: { code: 'BED_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('beds:toggleStatus', async (_event, token: string, id: string, status?: any, isArchived?: boolean): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await InfrastructureService.toggleBedStatus(user, id, status, isArchived);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'BED_STATUS_FAILED', message: (err as Error).message } };
  }
});

// Allocations
ipcMain.handle('allocations:list', async (_event, token: string, params?: any): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'allocations:view');
  if (error) return error;
  try {
    const result = await AllocationService.getAllocations(params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ALLOCATIONS_QUERY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('allocations:history', async (_event, token: string, studentId?: string, bedId?: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'allocations:view');
  if (error) return error;
  try {
    const result = await AllocationService.getAllocationHistory(studentId, bedId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ALLOCATION_HISTORY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('allocations:create', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'allocations:manage');
  if (error) return error;
  try {
    const result = await AllocationService.allocateBed(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ALLOCATION_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('allocations:transfer', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'allocations:manage');
  if (error) return error;
  try {
    const result = await AllocationService.transferBed(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ALLOCATION_TRANSFER_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('allocations:vacate', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'allocations:manage');
  if (error) return error;
  try {
    const result = await AllocationService.vacateBed(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ALLOCATION_VACATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('allocations:getDevStudents', async (_event, token: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'allocations:view');
  if (error) return error;
  try {
    const students = await AllocationService.getDevTestStudents();
    return { success: true, data: students };
  } catch (err) {
    return { success: false, error: { code: 'DEV_STUDENTS_FAILED', message: (err as Error).message } };
  }
});

// Occupancy Metrics
ipcMain.handle('occupancy:getCampus', async (_event, token: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const stats = await OccupancyCalculator.calculateCampusOccupancy();
    return { success: true, data: stats };
  } catch (err) {
    return { success: false, error: { code: 'OCCUPANCY_CAMPUS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('occupancy:getHostel', async (_event, token: string, hostelId: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const stats = await OccupancyCalculator.calculateHostelOccupancy(hostelId);
    return { success: true, data: stats };
  } catch (err) {
    return { success: false, error: { code: 'OCCUPANCY_HOSTEL_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('occupancy:getRoom', async (_event, token: string, roomId: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const stats = await OccupancyCalculator.calculateRoomOccupancy(roomId);
    return { success: true, data: stats };
  } catch (err) {
    return { success: false, error: { code: 'OCCUPANCY_ROOM_FAILED', message: (err as Error).message } };
  }
});

// ----------------------------------------------------------------------------
// Student Management & Dossier IPC Handlers
// ----------------------------------------------------------------------------

ipcMain.handle('students:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const result = await StudentService.searchStudents(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'STUDENTS_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:getById', async (_event, token: string, id: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const student = await StudentService.getStudentById(user, id);
    return { success: true, data: student };
  } catch (err) {
    return { success: false, error: { code: 'STUDENT_GET_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:create');
  if (error) return error;
  try {
    const student = await StudentService.createStudent(user, input);
    return { success: true, data: student };
  } catch (err) {
    return { success: false, error: { code: 'STUDENT_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:update', async (_event, token: string, id: string, updates: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const student = await StudentService.updateStudent(user, id, updates);
    return { success: true, data: student };
  } catch (err) {
    return { success: false, error: { code: 'STUDENT_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:setStatus', async (_event, token: string, id: string, status: any, remarks?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:archive');
  if (error) return error;
  try {
    const student = await StudentService.setStudentStatus(user, id, status, remarks);
    return { success: true, data: student };
  } catch (err) {
    return { success: false, error: { code: 'STUDENT_SET_STATUS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:bulkUpdateStatus', async (_event, token: string, studentIds: string[], status: any, remarks?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:archive');
  if (error) return error;
  try {
    const result = await StudentService.bulkUpdateStatus(user, studentIds, status, remarks);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'STUDENT_BULK_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:uploadPhoto', async (_event, token: string, studentId: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const result = await StudentService.uploadPhoto(user, studentId, data);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'PHOTO_UPLOAD_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:uploadDocument', async (_event, token: string, studentId: string, data: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const doc = await StudentService.uploadDocument(user, studentId, data);
    return { success: true, data: doc };
  } catch (err) {
    return { success: false, error: { code: 'DOCUMENT_UPLOAD_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:deleteDocument', async (_event, token: string, studentId: string, docId: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const result = await StudentService.deleteDocument(user, studentId, docId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'DOCUMENT_DELETE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:openDocument', async (_event, token: string, docId: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const result = await StudentService.openDocument(user, docId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'DOCUMENT_OPEN_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('students:getAllocationHistory', async (_event, token: string, studentId: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const history = await StudentService.getAllocationHistory(user, studentId);
    return { success: true, data: history };
  } catch (err) {
    return { success: false, error: { code: 'ALLOCATION_HISTORY_FAILED', message: (err as Error).message } };
  }
});

// ----------------------------------------------------------------------------
// Campus Operations & Services IPC Handlers
// ----------------------------------------------------------------------------

// Attendance
ipcMain.handle('operations:attendance:mark', async (_event, token: string, date: string, items: any[]): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'attendance:mark');
  if (error) return error;
  try {
    const result = await OperationsService.markAttendance(user, date, items);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ATTENDANCE_MARK_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:attendance:getByDate', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getAttendanceByDate(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ATTENDANCE_GET_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:attendance:getSummary', async (_event, token: string, date: string, hostelId?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getAttendanceSummary(user, date, hostelId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ATTENDANCE_SUMMARY_FAILED', message: (err as Error).message } };
  }
});

// Gate Passes / Leave
ipcMain.handle('operations:gatePasses:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const result = await OperationsService.getGatePasses(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'GATEPASS_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:gatePasses:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const result = await OperationsService.createGatePass(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'GATEPASS_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:gatePasses:review', async (_event, token: string, id: string, status: any, notes?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'gatepass:approve');
  if (error) return error;
  try {
    const result = await OperationsService.reviewGatePass(user, id, status, notes);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'GATEPASS_REVIEW_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:gatePasses:logMovement', async (_event, token: string, id: string, movement: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'gatepass:approve');
  if (error) return error;
  try {
    const result = await OperationsService.logGatePassMovement(user, id, movement);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'GATEPASS_MOVEMENT_FAILED', message: (err as Error).message } };
  }
});

// Complaints
ipcMain.handle('operations:complaints:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getComplaints(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'COMPLAINTS_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:complaints:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.createComplaint(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'COMPLAINT_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:complaints:resolve', async (_event, token: string, id: string, status: any, staffId?: string, notes?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'complaints:resolve');
  if (error) return error;
  try {
    const result = await OperationsService.resolveComplaint(user, id, status, staffId, notes);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'COMPLAINT_RESOLVE_FAILED', message: (err as Error).message } };
  }
});

// Notices
ipcMain.handle('operations:notices:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getNotices(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'NOTICES_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:notices:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'notices:publish');
  if (error) return error;
  try {
    const result = await OperationsService.createNotice(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'NOTICE_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:notices:delete', async (_event, token: string, id: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'notices:publish');
  if (error) return error;
  try {
    const result = await OperationsService.deleteNotice(user, id);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'NOTICE_DELETE_FAILED', message: (err as Error).message } };
  }
});

// Visitors
ipcMain.handle('operations:visitors:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getVisitors(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'VISITORS_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:visitors:register', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.registerVisitor(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'VISITOR_REGISTER_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:visitors:checkOut', async (_event, token: string, id: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.checkOutVisitor(user, id);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'VISITOR_CHECKOUT_FAILED', message: (err as Error).message } };
  }
});

// Staff
ipcMain.handle('operations:staff:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getStaff(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'STAFF_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:staff:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'users:manage');
  if (error) return error;
  try {
    const result = await OperationsService.createStaff(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'STAFF_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:staff:toggleStatus', async (_event, token: string, id: string, isActive: boolean): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'users:manage');
  if (error) return error;
  try {
    const result = await OperationsService.toggleStaffStatus(user, id, isActive);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'STAFF_TOGGLE_FAILED', message: (err as Error).message } };
  }
});

// Assets
ipcMain.handle('operations:assets:list', async (_event, token: string, roomId?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getRoomAssets(user, roomId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ASSETS_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:assets:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await OperationsService.createRoomAsset(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ASSET_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:assets:update', async (_event, token: string, id: string, updates: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await OperationsService.updateRoomAsset(user, id, updates);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ASSET_UPDATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:assets:delete', async (_event, token: string, id: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:manage');
  if (error) return error;
  try {
    const result = await OperationsService.deleteRoomAsset(user, id);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'ASSET_DELETE_FAILED', message: (err as Error).message } };
  }
});

// Mess
ipcMain.handle('operations:mess:getOptOuts', async (_event, token: string, weekendStartDate: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const result = await OperationsService.getMessOptOuts(user, weekendStartDate);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'MESS_OPTOUTS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:mess:recordOptOut', async (_event, token: string, studentId: string, weekendStartDate: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const result = await OperationsService.recordMessOptOut(user, studentId, weekendStartDate);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'MESS_OPTOUT_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('operations:mess:cancelOptOut', async (_event, token: string, studentId: string, weekendStartDate: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:edit');
  if (error) return error;
  try {
    const result = await OperationsService.cancelMessOptOut(user, studentId, weekendStartDate);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'MESS_CANCEL_FAILED', message: (err as Error).message } };
  }
});

// ----------------------------------------------------------------------------
// Billing & Fees IPC Handlers
// ----------------------------------------------------------------------------
ipcMain.handle('billing:invoices:list', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const result = await BillingService.getInvoices(user, params);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'INVOICES_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('billing:invoices:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'billing:run');
  if (error) return error;
  try {
    const result = await BillingService.createInvoice(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'INVOICE_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('billing:payments:record', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'billing:collect');
  if (error) return error;
  try {
    const result = await BillingService.recordPayment(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'PAYMENT_RECORD_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('billing:payments:list', async (_event, token: string, invoiceId?: string, studentId?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const result = await BillingService.getPayments(user, invoiceId, studentId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'PAYMENTS_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('billing:fees:getSummary', async (_event, token: string, studentId: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const result = await BillingService.getStudentFeeSummary(user, studentId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'FEE_SUMMARY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('billing:invoices:waive', async (_event, token: string, invoiceId: string, reason: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'billing:waive');
  if (error) return error;
  try {
    const result = await BillingService.waiveInvoice(user, invoiceId, reason);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'INVOICE_WAIVE_FAILED', message: (err as Error).message } };
  }
});

// ----------------------------------------------------------------------------
// Reports, Bulk Operations & Data Tools IPC Handlers
// ----------------------------------------------------------------------------

// Reports
ipcMain.handle('reports:getOccupancy', async (_event, token: string, hostelId?: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const data = await ReportingService.getOccupancyReport(user, hostelId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_OCCUPANCY_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('reports:getFeeDefaulters', async (_event, token: string, params?: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const data = await ReportingService.getFeeDefaultersReport(user, params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_DEFAULTERS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('reports:getAttendanceAnalytics', async (_event, token: string, params: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const data = await ReportingService.getAttendanceAnalytics(user, params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_ATTENDANCE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('reports:getGatePassRegister', async (_event, token: string, params?: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const data = await ReportingService.getGatePassRegister(user, params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_GATEPASS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('reports:getMaintenance', async (_event, token: string, params?: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'rooms:view');
  if (error) return error;
  try {
    const data = await ReportingService.getMaintenanceAnalytics(user, params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_MAINTENANCE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('reports:getDemographics', async (_event, token: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const data = await ReportingService.getDemographicsReport(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_DEMOGRAPHICS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('reports:exportCsv', async (_event, token: string, reportType: any, params?: any): Promise<Result<string>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const csvString = await ReportingService.exportReportCsv(user, reportType, params);
    return { success: true, data: csvString };
  } catch (err) {
    return { success: false, error: { code: 'REPORT_EXPORT_FAILED', message: (err as Error).message } };
  }
});

// Bulk Operations
ipcMain.handle('bulk:invoices:create', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'billing:run');
  if (error) return error;
  try {
    const result = await BulkOperationsService.bulkCreateInvoices(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'BULK_INVOICES_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('bulk:allocations:assign', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'allocations:manage');
  if (error) return error;
  try {
    const result = await BulkOperationsService.bulkAllocateBeds(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'BULK_ALLOCATION_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('bulk:attendance:mark', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'attendance:mark');
  if (error) return error;
  try {
    const result = await BulkOperationsService.bulkMarkAttendance(user, input);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'BULK_ATTENDANCE_FAILED', message: (err as Error).message } };
  }
});

// Data Import & Export
ipcMain.handle('import:students:preview', async (_event, token: string, csvContent: string): Promise<Result<any>> => {
  const { error } = verifySessionAndPerm(token, 'students:create');
  if (error) return error;
  try {
    const result = await ImportExportService.previewStudentCsv(csvContent);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'IMPORT_PREVIEW_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('import:students:execute', async (_event, token: string, rows: any[]): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:create');
  if (error) return error;
  try {
    const result = await ImportExportService.executeStudentImport(user, rows);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: { code: 'IMPORT_EXECUTE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('export:students:csv', async (_event, token: string, params?: any): Promise<Result<string>> => {
  const { user, error } = verifySessionAndPerm(token, 'students:view');
  if (error) return error;
  try {
    const csvString = await ImportExportService.exportStudentsCsv(user, params);
    return { success: true, data: csvString };
  } catch (err) {
    return { success: false, error: { code: 'EXPORT_STUDENTS_FAILED', message: (err as Error).message } };
  }
});

// Global Search IPC
ipcMain.handle('search:global', async (_event, token: string, query: string): Promise<Result<any>> => {
  const user = AuthService.validateSession(token);
  if (!user) return { success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } };
  try {
    const data = await SearchService.globalSearch(user, query);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'SEARCH_FAILED', message: (err as Error).message } };
  }
});

// Live Dashboard KPIs IPC
ipcMain.handle('reports:dashboardKpis', async (_event, token: string): Promise<Result<any>> => {
  const user = AuthService.validateSession(token);
  if (!user) return { success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } };
  try {
    const data = await ReportingService.getDashboardKpis(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'DASHBOARD_KPIS_FAILED', message: (err as Error).message } };
  }
});

// Backup & Restore IPC Channels
ipcMain.handle('backup:create', async (_event, token: string, input?: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:create');
  if (error) return error;
  try {
    const res = await BackupRestoreService.createBackup(user, input);
    return { success: true, data: res };
  } catch (err) {
    return { success: false, error: { code: 'BACKUP_CREATE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:list', async (_event, token: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:view');
  if (error) return error;
  try {
    const data = await BackupRestoreService.listBackups(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'BACKUP_LIST_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:delete', async (_event, token: string, filename: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:delete');
  if (error) return error;
  try {
    const data = await BackupRestoreService.deleteBackup(user, filename);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'BACKUP_DELETE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:validate', async (_event, _token: string, backupPath: string): Promise<Result<any>> => {
  try {
    const data = await BackupRestoreService.validateBackupFile(backupPath);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'BACKUP_VALIDATION_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:restore', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:restore');
  if (error) return error;
  try {
    const res = await BackupRestoreService.restoreBackup(user, input);
    return { success: true, data: res };
  } catch (err) {
    return { success: false, error: { code: 'RESTORE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:exportPortable', async (_event, token: string, input?: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:create');
  if (error) return error;
  try {
    const res = await BackupRestoreService.exportPortablePackage(user, input);
    return { success: true, data: res };
  } catch (err) {
    return { success: false, error: { code: 'EXPORT_PORTABLE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:importPortable', async (_event, token: string, input: any): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:restore');
  if (error) return error;
  try {
    const res = await BackupRestoreService.importPortablePackage(user, input);
    return { success: true, data: res };
  } catch (err) {
    return { success: false, error: { code: 'IMPORT_PORTABLE_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:getHealth', async (_event, token: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:view');
  if (error) return error;
  try {
    const data = await BackupRestoreService.getDatabaseDiagnostics(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'GET_HEALTH_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:vacuum', async (_event, token: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:create');
  if (error) return error;
  try {
    const data = await BackupRestoreService.runDatabaseOptimization(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'VACUUM_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:getMigrationStatus', async (_event, token: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'backup:view');
  if (error) return error;
  try {
    const data = await BackupRestoreService.getMigrationStatus(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'GET_MIGRATION_STATUS_FAILED', message: (err as Error).message } };
  }
});

ipcMain.handle('backup:runMigrations', async (_event, token: string): Promise<Result<any>> => {
  const { user, error } = verifySessionAndPerm(token, 'migrations:run');
  if (error) return error;
  try {
    const data = await BackupRestoreService.runPendingMigrations(user);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: { code: 'RUN_MIGRATIONS_FAILED', message: (err as Error).message } };
  }
});



// App Lifecycle
app.whenReady().then(async () => {
  // Initialize Database before opening window
  try {
    const dbPath = path.join(directories.data, 'hostel_master.db');
    logMessage('INFO', `Initializing local SQLite database at: ${dbPath}`);
    const health = await DatabaseService.initialize({ dbPath });
    logMessage('INFO', 'Database initialized successfully.', health);
  } catch (err) {
    logMessage('ERROR', 'Fatal: Failed to initialize SQLite database:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  logMessage('INFO', 'Application shutting down. Closing database connection.');
  DatabaseService.shutdown();
});

app.on('window-all-closed', () => {
  logMessage('INFO', 'All windows closed. Terminating process.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

