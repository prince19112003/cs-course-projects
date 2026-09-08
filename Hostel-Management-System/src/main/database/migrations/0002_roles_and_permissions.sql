-- ============================================================================
-- Migration: 0002_roles_and_permissions.sql
-- Description: Dynamic Roles, Permissions, Role-Permission mappings, and User Hostels
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id);

CREATE TABLE IF NOT EXISTS user_hostels (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hostel_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, hostel_id)
);

CREATE INDEX IF NOT EXISTS idx_user_hostels_user ON user_hostels(user_id);

-- ----------------------------------------------------------------------------
-- Seed Default System Roles
-- ----------------------------------------------------------------------------
INSERT OR IGNORE INTO roles (id, name, description, is_system_role, created_at) VALUES
  ('super_admin', 'Super Administrator', 'Master administrator with full system and administrative control', 1, 1700000000000),
  ('admin', 'Administrator', 'Institutional operations manager with user administration access', 1, 1700000000000),
  ('warden', 'Hostel Warden', 'Residential manager handling student allocations, roll call, gate passes and complaints', 1, 1700000000000),
  ('staff', 'Maintenance Supervisor', 'Maintenance staff handling physical room tickets and complaints', 1, 1700000000000),
  ('data_entry', 'Data Entry Operator', 'Front-desk operator handling rapid student dossiers and roll-call entry', 1, 1700000000000),
  ('viewer', 'Auditor / Viewer', 'Auditor with read-only inspection access across operations and reports', 1, 1700000000000);

-- ----------------------------------------------------------------------------
-- Seed Granular Permissions Registry
-- ----------------------------------------------------------------------------
INSERT OR IGNORE INTO permissions (code, module, description) VALUES
  ('*', 'system', 'Unrestricted master access across all modules'),
  ('students:view', 'students', 'View Student Directory & Dossiers'),
  ('students:create', 'students', 'Register New Student'),
  ('students:edit', 'students', 'Update Student Details'),
  ('students:archive', 'students', 'Deactivate or Graduate Student'),
  ('students:delete', 'students', 'Permanently Delete Errant Student Record'),
  ('allocations:view', 'allocations', 'View Room and Bed Allocation Records'),
  ('allocations:manage', 'allocations', 'Assign, Transfer, and Vacate Beds'),
  ('rooms:view', 'infrastructure', 'View Room Matrix & Occupancy Layout'),
  ('rooms:manage', 'infrastructure', 'Configure Hostels, Blocks, Floors, Rooms and Beds'),
  ('attendance:view', 'operations', 'View Roll Call and Attendance Registers'),
  ('attendance:mark', 'operations', 'Record Nightly Roll Call'),
  ('attendance:override', 'operations', 'Retroactively Modify Historical Attendance'),
  ('gatepass:view', 'operations', 'View Out-Pass and Leave Requests'),
  ('gatepass:approve', 'operations', 'Approve or Reject Student Gate Passes'),
  ('complaints:view', 'operations', 'View Maintenance Complaints and Tickets'),
  ('complaints:resolve', 'operations', 'Assign Technician and Resolve Complaints'),
  ('mess:view', 'operations', 'View Mess Menus and Opt-Out Headcounts'),
  ('mess:manage', 'operations', 'Configure Mess Menus and Meal Schedules'),
  ('notices:view', 'operations', 'View Announcements and Circulars'),
  ('notices:publish', 'operations', 'Publish and Manage Notice Board Announcements'),
  ('billing:view', 'billing', 'View Fee Schedules, Invoices and Ledgers'),
  ('billing:run', 'billing', 'Execute Batch Monthly Auto-Billing'),
  ('billing:collect', 'billing', 'Record Fee Payments and Issue Receipts'),
  ('billing:waive', 'billing', 'Waive or Cancel Student Invoices'),
  ('reports:view', 'reports', 'View Analytics and Operational Summaries'),
  ('reports:export', 'reports', 'Generate and Stream CSV/PDF Reports'),
  ('users:view', 'admin', 'View System Operator List'),
  ('users:manage', 'admin', 'Create Operators, Assign Roles and Reset Passwords'),
  ('roles:view', 'admin', 'Inspect Roles and Assigned Permissions'),
  ('roles:manage', 'admin', 'Configure Custom Roles and Permission Mappings'),
  ('settings:manage', 'admin', 'Update System Configurations and Institution Profile'),
  ('audit:view', 'admin', 'Inspect Immutable Operational and Security Audit Logs'),
  ('backup:create', 'system', 'Create Local Database Backups'),
  ('backup:restore', 'system', 'Restore System from Local Backup Snapshot'),
  ('data:transfer', 'system', 'Export and Import Secure .nexus Packages');

-- ----------------------------------------------------------------------------
-- Seed Role-Permission Associations
-- ----------------------------------------------------------------------------
-- 1. Super Admin: Wildcard
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('super_admin', '*');

-- 2. Administrator
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('admin', 'students:view'), ('admin', 'students:create'), ('admin', 'students:edit'), ('admin', 'students:archive'),
  ('admin', 'allocations:view'), ('admin', 'allocations:manage'),
  ('admin', 'rooms:view'), ('admin', 'rooms:manage'),
  ('admin', 'attendance:view'), ('admin', 'attendance:mark'),
  ('admin', 'gatepass:view'), ('admin', 'gatepass:approve'),
  ('admin', 'complaints:view'), ('admin', 'complaints:resolve'),
  ('admin', 'mess:view'), ('admin', 'mess:manage'),
  ('admin', 'notices:view'), ('admin', 'notices:publish'),
  ('admin', 'billing:view'), ('admin', 'billing:run'), ('admin', 'billing:collect'),
  ('admin', 'reports:view'), ('admin', 'reports:export'),
  ('admin', 'users:view'), ('admin', 'users:manage'),
  ('admin', 'roles:view'), ('admin', 'settings:manage'),
  ('admin', 'audit:view'), ('admin', 'backup:create');

-- 3. Warden
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('warden', 'students:view'), ('warden', 'students:create'), ('warden', 'students:edit'),
  ('warden', 'allocations:view'), ('warden', 'allocations:manage'),
  ('warden', 'rooms:view'),
  ('warden', 'attendance:view'), ('warden', 'attendance:mark'),
  ('warden', 'gatepass:view'), ('warden', 'gatepass:approve'),
  ('warden', 'complaints:view'), ('warden', 'complaints:resolve'),
  ('warden', 'mess:view'),
  ('warden', 'notices:view'), ('warden', 'notices:publish'),
  ('warden', 'reports:view');

-- 4. Staff / Maintenance
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('staff', 'rooms:view'),
  ('staff', 'complaints:view'), ('staff', 'complaints:resolve'),
  ('staff', 'notices:view');

-- 5. Data Entry Operator
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('data_entry', 'students:view'), ('data_entry', 'students:create'), ('data_entry', 'students:edit'),
  ('data_entry', 'allocations:view'),
  ('data_entry', 'rooms:view'),
  ('data_entry', 'attendance:view'), ('data_entry', 'attendance:mark'),
  ('data_entry', 'notices:view');

-- 6. Viewer / Auditor
INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES
  ('viewer', 'students:view'),
  ('viewer', 'allocations:view'),
  ('viewer', 'rooms:view'),
  ('viewer', 'attendance:view'),
  ('viewer', 'gatepass:view'),
  ('viewer', 'complaints:view'),
  ('viewer', 'mess:view'),
  ('viewer', 'notices:view'),
  ('viewer', 'billing:view'),
  ('viewer', 'reports:view');
