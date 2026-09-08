export interface AppInfo {
  version: string;
  name: string;
  isPackaged: boolean;
  platform: string;
  appDataPath: string;
}

export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  timestamp: string;
}

export interface DatabaseHealthInfo {
  ok: boolean;
  journalMode: string;
  foreignKeys: boolean;
  integrity: string;
  appliedMigrations: string[];
  dbPath: string;
  error?: string;
}

export interface DatabaseStats {
  totalHostels: number;
  totalBlocks: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  totalStudents: number;
}

export interface StudentRecord {
  id: string;
  enrollmentNumber: string;
  nationalId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  email: string;
  phone: string;
  course: string;
  department: string;
  academicYear: number;
  admissionDate: string;
  permanentAddress: string;
  currentAddress?: string | null;
  photoPath?: string | null;
  assignedBedId?: string | null;
  status: string;
  feeStatus: string;
  createdAt: number;
  updatedAt: number;
}

export interface BedRecord {
  id: string;
  roomId: string;
  bedLabel: string;
  status: string;
  isArchived: number;
  createdAt: number;
  updatedAt: number;
}

export interface RoomRecord {
  id: string;
  floorId: string;
  roomNumber: string;
  capacity: number;
  roomType: string;
  acType: string;
  monthlyRent: number;
  status: string;
  isArchived: number;
  createdAt: number;
  updatedAt: number;
  beds: BedRecord[];
}

export interface BlockRecord {
  id: string;
  hostelId: string;
  name: string;
  code: string;
  totalFloors: number;
  isActive: number;
  createdAt: number;
  updatedAt: number;
  rooms: RoomRecord[];
}

// ============================================================================
// Authentication, Admin & Access Control Types
// ============================================================================

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  assignedHostelIds?: string[];
  permissions: string[];
  forcePasswordChange: boolean;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: number;
  forcePasswordChange: number;
  lastLoginAt?: number | null;
  createdAt: number;
  updatedAt: number;
  assignedHostels?: string[];
}

export interface RoleDto {
  id: string;
  name: string;
  description?: string | null;
  isSystemRole: number;
  createdAt: number;
  permissions?: string[];
}

export interface PermissionDto {
  code: string;
  module: string;
  description: string;
  name?: string;
}

export interface AuditLogDto {
  id: string;
  userId?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipHostname?: string | null;
  createdAt: number;
}

// ============================================================================
// Infrastructure & Bed Allocation Types
// ============================================================================

export interface HostelDto {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  genderType: 'boys' | 'girls' | 'coed';
  wardenId?: string | null;
  totalCapacity: number;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

export interface BlockDto {
  id: string;
  hostelId: string;
  name: string;
  code: string;
  totalFloors: number;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

export interface FloorDto {
  id: string;
  blockId: string;
  floorNumber: number;
  name: string;
  isActive: number;
  createdAt: number;
}

export interface RoomDto {
  id: string;
  floorId: string;
  roomNumber: string;
  capacity: number;
  roomType: 'single' | 'double' | 'triple' | 'dormitory';
  acType: 'ac' | 'non_ac';
  monthlyRent: number;
  status: 'available' | 'full' | 'maintenance' | 'decommissioned';
  isArchived: number;
  createdAt: number;
  updatedAt: number;
}

export interface BedDto {
  id: string;
  roomId: string;
  bedLabel: string;
  status: 'vacant' | 'occupied' | 'maintenance' | 'decommissioned';
  isArchived: number;
  createdAt: number;
  updatedAt: number;
}

export interface AllocationDto {
  id: string;
  studentId: string;
  bedId: string;
  allocatedAt: number;
  vacatedAt?: number | null;
  allocationType: 'fresh_admission' | 'requested_transfer' | 'administrative_transfer';
  status: 'active' | 'transferred' | 'vacated';
  allocatedBy: string;
  remarks?: string | null;
  studentName?: string;
  enrollmentNumber?: string;
  studentPhone?: string;
  bedLabel?: string;
  roomNumber?: string;
  floorName?: string;
  blockName?: string;
  hostelName?: string;
  hostelId?: string;
  allocatedByName?: string;
}

export interface OccupancyMetricsDto {
  totalHostels?: number;
  totalBlocks?: number;
  totalFloors?: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  maintenanceBeds: number;
  occupancyPercentage: number;
}

// ============================================================================
// Student Management & Dossier Types
// ============================================================================

export interface GuardianDto {
  id: string;
  studentId: string;
  name: string;
  relationship: 'father' | 'mother' | 'guardian';
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  isPrimary: number;
}

export interface StudentDocumentDto {
  id: string;
  studentId: string;
  docType: 'id_proof' | 'admission_agreement' | 'medical_clearance' | 'undertaking' | 'other';
  fileName: string;
  filePath: string;
  fileHash: string;
  uploadedAt: number;
}

export interface StudentDto {
  id: string;
  enrollmentNumber: string;
  nationalId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string | null;
  email: string;
  phone: string;
  course: string;
  department: string;
  academicYear: number;
  admissionDate: string; // YYYY-MM-DD
  permanentAddress: string;
  currentAddress?: string | null;
  photoPath?: string | null;
  assignedBedId?: string | null;
  status: 'active' | 'inactive' | 'left' | 'graduated' | 'vacated' | 'expelled' | 'suspended';
  feeStatus: 'paid' | 'pending' | 'overdue';
  createdAt: number;
  updatedAt: number;

