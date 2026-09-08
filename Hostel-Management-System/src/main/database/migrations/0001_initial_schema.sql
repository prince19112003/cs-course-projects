-- 0001_initial_schema.sql
-- Complete offline relational schema for Nexus Enterprise Hostel Management System

-- 1. Schema Migrations Table
CREATE TABLE IF NOT EXISTS __nexus_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);

-- 2. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at INTEGER NOT NULL
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'warden', 'accountant', 'staff', 'data_entry', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  force_password_change INTEGER NOT NULL DEFAULT 0,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 4. Institutions Table
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  currency_symbol TEXT DEFAULT '$',
  logo_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 5. Hostels Table
CREATE TABLE IF NOT EXISTS hostels (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  gender_type TEXT NOT NULL CHECK(gender_type IN ('boys', 'girls', 'coed')),
  warden_id TEXT REFERENCES users(id),
  total_capacity INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hostels_code ON hostels(code);
CREATE INDEX IF NOT EXISTS idx_hostels_active ON hostels(is_active);

-- 6. Blocks Table
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  hostel_id TEXT NOT NULL REFERENCES hostels(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  total_floors INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(hostel_id, code)
);
CREATE INDEX IF NOT EXISTS idx_blocks_hostel ON blocks(hostel_id);

-- 7. Floors Table
CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE RESTRICT,
  floor_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(block_id, floor_number)
);
CREATE INDEX IF NOT EXISTS idx_floors_block ON floors(block_id);

-- 8. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
  room_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity > 0),
  room_type TEXT NOT NULL CHECK(room_type IN ('single', 'double', 'triple', 'dormitory')),
  ac_type TEXT NOT NULL CHECK(ac_type IN ('ac', 'non_ac')) DEFAULT 'non_ac',
  monthly_rent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('available', 'full', 'maintenance', 'decommissioned')) DEFAULT 'available',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(floor_id, room_number)
);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(room_number);

-- 9. Beds Table
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  bed_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('vacant', 'occupied', 'maintenance', 'decommissioned')) DEFAULT 'vacant',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(room_id, bed_label)
);
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);

-- 10. Room Assets Table
CREATE TABLE IF NOT EXISTS room_assets (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  asset_name TEXT NOT NULL,
  serial_number TEXT UNIQUE,
  condition TEXT NOT NULL CHECK(condition IN ('new', 'good', 'damaged', 'condemned')) DEFAULT 'good',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_assets_room ON room_assets(room_id);

-- 11. Students Table
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  enrollment_number TEXT NOT NULL UNIQUE,
  national_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male', 'female', 'other')),
  blood_group TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  course TEXT NOT NULL,
  department TEXT NOT NULL,
  academic_year INTEGER NOT NULL,
  admission_date TEXT NOT NULL,
  permanent_address TEXT NOT NULL,
  current_address TEXT,
  photo_path TEXT,
  assigned_bed_id TEXT REFERENCES beds(id),
  status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'left', 'graduated', 'vacated', 'expelled', 'suspended')) DEFAULT 'active',
  fee_status TEXT NOT NULL CHECK(fee_status IN ('paid', 'pending', 'overdue')) DEFAULT 'paid',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_students_search ON students(status, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollment_number);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_bed ON students(assigned_bed_id);

-- 12. Guardians Table
CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  address TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_guardians_student ON guardians(student_id);

-- 13. Student Documents Table
CREATE TABLE IF NOT EXISTS student_documents (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK(doc_type IN ('id_proof', 'admission_agreement', 'medical_clearance', 'undertaking')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_student_docs_student ON student_documents(student_id);

-- 14. Allocations Table & Enforced Partial Unique Indexes
CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  allocated_at INTEGER NOT NULL,
  vacated_at INTEGER,
  allocation_type TEXT NOT NULL CHECK(allocation_type IN ('fresh_admission', 'requested_transfer', 'administrative_transfer')),
  status TEXT NOT NULL CHECK(status IN ('active', 'transferred', 'vacated')) DEFAULT 'active',
  allocated_by TEXT NOT NULL REFERENCES users(id),
  remarks TEXT
);
CREATE INDEX IF NOT EXISTS idx_alloc_student ON allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_alloc_bed ON allocations(bed_id);
CREATE INDEX IF NOT EXISTS idx_alloc_status ON allocations(status);

-- Enforce ONE ACTIVE ALLOCATION PER STUDENT
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_student_alloc 
ON allocations(student_id) 
WHERE status = 'active';

-- Enforce ONE ACTIVE ALLOCATION PER BED
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_bed_alloc 
ON allocations(bed_id) 
WHERE status = 'active';

-- 15. Staff Table
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  designation TEXT NOT NULL CHECK(designation IN ('chief_warden', 'warden', 'security', 'maintenance', 'caretaker')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 16. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'approved_leave', 'late')) DEFAULT 'present',
  recorded_by TEXT NOT NULL REFERENCES users(id),
  remarks TEXT,
  recorded_at INTEGER NOT NULL,
  UNIQUE(date, student_id)
);
CREATE INDEX IF NOT EXISTS idx_att_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id);

