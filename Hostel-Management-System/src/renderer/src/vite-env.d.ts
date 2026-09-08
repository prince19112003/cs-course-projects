/// <reference types="vite/client" />
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
  StudentDto,
  StudentDetailedDto,
  StudentDocumentDto,
  StudentSearchParams,
  CreateStudentInput,
  UpdateStudentInput,
  AttendanceDto,
  MarkAttendanceItem,
  AttendanceSummaryDto,
  GatePassDto,
  CreateGatePassInput,
  InvoiceDto,
  PaymentDto,
  CreateInvoiceInput,
  RecordPaymentInput,
  StudentFeeSummaryDto,
  ComplaintDto,
  CreateComplaintInput,
  NoticeDto,
  CreateNoticeInput,
  VisitorDto,
  RegisterVisitorInput,
  StaffDto,
  CreateStaffInput,
  RoomAssetDto,
  CreateRoomAssetInput,
  MessOptOutDto,
  BulkInvoiceInput,
  BulkInvoiceResult,
  BulkAllocationInput,
  BulkAllocationResult,
  BulkAttendanceInput,
  BulkAttendanceResult,
  OccupancyReportDto,
  FeeDefaultersReportDto,
  AttendanceAnalyticsReportDto,
  GatePassRegisterReportDto,
  MaintenanceAnalyticsReportDto,
  DemographicsReportDto,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportExecutionResult,
  BackupMetadata,
  BackupCreateInput,
  BackupCreateResult,
  RestoreInput,
  RestoreResult,
  PortableExportInput,
  PortableExportResult,
  PortableImportInput,
  PortableImportResult,
  DatabaseDiagnosticsDto,
  MigrationStatusDto,
  GlobalSearchResult,
  DashboardKpisDto,
} from '../../shared/types';