  // Enriched spatial fields if joined
  bedLabel?: string;
  roomNumber?: string;
  floorName?: string;
  blockName?: string;
  hostelName?: string;
  hostelId?: string;
}

export interface StudentDetailedDto extends StudentDto {
  guardians: GuardianDto[];
  documents: StudentDocumentDto[];
  activeAllocation?: AllocationDto | null;
  allocationHistory?: AllocationDto[];
}

export interface StudentSearchParams {
  query?: string;
  status?: string;
  gender?: string;
  course?: string;
  department?: string;
  academicYear?: number;
  hostelId?: string;
  allocationStatus?: 'all' | 'allocated' | 'unallocated';
  page?: number;
  pageSize?: number;
  sortBy?: 'firstName' | 'lastName' | 'enrollmentNumber' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateGuardianInput {
  name: string;
  relationship: 'father' | 'mother' | 'guardian';
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  isPrimary?: boolean;
}

export interface CreateStudentInput {
  enrollmentNumber: string;
  nationalId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  email: string;
  phone: string;
  course: string;
  department: string;
  academicYear: number;
  admissionDate: string;
  permanentAddress: string;
  currentAddress?: string;
  photoPath?: string;
  status?: 'active' | 'inactive' | 'left' | 'graduated' | 'vacated' | 'expelled' | 'suspended';
  feeStatus?: 'paid' | 'pending' | 'overdue';
  guardians?: CreateGuardianInput[];
  initialBedId?: string; // Optional initial bed allocation on registration
}

export interface UpdateStudentInput {
  enrollmentNumber?: string;
  nationalId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  email?: string;
  phone?: string;
  course?: string;
  department?: string;
  academicYear?: number;
  admissionDate?: string;
  permanentAddress?: string;
  currentAddress?: string;
  photoPath?: string;
  status?: 'active' | 'inactive' | 'left' | 'graduated' | 'vacated' | 'expelled' | 'suspended';
  feeStatus?: 'paid' | 'pending' | 'overdue';
  guardians?: Array<CreateGuardianInput & { id?: string }>;
}

// ============================================================================
// Core Hostel Operations & Services Types
// ============================================================================

export interface AttendanceDto {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'approved_leave' | 'late';
  recordedBy: string;
  remarks?: string | null;
  recordedAt: number;
  studentName?: string;
  enrollmentNumber?: string;
  roomNumber?: string;
  bedLabel?: string;
  hostelName?: string;
}

export interface MarkAttendanceItem {
  studentId: string;
  status: 'present' | 'absent' | 'approved_leave' | 'late';
  remarks?: string;
}

export interface AttendanceSummaryDto {
  date: string;
  totalResidents: number;
  present: number;
  absent: number;
  approvedLeave: number;
  late: number;
  unmarked: number;
}

export interface GatePassDto {
  id: string;
  studentId: string;
  passType: 'day_out' | 'night_out' | 'vacation' | 'emergency';
  reason: string;
  destination: string;
  departureTime: number;
  expectedReturnTime: number;
  actualExitTime?: number | null;
  actualReturnTime?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'active_out' | 'closed' | 'overdue';
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  createdAt: number;
  studentName?: string;
  enrollmentNumber?: string;
  studentPhone?: string;
  roomNumber?: string;
  reviewerName?: string;
}

export interface CreateGatePassInput {
  studentId: string;
  passType: 'day_out' | 'night_out' | 'vacation' | 'emergency';
  reason: string;
  destination: string;
  departureTime: number;
  expectedReturnTime: number;
}

export interface InvoiceDto {
  id: string;
  studentId: string;
  billingCycle: string; // 'YYYY-MM'
  description: string;
  amountDue: number;
  amountPaid: number;
  dueDate: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  createdAt: number;
  studentName?: string;
  enrollmentNumber?: string;
  roomNumber?: string;
}

export interface PaymentDto {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  paymentMode: 'cash' | 'bank_transfer' | 'cheque' | 'pos_card';
  referenceNumber?: string | null;
  collectedBy: string;
  paymentDate: number;
  receiptNumber: string;
  createdAt: number;
  collectorName?: string;
}

export interface CreateInvoiceInput {
  studentId: string;
  billingCycle: string;
  description: string;
  amountDue: number;
  dueDate: number;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMode: 'cash' | 'bank_transfer' | 'cheque' | 'pos_card';
  referenceNumber?: string;
}

export interface StudentFeeSummaryDto {
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  invoices: InvoiceDto[];
  payments: PaymentDto[];
}

export interface ComplaintDto {
  id: string;
  studentId: string;
  roomId: string;
  category: 'electrical' | 'plumbing' | 'carpentry' | 'masonry' | 'cleaning' | 'other';
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  assignedStaffId?: string | null;
  resolutionNotes?: string | null;
  createdAt: number;
  resolvedAt?: number | null;
  studentName?: string;
  roomNumber?: string;
  assignedStaffName?: string;
}

export interface CreateComplaintInput {
  studentId: string;
  roomId: string;
  category: 'electrical' | 'plumbing' | 'carpentry' | 'masonry' | 'cleaning' | 'other';
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'urgent';
}

export interface NoticeDto {
  id: string;
  title: string;
  content: string;
  targetAudience: 'all' | 'boys_only' | 'girls_only' | 'block_specific';
  blockId?: string | null;
  priority: 'normal' | 'urgent' | 'critical';
  publishedBy: string;
  isPinned: number;
  expiresAt?: number | null;
  createdAt: number;
  publisherName?: string;
  blockName?: string;
}

export interface CreateNoticeInput {
  title: string;
  content: string;
  targetAudience?: 'all' | 'boys_only' | 'girls_only' | 'block_specific';
  blockId?: string;
  priority?: 'normal' | 'urgent' | 'critical';
  isPinned?: boolean;
  expiresAt?: number;
}

export interface VisitorDto {
  id: string;
  visitorName: string;
  phone: string;
  relationship: string;
  studentId: string;
  idProofDetails: string;
  purpose: string;
  checkInTime: number;
  checkOutTime?: number | null;
  gateOfficerId: string;
  studentName?: string;
  enrollmentNumber?: string;
  gateOfficerName?: string;
}

export interface RegisterVisitorInput {
  visitorName: string;
  phone: string;
  relationship: string;
  studentId: string;
  idProofDetails: string;
  purpose: string;
}

export interface StaffDto {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  designation: 'chief_warden' | 'warden' | 'security' | 'maintenance' | 'caretaker';
  isActive: number;
  createdAt: number;
}

export interface CreateStaffInput {
  name: string;
  phone: string;
  email?: string;
  designation: 'chief_warden' | 'warden' | 'security' | 'maintenance' | 'caretaker';
}

export interface RoomAssetDto {
  id: string;
  roomId: string;
  assetName: string;
  serialNumber?: string | null;
  condition: 'new' | 'good' | 'damaged' | 'condemned';
  createdAt: number;
  roomNumber?: string;
}

export interface CreateRoomAssetInput {
  roomId: string;
  assetName: string;
  serialNumber?: string;
  condition?: 'new' | 'good' | 'damaged' | 'condemned';
}

export interface MessOptOutDto {
  id: string;
  studentId: string;
  weekendStartDate: string; // 'YYYY-MM-DD'
  createdAt: number;
  studentName?: string;
  enrollmentNumber?: string;
  roomNumber?: string;
}

// ============================================================================
// Reporting, Bulk Operations & Data Tools Types
// ============================================================================

// Bulk Operations
export interface BulkInvoiceInput {
  target: 'all' | 'all_active' | 'hostel';
  hostelId?: string;
  billingCycle: string; // 'YYYY-MM'
  description: string;
  amountDue: number;
  dueDate?: number;
}

export interface BulkInvoiceResult {
  totalTargeted?: number;
  generatedCount: number;
  skippedCount: number;
  totalAmountInvoiced: number;
  invoices: InvoiceDto[];
}

export interface BulkBedAssignmentItem {
  studentId: string;
  bedId: string;
  academicYear?: string;
}

export interface BulkAllocationInput {
  assignments: BulkBedAssignmentItem[];
}

export interface BulkAllocationResult {
  successCount: number;
  failureCount: number;
  allocatedBedIds?: string[];
  allocations: AllocationDto[];
  errors: Array<{ studentId: string; bedId: string; error: string }>;
}

export interface BulkAttendanceRecordItem {
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'approved_leave';
  remarks?: string;
}

export interface BulkAttendanceInput {
  date: string;
  hostelId?: string;
  studentIds?: string[];
  defaultStatus?: 'present' | 'absent';
  markAllPresent?: boolean;
  records?: BulkAttendanceRecordItem[];
  exceptions?: BulkAttendanceRecordItem[];
}

export interface BulkAttendanceResult {
  date?: string;
  markedCount: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
}

// Institutional Reports
export interface OccupancyReportItem {
  hostelId: string;
  hostelName: string;
  hostelCode: string;
  genderType: string;
  totalBlocks: number;
  totalRooms: number;
  totalCapacity: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number; // Percentage 0 - 100
}

export interface OccupancyReportDto {
  campusTotalCapacity: number;
  campusOccupiedBeds: number;
  campusVacantBeds: number;
  campusOccupancyRate: number;
  hostels: OccupancyReportItem[];
}

export interface FeeDefaulterItem {
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  phone: string;
  hostelName?: string;
  roomNumber?: string;
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
  oldestOverdueCycle?: string;
}

export interface FeeDefaultersReportDto {
  totalDefaulters: number;
  totalOutstandingAmount: number;
  defaulters: FeeDefaulterItem[];
}

export interface ChronicAbsenteeItem {
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  hostelName?: string;
  roomNumber?: string;
  totalDaysRecorded: number;
  absentDays: number;
  absentRate: number;
}

export interface AttendanceAnalyticsReportDto {
  dateRange: { startDate: string; endDate: string };
  overallAttendanceRate: number;
  totalPresentMarks: number;
  totalAbsentMarks: number;
  totalLeaveMarks: number;
  chronicAbsentees: ChronicAbsenteeItem[];
}

export interface GatePassRegisterItem {
  id: string;
  studentName: string;
  enrollmentNumber: string;
  passType: string;
  reason: string;
  destination: string;
  departureTime: number;
  expectedReturnTime: number;
  actualExitTime?: number | null;
  actualReturnTime?: number | null;
  status: string;
  isOverdue: boolean;
}

export interface GatePassRegisterReportDto {
  totalPasses: number;
  activeOutCount: number;
  overdueCount: number;
  passes: GatePassRegisterItem[];
}

export interface MaintenanceReportItem {
  category: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionHours: number;
}

export interface MaintenanceAnalyticsReportDto {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  categories: MaintenanceReportItem[];
}

export interface DemographicsReportDto {
  totalResidents: number;
  byGender: Record<string, number>;
  byCourse: Record<string, number>;
  byDepartment: Record<string, number>;
  byAcademicYear: Record<number, number>;
}

// Data Import & Export
export interface ImportPreviewRow {
  rowNumber: number;
  enrollmentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  course: string;
  department: string;
  academicYear: number;
  isValid: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  previewRows: ImportPreviewRow[];
  hasCollisions: boolean;
}

export interface ImportExecutionResult {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

// ============================================================================
// Backup, Restore & Data Portability Types
// ============================================================================

export interface BackupMetadata {
  filename: string;
  filePath: string;
  sizeBytes: number;
  createdAt: number;
  backupType: 'manual' | 'auto' | 'pre_restore' | 'pre_migration';
  label?: string;
  schemaVersion: number;
  appVersion: string;
  checksum: string;
  isValid: boolean;
  validationError?: string;
  metrics?: {
    studentsCount: number;
    hostelsCount: number;
    roomsCount: number;
    bedsCount: number;
    allocationsCount: number;
    invoicesCount: number;
    usersCount: number;
    [key: string]: number;
  };
}

export interface BackupCreateInput {
  label?: string;
  targetPath?: string;
}

export interface BackupCreateResult {
  success: boolean;
  backup: BackupMetadata;
}

export interface RestoreInput {
  backupFilePath: string;
  adminPassword?: string;
  force?: boolean;
}

export interface RestoreResult {
  success: boolean;
  safetyBackupPath: string;
  restoredAt: number;
  schemaVersion: number;
  recordCounts: Record<string, number>;
}

export interface PortableExportInput {
  targetPath?: string;
  includeCredentials?: boolean;
  includeAttachments?: boolean;
}

export interface PortableExportResult {
  success: boolean;
  packagePath: string;
  manifest: any;
  sizeBytes: number;
}

export interface PortableImportInput {
  packagePath: string;
  strategy: 'full_overwrite' | 'branch_merge';
  conflictPolicy?: 'skip' | 'overwrite';
}

export interface PortableImportResult {
  success: boolean;
  importedRecords: Record<string, number>;
  conflictsResolved?: number;
  safetyBackupPath: string;
}

export interface DatabaseDiagnosticsDto {
  ok: boolean;
  integrity: string;
  foreignKeysOk: boolean;
  journalMode: string;
  tableCounts: Record<string, number>;
  sizeBytes: number;
  dbPath: string;
  driver: string;
  appliedMigrationsCount: number;
}

export interface MigrationStatusDto {
  currentVersion: number;
  appliedMigrations: string[];
  pendingMigrations: string[];
}

// ============================================================================
// Global Search & Live System KPIs
// ============================================================================

export interface GlobalSearchResultItem {
  id: string;
  category:
    | 'students'
    | 'hostels'
    | 'blocks'
    | 'floors'
    | 'rooms'
    | 'beds'
    | 'staff'
    | 'complaints'
    | 'visitors'
    | 'fees'
    | 'notices'
    | 'inventory';
  title: string;
  subtitle: string;
  status?: string;
  metadata?: Record<string, any>;
}

export interface GlobalSearchResult {
  query: string;
  total: number;
  results: GlobalSearchResultItem[];
}

export interface DashboardKpisDto {
  totalStudents: number;
  activeResidents: number;
  totalHostels: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  todayPresentCount: number;
  todayAbsentCount: number;
  todayAttendanceRate: number;
  activeGatePassesCount: number;
  overdueGatePassesCount: number;
  pendingComplaintsCount: number;
  resolvedComplaintsCount: number;
  totalRevenueInvoiced: number;
  totalRevenueCollected: number;
  totalPendingFees: number;
  activeNoticesCount: number;
}

