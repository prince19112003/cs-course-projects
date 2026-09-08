import { contextBridge, ipcRenderer } from 'electron';
import {
  AppInfo,
  Result,
  SessionUser,
  UserDto,
  RoleDto,
  PermissionDto,
  AuditLogDto,
  HostelDto,
  BlockDto,
  FloorDto,
  RoomDto,
  BedDto,
  AllocationDto,
  OccupancyMetricsDto,
} from '../shared/types';

// Strict contextBridge exposure: zero open event listeners or unrestricted Node APIs
contextBridge.exposeInMainWorld('desktopApi', {
  app: {
    getInfo: (): Promise<Result<AppInfo>> => ipcRenderer.invoke('app:getInfo'),
    minimize: (): Promise<Result<boolean>> => ipcRenderer.invoke('app:minimize'),
    maximize: (): Promise<Result<boolean>> => ipcRenderer.invoke('app:maximize'),
    close: (): Promise<Result<boolean>> => ipcRenderer.invoke('app:close'),
    log: (level: 'INFO' | 'WARN' | 'ERROR', msg: string, details?: unknown): Promise<Result<boolean>> =>
      ipcRenderer.invoke('app:log', level, msg, details),
  },
  system: {
    checkHealth: (): Promise<Result<{ status: string; storageOk: boolean }>> =>
      ipcRenderer.invoke('system:checkHealth'),
  },
  db: {
    checkHealth: (): Promise<Result<any>> => ipcRenderer.invoke('db:checkHealth'),
    getStats: (): Promise<Result<any>> => ipcRenderer.invoke('db:getStats'),
    getRoomMatrix: (hostelId?: string): Promise<Result<any>> => ipcRenderer.invoke('db:getRoomMatrix', hostelId),
    searchStudents: (params: any): Promise<Result<any>> => ipcRenderer.invoke('db:searchStudents', params),
  },
  auth: {
    checkSetup: (): Promise<Result<{ setupNeeded: boolean }>> =>
      ipcRenderer.invoke('auth:checkSetup'),
    setup: (data: any): Promise<Result<{ token: string; user: SessionUser }>> =>
      ipcRenderer.invoke('auth:setup', data),
    login: (credentials: { identifier: string; password: string }): Promise<Result<{ token: string; user: SessionUser }>> =>
      ipcRenderer.invoke('auth:login', credentials),
    logout: (token: string): Promise<Result<boolean>> =>
      ipcRenderer.invoke('auth:logout', token),
    getSession: (token: string): Promise<Result<SessionUser>> =>
      ipcRenderer.invoke('auth:getSession', token),
    changePassword: (token: string, payload: { currentPassword: string; newPassword: string }): Promise<Result<boolean>> =>
      ipcRenderer.invoke('auth:changePassword', token, payload),
  },
  users: {
    getPaginated: (token: string, params: any): Promise<Result<{ data: UserDto[]; total: number }>> =>
      ipcRenderer.invoke('users:getPaginated', token, params),
    create: (token: string, data: any): Promise<Result<UserDto>> =>
      ipcRenderer.invoke('users:create', token, data),
    update: (token: string, userId: string, data: any): Promise<Result<UserDto>> =>
      ipcRenderer.invoke('users:update', token, userId, data),
    toggleStatus: (token: string, userId: string, isActive: boolean): Promise<Result<boolean>> =>
      ipcRenderer.invoke('users:toggleStatus', token, userId, isActive),
    resetPassword: (token: string, payload: { targetUserId: string; newPassword: string; adminConfirmationPassword: string }): Promise<Result<boolean>> =>
      ipcRenderer.invoke('users:resetPassword', token, payload),
  },
  roles: {
    list: (token: string): Promise<Result<{ roles: RoleDto[]; permissions: PermissionDto[] }>> =>
      ipcRenderer.invoke('roles:list', token),
    updatePermissions: (token: string, roleId: string, permissions: string[]): Promise<Result<boolean>> =>
      ipcRenderer.invoke('roles:updatePermissions', token, roleId, permissions),
  },
  audit: {
    list: (token: string, limit?: number): Promise<Result<AuditLogDto[]>> =>
      ipcRenderer.invoke('audit:list', token, limit),
  },
  hostels: {
    list: (token: string, includeInactive?: boolean): Promise<Result<HostelDto[]>> =>
      ipcRenderer.invoke('hostels:list', token, includeInactive),
    getById: (token: string, id: string): Promise<Result<HostelDto | null>> =>
      ipcRenderer.invoke('hostels:getById', token, id),
    create: (token: string, data: any): Promise<Result<HostelDto>> =>
      ipcRenderer.invoke('hostels:create', token, data),
    update: (token: string, id: string, data: any): Promise<Result<HostelDto>> =>
      ipcRenderer.invoke('hostels:update', token, id, data),
    toggleStatus: (token: string, id: string, isActive: boolean): Promise<Result<boolean>> =>
      ipcRenderer.invoke('hostels:toggleStatus', token, id, isActive),
  },
  blocks: {
    list: (token: string, hostelId?: string, includeInactive?: boolean): Promise<Result<BlockDto[]>> =>
      ipcRenderer.invoke('blocks:list', token, hostelId, includeInactive),
    create: (token: string, data: any): Promise<Result<BlockDto>> =>
      ipcRenderer.invoke('blocks:create', token, data),
    update: (token: string, id: string, data: any): Promise<Result<BlockDto>> =>
      ipcRenderer.invoke('blocks:update', token, id, data),
    toggleStatus: (token: string, id: string, isActive: boolean): Promise<Result<boolean>> =>
      ipcRenderer.invoke('blocks:toggleStatus', token, id, isActive),
  },
  floors: {
    list: (token: string, blockId?: string, includeInactive?: boolean): Promise<Result<FloorDto[]>> =>
      ipcRenderer.invoke('floors:list', token, blockId, includeInactive),
    create: (token: string, data: any): Promise<Result<FloorDto>> =>
      ipcRenderer.invoke('floors:create', token, data),
    update: (token: string, id: string, data: any): Promise<Result<FloorDto>> =>
      ipcRenderer.invoke('floors:update', token, id, data),
    toggleStatus: (token: string, id: string, isActive: boolean): Promise<Result<boolean>> =>
      ipcRenderer.invoke('floors:toggleStatus', token, id, isActive),
  },
  rooms: {
    list: (token: string, params?: any): Promise<Result<{ data: RoomDto[]; total: number }>> =>
      ipcRenderer.invoke('rooms:list', token, params),
    getById: (token: string, id: string): Promise<Result<RoomDto | null>> =>
      ipcRenderer.invoke('rooms:getById', token, id),
    create: (token: string, data: any): Promise<Result<RoomDto>> =>
      ipcRenderer.invoke('rooms:create', token, data),
    update: (token: string, id: string, data: any): Promise<Result<RoomDto>> =>
      ipcRenderer.invoke('rooms:update', token, id, data),
    toggleStatus: (token: string, id: string, status?: any, isArchived?: boolean): Promise<Result<boolean>> =>
      ipcRenderer.invoke('rooms:toggleStatus', token, id, status, isArchived),
  },
  beds: {
    list: (token: string, params?: any): Promise<Result<BedDto[]>> =>
      ipcRenderer.invoke('beds:list', token, params),
    create: (token: string, data: any): Promise<Result<BedDto>> =>
      ipcRenderer.invoke('beds:create', token, data),
    update: (token: string, id: string, data: any): Promise<Result<BedDto>> =>
      ipcRenderer.invoke('beds:update', token, id, data),
    toggleStatus: (token: string, id: string, status?: any, isArchived?: boolean): Promise<Result<boolean>> =>
      ipcRenderer.invoke('beds:toggleStatus', token, id, status, isArchived),
  },
  allocations: {
    list: (token: string, params?: any): Promise<Result<{ data: AllocationDto[]; total: number }>> =>
      ipcRenderer.invoke('allocations:list', token, params),
    history: (token: string, studentId?: string, bedId?: string): Promise<Result<AllocationDto[]>> =>
      ipcRenderer.invoke('allocations:history', token, studentId, bedId),
    create: (token: string, params: any): Promise<Result<AllocationDto>> =>
      ipcRenderer.invoke('allocations:create', token, params),
    transfer: (token: string, params: any): Promise<Result<{ oldAllocation: AllocationDto; newAllocation: AllocationDto }>> =>
      ipcRenderer.invoke('allocations:transfer', token, params),
    vacate: (token: string, params: any): Promise<Result<AllocationDto>> =>
      ipcRenderer.invoke('allocations:vacate', token, params),
    getDevStudents: (token: string): Promise<Result<Array<{ id: string; name: string; enrollmentNumber: string; isAllocated: boolean }>>> =>
      ipcRenderer.invoke('allocations:getDevStudents', token),
  },
  occupancy: {
    getCampus: (token: string): Promise<Result<OccupancyMetricsDto>> =>
      ipcRenderer.invoke('occupancy:getCampus', token),
    getHostel: (token: string, hostelId: string): Promise<Result<OccupancyMetricsDto>> =>
      ipcRenderer.invoke('occupancy:getHostel', token, hostelId),
    getRoom: (token: string, roomId: string): Promise<Result<any>> =>
      ipcRenderer.invoke('occupancy:getRoom', token, roomId),
  },
  students: {
    list: (token: string, params?: any): Promise<Result<{ data: any[]; total: number }>> =>
      ipcRenderer.invoke('students:list', token, params),
    getById: (token: string, id: string): Promise<Result<any>> =>
      ipcRenderer.invoke('students:getById', token, id),
    create: (token: string, input: any): Promise<Result<any>> =>
      ipcRenderer.invoke('students:create', token, input),
    update: (token: string, id: string, updates: any): Promise<Result<any>> =>
      ipcRenderer.invoke('students:update', token, id, updates),
    setStatus: (token: string, id: string, status: string, remarks?: string): Promise<Result<any>> =>
      ipcRenderer.invoke('students:setStatus', token, id, status, remarks),
    bulkUpdateStatus: (token: string, studentIds: string[], status: string, remarks?: string): Promise<Result<{ updatedCount: number }>> =>
      ipcRenderer.invoke('students:bulkUpdateStatus', token, studentIds, status, remarks),
    uploadPhoto: (token: string, studentId: string, data: { base64: string; fileName: string }): Promise<Result<{ photoPath: string }>> =>
      ipcRenderer.invoke('students:uploadPhoto', token, studentId, data),
    uploadDocument: (token: string, studentId: string, data: { docType: string; fileName: string; base64: string }): Promise<Result<any>> =>
      ipcRenderer.invoke('students:uploadDocument', token, studentId, data),
    deleteDocument: (token: string, studentId: string, docId: string): Promise<Result<{ success: boolean }>> =>
      ipcRenderer.invoke('students:deleteDocument', token, studentId, docId),
    openDocument: (token: string, docId: string): Promise<Result<{ opened: boolean }>> =>
      ipcRenderer.invoke('students:openDocument', token, docId),
    getAllocationHistory: (token: string, studentId: string): Promise<Result<any[]>> =>
      ipcRenderer.invoke('students:getAllocationHistory', token, studentId),
  },
  operations: {
    attendance: {
      mark: (token: string, date: string, items: any[]): Promise<Result<{ markedCount: number }>> =>
        ipcRenderer.invoke('operations:attendance:mark', token, date, items),
      getByDate: (token: string, params: any): Promise<Result<any[]>> =>
        ipcRenderer.invoke('operations:attendance:getByDate', token, params),
      getSummary: (token: string, date: string, hostelId?: string): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:attendance:getSummary', token, date, hostelId),
    },
    gatePasses: {
      list: (token: string, params: any): Promise<Result<{ data: any[]; total: number }>> =>
        ipcRenderer.invoke('operations:gatePasses:list', token, params),
      create: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:gatePasses:create', token, input),
      review: (token: string, id: string, status: any, notes?: string): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:gatePasses:review', token, id, status, notes),
      logMovement: (token: string, id: string, movement: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:gatePasses:logMovement', token, id, movement),
    },
    complaints: {
      list: (token: string, params: any): Promise<Result<{ data: any[]; total: number }>> =>
        ipcRenderer.invoke('operations:complaints:list', token, params),
      create: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:complaints:create', token, input),
      resolve: (token: string, id: string, status: any, staffId?: string, notes?: string): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:complaints:resolve', token, id, status, staffId, notes),
    },
    notices: {
      list: (token: string, params: any): Promise<Result<{ data: any[]; total: number }>> =>
        ipcRenderer.invoke('operations:notices:list', token, params),
      create: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:notices:create', token, input),
      delete: (token: string, id: string): Promise<Result<boolean>> =>
        ipcRenderer.invoke('operations:notices:delete', token, id),
    },
    visitors: {
      list: (token: string, params: any): Promise<Result<{ data: any[]; total: number }>> =>
        ipcRenderer.invoke('operations:visitors:list', token, params),
      register: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:visitors:register', token, input),
      checkOut: (token: string, id: string): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:visitors:checkOut', token, id),
    },
    staff: {
      list: (token: string, params: any): Promise<Result<{ data: any[]; total: number }>> =>
        ipcRenderer.invoke('operations:staff:list', token, params),
      create: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:staff:create', token, input),
      toggleStatus: (token: string, id: string, isActive: boolean): Promise<Result<boolean>> =>
        ipcRenderer.invoke('operations:staff:toggleStatus', token, id, isActive),
    },
    assets: {
      list: (token: string, roomId?: string): Promise<Result<any[]>> =>
        ipcRenderer.invoke('operations:assets:list', token, roomId),
      create: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:assets:create', token, input),
      update: (token: string, id: string, updates: any): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:assets:update', token, id, updates),
      delete: (token: string, id: string): Promise<Result<boolean>> =>
        ipcRenderer.invoke('operations:assets:delete', token, id),
    },
    mess: {
      getOptOuts: (token: string, weekendStartDate: string): Promise<Result<any[]>> =>
        ipcRenderer.invoke('operations:mess:getOptOuts', token, weekendStartDate),
      recordOptOut: (token: string, studentId: string, weekendStartDate: string): Promise<Result<any>> =>
        ipcRenderer.invoke('operations:mess:recordOptOut', token, studentId, weekendStartDate),
      cancelOptOut: (token: string, studentId: string, weekendStartDate: string): Promise<Result<boolean>> =>
        ipcRenderer.invoke('operations:mess:cancelOptOut', token, studentId, weekendStartDate),
    },
  },
  billing: {
    invoices: {
      list: (token: string, params: any): Promise<Result<{ data: any[]; total: number }>> =>
        ipcRenderer.invoke('billing:invoices:list', token, params),
      create: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('billing:invoices:create', token, input),
      waive: (token: string, invoiceId: string, reason: string): Promise<Result<any>> =>
        ipcRenderer.invoke('billing:invoices:waive', token, invoiceId, reason),
    },
    payments: {
      record: (token: string, input: any): Promise<Result<any>> =>
        ipcRenderer.invoke('billing:payments:record', token, input),
      list: (token: string, invoiceId?: string, studentId?: string): Promise<Result<any[]>> =>
        ipcRenderer.invoke('billing:payments:list', token, invoiceId, studentId),
    },
    fees: {
      getSummary: (token: string, studentId: string): Promise<Result<any>> =>
        ipcRenderer.invoke('billing:fees:getSummary', token, studentId),
    },
  },
  reports: {
    getOccupancy: (token: string, hostelId?: string): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:getOccupancy', token, hostelId),
    getFeeDefaulters: (token: string, params?: any): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:getFeeDefaulters', token, params),
    getAttendanceAnalytics: (token: string, params: any): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:getAttendanceAnalytics', token, params),
    getGatePassRegister: (token: string, params?: any): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:getGatePassRegister', token, params),
    getMaintenance: (token: string, params?: any): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:getMaintenance', token, params),
    getDemographics: (token: string): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:getDemographics', token),
    getDashboardKpis: (token: string): Promise<Result<any>> =>
      ipcRenderer.invoke('reports:dashboardKpis', token),
    exportCsv: (token: string, reportType: string, params?: any): Promise<Result<string>> =>
      ipcRenderer.invoke('reports:exportCsv', token, reportType, params),
  },
  bulk: {
    createInvoices: (token: string, input: any): Promise<Result<any>> =>
      ipcRenderer.invoke('bulk:invoices:create', token, input),
    allocateBeds: (token: string, input: any): Promise<Result<any>> =>
      ipcRenderer.invoke('bulk:allocations:assign', token, input),
    markAttendance: (token: string, input: any): Promise<Result<any>> =>
      ipcRenderer.invoke('bulk:attendance:mark', token, input),
  },
  importExport: {
    previewStudentCsv: (token: string, csvContent: string): Promise<Result<any>> =>
      ipcRenderer.invoke('import:students:preview', token, csvContent),
    executeStudentImport: (token: string, rows: any[]): Promise<Result<any>> =>
      ipcRenderer.invoke('import:students:execute', token, rows),
    exportStudentsCsv: (token: string, params?: any): Promise<Result<string>> =>
      ipcRenderer.invoke('export:students:csv', token, params),
  },
  search: {
    global: (token: string, query: string): Promise<Result<any>> =>
      ipcRenderer.invoke('search:global', token, query),
  },
  backup: {
    create: (token: string, input?: any): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:create', token, input),
    list: (token: string): Promise<Result<any[]>> =>
      ipcRenderer.invoke('backup:list', token),
    delete: (token: string, filename: string): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:delete', token, filename),
    validate: (token: string, backupPath: string): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:validate', token, backupPath),
    restore: (token: string, input: any): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:restore', token, input),
    exportPortable: (token: string, input?: any): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:exportPortable', token, input),
    importPortable: (token: string, input: any): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:importPortable', token, input),
    getHealth: (token: string): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:getHealth', token),
    vacuum: (token: string): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:vacuum', token),
    getMigrationStatus: (token: string): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:getMigrationStatus', token),
    runMigrations: (token: string): Promise<Result<any>> =>
      ipcRenderer.invoke('backup:runMigrations', token),
  },
});

// Explicitly Isolated Student Prototype Contract
contextBridge.exposeInMainWorld('studentApi', {
  isPrototype: true,
  scope: 'STUDENT_SANDBOX_READONLY',
});