declare global {
  interface Window {
    desktopApi: {
      app: {
        getInfo: () => Promise<Result<AppInfo>>;
        minimize: () => Promise<Result<boolean>>;
        maximize: () => Promise<Result<boolean>>;
        close: () => Promise<Result<boolean>>;
        log: (level: 'INFO' | 'WARN' | 'ERROR', msg: string, details?: unknown) => Promise<Result<boolean>>;
      };
      system: {
        checkHealth: () => Promise<Result<{ status: string; storageOk: boolean }>>;
      };
      db: {
        checkHealth: () => Promise<Result<any>>;
        getStats: () => Promise<Result<any>>;
        getRoomMatrix: (hostelId?: string) => Promise<Result<any>>;
        searchStudents: (params: any) => Promise<Result<any>>;
      };
      auth: {
        checkSetup: () => Promise<Result<{ setupNeeded: boolean }>>;
        setup: (data: any) => Promise<Result<{ token: string; user: SessionUser }>>;
        login: (credentials: { identifier: string; password: string }) => Promise<Result<{ token: string; user: SessionUser }>>;
        logout: (token: string) => Promise<Result<boolean>>;
        getSession: (token: string) => Promise<Result<SessionUser>>;
        changePassword: (token: string, payload: { currentPassword: string; newPassword: string }) => Promise<Result<boolean>>;
      };
      users: {
        getPaginated: (token: string, params: any) => Promise<Result<{ data: UserDto[]; total: number }>>;
        create: (token: string, data: any) => Promise<Result<UserDto>>;
        update: (token: string, userId: string, data: any) => Promise<Result<UserDto>>;
        toggleStatus: (token: string, userId: string, isActive: boolean) => Promise<Result<boolean>>;
        resetPassword: (token: string, payload: { targetUserId: string; newPassword: string; adminConfirmationPassword: string }) => Promise<Result<boolean>>;
      };
      roles: {
        list: (token: string) => Promise<Result<{ roles: RoleDto[]; permissions: PermissionDto[] }>>;
        updatePermissions: (token: string, roleId: string, permissions: string[]) => Promise<Result<boolean>>;
      };
      audit: {
        list: (token: string, limit?: number) => Promise<Result<AuditLogDto[]>>;
      };
      hostels: {
        list: (token: string, includeInactive?: boolean) => Promise<Result<HostelDto[]>>;
        getById: (token: string, id: string) => Promise<Result<HostelDto | null>>;
        create: (token: string, data: any) => Promise<Result<HostelDto>>;
        update: (token: string, id: string, data: any) => Promise<Result<HostelDto>>;
        toggleStatus: (token: string, id: string, isActive: boolean) => Promise<Result<boolean>>;
      };
      blocks: {
        list: (token: string, hostelId?: string, includeInactive?: boolean) => Promise<Result<BlockDto[]>>;
        create: (token: string, data: any) => Promise<Result<BlockDto>>;
        update: (token: string, id: string, data: any) => Promise<Result<BlockDto>>;
        toggleStatus: (token: string, id: string, isActive: boolean) => Promise<Result<boolean>>;
      };
      floors: {
        list: (token: string, blockId?: string, includeInactive?: boolean) => Promise<Result<FloorDto[]>>;
        create: (token: string, data: any) => Promise<Result<FloorDto>>;
        update: (token: string, id: string, data: any) => Promise<Result<FloorDto>>;
        toggleStatus: (token: string, id: string, isActive: boolean) => Promise<Result<boolean>>;
      };
      rooms: {
        list: (token: string, params?: any) => Promise<Result<{ data: RoomDto[]; total: number }>>;
        getById: (token: string, id: string) => Promise<Result<RoomDto | null>>;
        create: (token: string, data: any) => Promise<Result<RoomDto>>;
        update: (token: string, id: string, data: any) => Promise<Result<RoomDto>>;
        toggleStatus: (token: string, id: string, status?: any, isArchived?: boolean) => Promise<Result<boolean>>;
      };
      beds: {
        list: (token: string, params?: any) => Promise<Result<BedDto[]>>;
        create: (token: string, data: any) => Promise<Result<BedDto>>;
        update: (token: string, id: string, data: any) => Promise<Result<BedDto>>;
        toggleStatus: (token: string, id: string, status?: any, isArchived?: boolean) => Promise<Result<boolean>>;
      };
      allocations: {
        list: (token: string, params?: any) => Promise<Result<{ data: AllocationDto[]; total: number }>>;
        history: (token: string, studentId?: string, bedId?: string) => Promise<Result<AllocationDto[]>>;
        create: (token: string, params: any) => Promise<Result<AllocationDto>>;
        transfer: (token: string, params: any) => Promise<Result<{ oldAllocation: AllocationDto; newAllocation: AllocationDto }>>;
        vacate: (token: string, params: any) => Promise<Result<AllocationDto>>;
        getDevStudents: (token: string) => Promise<Result<Array<{ id: string; name: string; enrollmentNumber: string; isAllocated: boolean }>>>;
      };
      occupancy: {
        getCampus: (token: string) => Promise<Result<OccupancyMetricsDto>>;
        getHostel: (token: string, hostelId: string) => Promise<Result<OccupancyMetricsDto>>;
        getRoom: (token: string, roomId: string) => Promise<Result<any>>;
      };
      students: {
        list: (token: string, params?: StudentSearchParams) => Promise<Result<{ data: StudentDto[]; total: number }>>;
        getById: (token: string, id: string) => Promise<Result<StudentDetailedDto>>;
        create: (token: string, input: CreateStudentInput) => Promise<Result<StudentDetailedDto>>;
        update: (token: string, id: string, updates: UpdateStudentInput) => Promise<Result<StudentDetailedDto>>;
        setStatus: (token: string, id: string, status: string, remarks?: string) => Promise<Result<StudentDetailedDto>>;
        bulkUpdateStatus: (token: string, studentIds: string[], status: string, remarks?: string) => Promise<Result<{ updatedCount: number }>>;
        uploadPhoto: (token: string, studentId: string, data: { base64: string; fileName: string }) => Promise<Result<{ photoPath: string }>>;
        uploadDocument: (token: string, studentId: string, data: { docType: string; fileName: string; base64: string }) => Promise<Result<StudentDocumentDto>>;
        deleteDocument: (token: string, studentId: string, docId: string) => Promise<Result<{ success: boolean }>>;
        openDocument: (token: string, docId: string) => Promise<Result<{ opened: boolean }>>;
        getAllocationHistory: (token: string, studentId: string) => Promise<Result<AllocationDto[]>>;
      };
      operations: {
        attendance: {
          mark: (token: string, date: string, items: MarkAttendanceItem[]) => Promise<Result<{ markedCount: number }>>;
          getByDate: (token: string, params: { date: string; hostelId?: string }) => Promise<Result<AttendanceDto[]>>;
          getSummary: (token: string, date: string, hostelId?: string) => Promise<Result<AttendanceSummaryDto>>;
        };
        gatePasses: {
          list: (token: string, params: { studentId?: string; status?: string; passType?: string; page?: number; pageSize?: number }) => Promise<Result<{ data: GatePassDto[]; total: number }>>;
          create: (token: string, input: CreateGatePassInput) => Promise<Result<GatePassDto>>;
          review: (token: string, id: string, status: 'approved' | 'rejected', notes?: string) => Promise<Result<GatePassDto>>;
          logMovement: (token: string, id: string, movement: 'exit' | 'return') => Promise<Result<GatePassDto>>;
        };
        complaints: {
          list: (token: string, params: { studentId?: string; roomId?: string; status?: string; category?: string; priority?: string; page?: number; pageSize?: number }) => Promise<Result<{ data: ComplaintDto[]; total: number }>>;
          create: (token: string, input: CreateComplaintInput) => Promise<Result<ComplaintDto>>;
          resolve: (token: string, id: string, status: 'in_progress' | 'resolved' | 'rejected', staffId?: string, notes?: string) => Promise<Result<ComplaintDto>>;
        };
        notices: {
          list: (token: string, params: { targetAudience?: string; blockId?: string; priority?: string; page?: number; pageSize?: number }) => Promise<Result<{ data: NoticeDto[]; total: number }>>;
          create: (token: string, input: CreateNoticeInput) => Promise<Result<NoticeDto>>;
          delete: (token: string, id: string) => Promise<Result<boolean>>;
        };
        visitors: {
          list: (token: string, params: { studentId?: string; date?: string; activeOnly?: boolean; page?: number; pageSize?: number }) => Promise<Result<{ data: VisitorDto[]; total: number }>>;
          register: (token: string, input: RegisterVisitorInput) => Promise<Result<VisitorDto>>;
          checkOut: (token: string, id: string) => Promise<Result<VisitorDto>>;
        };
        staff: {
          list: (token: string, params: { designation?: string; isActive?: boolean }) => Promise<Result<{ data: StaffDto[]; total: number }>>;
          create: (token: string, input: CreateStaffInput) => Promise<Result<StaffDto>>;
          toggleStatus: (token: string, id: string, isActive: boolean) => Promise<Result<boolean>>;
        };
        assets: {
          list: (token: string, roomId?: string) => Promise<Result<RoomAssetDto[]>>;
          create: (token: string, input: CreateRoomAssetInput) => Promise<Result<RoomAssetDto>>;
          update: (token: string, id: string, updates: Partial<CreateRoomAssetInput>) => Promise<Result<RoomAssetDto>>;
          delete: (token: string, id: string) => Promise<Result<boolean>>;
        };
        mess: {
          getOptOuts: (token: string, weekendStartDate: string) => Promise<Result<MessOptOutDto[]>>;
          recordOptOut: (token: string, studentId: string, weekendStartDate: string) => Promise<Result<MessOptOutDto>>;
          cancelOptOut: (token: string, studentId: string, weekendStartDate: string) => Promise<Result<boolean>>;
        };
      };
      billing: {
        invoices: {
          list: (token: string, params: { studentId?: string; status?: string; billingCycle?: string; page?: number; pageSize?: number }) => Promise<Result<{ data: InvoiceDto[]; total: number }>>;
          create: (token: string, input: CreateInvoiceInput) => Promise<Result<InvoiceDto>>;
          waive: (token: string, invoiceId: string, reason: string) => Promise<Result<InvoiceDto>>;
        };
        payments: {
          record: (token: string, input: RecordPaymentInput) => Promise<Result<PaymentDto>>;
          list: (token: string, invoiceId?: string, studentId?: string) => Promise<Result<PaymentDto[]>>;
        };
        fees: {
          getSummary: (token: string, studentId: string) => Promise<Result<StudentFeeSummaryDto>>;
        };
      };
      reports: {
        getOccupancy: (token: string, hostelId?: string) => Promise<Result<OccupancyReportDto>>;
        getFeeDefaulters: (token: string, params?: { minBalance?: number; billingCycle?: string }) => Promise<Result<FeeDefaultersReportDto>>;
        getAttendanceAnalytics: (token: string, params: { startDate: string; endDate: string; hostelId?: string; minAbsences?: number }) => Promise<Result<AttendanceAnalyticsReportDto>>;
        getGatePassRegister: (token: string, params?: { startDate?: number; endDate?: number; status?: string }) => Promise<Result<GatePassRegisterReportDto>>;
        getMaintenance: (token: string, params?: { startDate?: number; endDate?: number }) => Promise<Result<MaintenanceAnalyticsReportDto>>;
        getDemographics: (token: string) => Promise<Result<DemographicsReportDto>>;
        getDashboardKpis: (token: string) => Promise<Result<DashboardKpisDto>>;
        exportCsv: (token: string, reportType: string, params?: any) => Promise<Result<string>>;
      };
      bulk: {
        createInvoices: (token: string, input: BulkInvoiceInput) => Promise<Result<BulkInvoiceResult>>;
        allocateBeds: (token: string, input: BulkAllocationInput) => Promise<Result<BulkAllocationResult>>;
        markAttendance: (token: string, input: BulkAttendanceInput) => Promise<Result<BulkAttendanceResult>>;
      };
      importExport: {
        previewStudentCsv: (token: string, csvContent: string) => Promise<Result<ImportPreviewResult>>;
        executeStudentImport: (token: string, rows: ImportPreviewRow[]) => Promise<Result<ImportExecutionResult>>;
        exportStudentsCsv: (token: string, params?: StudentSearchParams) => Promise<Result<string>>;
      };
      search: {
        global: (token: string, query: string) => Promise<Result<GlobalSearchResult>>;
      };
      backup: {
        create: (token: string, input?: BackupCreateInput) => Promise<Result<BackupCreateResult>>;
        list: (token: string) => Promise<Result<BackupMetadata[]>>;
        delete: (token: string, filename: string) => Promise<Result<boolean>>;
        validate: (token: string, backupPath: string) => Promise<Result<boolean>>;
        restore: (token: string, input: RestoreInput) => Promise<Result<RestoreResult>>;
        exportPortable: (token: string, input?: PortableExportInput) => Promise<Result<PortableExportResult>>;
        importPortable: (token: string, input: PortableImportInput) => Promise<Result<PortableImportResult>>;
        getHealth: (token: string) => Promise<Result<DatabaseDiagnosticsDto>>;
        vacuum: (token: string) => Promise<Result<{ freedBytesEstimate: number }>>;
        getMigrationStatus: (token: string) => Promise<Result<MigrationStatusDto>>;
        runMigrations: (token: string) => Promise<Result<{ appliedCount: number }>>;
      };
    };
    studentApi: {
      isPrototype: boolean;
      scope: string;
    };
  }
}