-- 17. Gate Passes Table
CREATE TABLE IF NOT EXISTS gate_passes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  pass_type TEXT NOT NULL CHECK(pass_type IN ('day_out', 'night_out', 'vacation', 'emergency')),
  reason TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time INTEGER NOT NULL,
  expected_return_time INTEGER NOT NULL,
  actual_exit_time INTEGER,
  actual_return_time INTEGER,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'active_out', 'closed', 'overdue')) DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  review_notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gatepasses_student ON gate_passes(student_id);
CREATE INDEX IF NOT EXISTS idx_gatepasses_status ON gate_passes(status);

-- 18. Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK(category IN ('electrical', 'plumbing', 'carpentry', 'masonry', 'cleaning', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'urgent')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK(status IN ('open', 'in_progress', 'resolved', 'rejected')) DEFAULT 'open',
  assigned_staff_id TEXT REFERENCES staff(id),
  resolution_notes TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_room ON complaints(room_id);

-- 19. Mess Opt-Outs Table
CREATE TABLE IF NOT EXISTS mess_opt_outs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  weekend_start_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(student_id, weekend_start_date)
);
CREATE INDEX IF NOT EXISTS idx_mess_opt_student ON mess_opt_outs(student_id);

-- 20. Notices Table
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT NOT NULL CHECK(target_audience IN ('all', 'boys_only', 'girls_only', 'block_specific')) DEFAULT 'all',
  block_id TEXT REFERENCES blocks(id),
  priority TEXT NOT NULL CHECK(priority IN ('normal', 'urgent', 'critical')) DEFAULT 'normal',
  published_by TEXT NOT NULL REFERENCES users(id),
  is_pinned INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 21. Visitors Table
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  id_proof_details TEXT NOT NULL,
  purpose TEXT NOT NULL,
  check_in_time INTEGER NOT NULL,
  check_out_time INTEGER,
  gate_officer_id TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_visitors_student ON visitors(student_id);
CREATE INDEX IF NOT EXISTS idx_visitors_checkin ON visitors(check_in_time);

-- 22. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  billing_cycle TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_due INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  due_date INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('unpaid', 'partially_paid', 'paid', 'cancelled')) DEFAULT 'unpaid',
  created_at INTEGER NOT NULL,
  UNIQUE(student_id, billing_cycle)
);
CREATE INDEX IF NOT EXISTS idx_invoices_cycle_status ON invoices(billing_cycle, status);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);

-- 23. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK(amount > 0),
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash', 'bank_transfer', 'cheque', 'pos_card')),
  reference_number TEXT,
  collected_by TEXT NOT NULL REFERENCES users(id),
  payment_date INTEGER NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- 24. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  changes_summary TEXT,
  ip_hostname TEXT DEFAULT 'localhost',
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- 25. Import Export History Table
CREATE TABLE IF NOT EXISTS import_export_history (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('EXPORT', 'IMPORT')),
  package_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')),
  executed_by TEXT NOT NULL REFERENCES users(id),
  checksum TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

-- 26. Room Capacity Trigger Guard
CREATE TRIGGER IF NOT EXISTS trg_check_room_capacity_before_insert
BEFORE INSERT ON beds
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM beds WHERE room_id = NEW.room_id AND is_archived = 0) >= 
         (SELECT capacity FROM rooms WHERE id = NEW.room_id)
    THEN RAISE(ABORT, 'ROOM_CAPACITY_EXCEEDED: Cannot add more beds than configured room capacity.')
  END;
END;
