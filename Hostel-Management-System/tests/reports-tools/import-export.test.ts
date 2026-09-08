import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { students } from '../../src/main/database/schema/students.js';
import { auditLogs } from '../../src/main/database/schema/system.js';
import { ImportExportService } from '../../src/main/services/ImportExportService.js';
import { SessionUser } from '../../src/shared/types.js';
import { eq } from 'drizzle-orm';

describe('Phase 07: CSV Import/Export & Data Portability Tools', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-IMP',
    name: 'Registrar Admin',
    email: 'registrar@nexus.test',
    phone: '9876543220',
    role: 'admin',
    permissions: ['students:create', 'students:view'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-GUEST-IMP',
    name: 'Guest User',
    email: 'guestimp@nexus.test',
    phone: '9876543299',
    role: 'resident',
    permissions: [],
    forcePasswordChange: false,
  };

  const existingStudentId = 'STU-EXISTING-001';

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });

    const db = getDb();
    const now = Date.now();

    await db.insert(institutions).values({
      id: 'INST-0001',
      name: 'Nexus Tech University',
      code: 'NEXUS-01',
      address: '100 Campus Way',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(users).values({
      id: mockAdmin.id,
      name: mockAdmin.name,
      email: mockAdmin.email,
      phone: mockAdmin.phone,
      passwordHash: 'hash',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });

    // Existing student in database to test collision detection
    await db.insert(students).values({
      id: existingStudentId,
      institutionId: 'INST-0001',
      enrollmentNumber: 'ENR-EXISTING-99',
      firstName: 'Existing',
      lastName: 'Student',
      dateOfBirth: '2003-01-01',
      gender: 'female',
      email: 'existing@nexus.edu',
      phone: '9870009999',
      course: 'B.Tech',
      department: 'CS',
      academicYear: 4,
      admissionDate: '2022-08-01',
      permanentAddress: 'Capital City',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  describe('CSV Preview & Pre-Validation', () => {
    it('successfully parses valid CSV and reports 100% valid rows', async () => {
      const csv = `Enrollment Number,First Name,Last Name,Email,Phone,Gender,Course,Department,Academic Year
ENR-CSV-101,John,Doe,john.doe@nexus.edu,9871112233,male,B.Tech,CS,1
ENR-CSV-102,Jane,Smith,jane.smith@nexus.edu,9871112244,female,B.Tech,EC,2`;

      const preview = await ImportExportService.previewStudentCsv(csv);
      expect(preview.totalRows).toBe(2);
      expect(preview.validRowCount).toBe(2);
      expect(preview.invalidRowCount).toBe(0);
      expect(preview.hasCollisions).toBe(false);
      expect(preview.previewRows[0].firstName).toBe('John');
      expect(preview.previewRows[1].gender).toBe('female');
    });

    it('rejects CSV with missing required columns in the header', async () => {
      const csv = `Enrollment Number,First Name,Email
ENR-CSV-101,John,john.doe@nexus.edu`;

      await expect(ImportExportService.previewStudentCsv(csv)).rejects.toThrow(/MISSING_HEADER/i);
    });

    it('flags database collisions (enrollment, email, phone)', async () => {
      const csv = `Enrollment Number,First Name,Last Name,Email,Phone
ENR-EXISTING-99,Duplicate,Enrollment,dup1@nexus.edu,9870001111
ENR-NEW-002,Duplicate,Email,existing@nexus.edu,9870002222
ENR-NEW-003,Duplicate,Phone,dup3@nexus.edu,9870009999`;

      const preview = await ImportExportService.previewStudentCsv(csv);
      expect(preview.totalRows).toBe(3);
      expect(preview.validRowCount).toBe(0);
      expect(preview.hasCollisions).toBe(true);
      expect(preview.previewRows[0].errors[0]).toMatch(/already exists in database/i);
      expect(preview.previewRows[1].errors[0]).toMatch(/already exists in database/i);
      expect(preview.previewRows[2].errors[0]).toMatch(/already exists in database/i);
    });

    it('flags intra-file duplicate collisions within the same CSV upload', async () => {
      const csv = `Enrollment Number,First Name,Last Name,Email,Phone
ENR-DUP-100,First,Entry,dup.email@nexus.edu,9879998888
ENR-DUP-100,Second,Entry,dup.email@nexus.edu,9879998888`;

      const preview = await ImportExportService.previewStudentCsv(csv);
      expect(preview.totalRows).toBe(2);
      expect(preview.hasCollisions).toBe(true);
      // Second row should be marked with in-CSV collision
      expect(preview.previewRows[1].isValid).toBe(false);
      expect(preview.previewRows[1].errors.some((e) => e.includes('within this CSV'))).toBe(true);
    });

    it('identifies malformed records (bad email, short phone, missing names)', async () => {
      const csv = `Enrollment Number,First Name,Last Name,Email,Phone
ENR-BAD-001,,Doe,not-an-email,123`;

      const preview = await ImportExportService.previewStudentCsv(csv);
      expect(preview.validRowCount).toBe(0);
      expect(preview.previewRows[0].errors).toContain('Missing First Name');
      expect(preview.previewRows[0].errors).toContain('Invalid or missing Email');
      expect(preview.previewRows[0].errors).toContain('Invalid or missing Phone');
    });
  });

  describe('Batch Import Execution', () => {
    it('imports valid preview rows into the database atomically and creates audit log', async () => {
      const previewRows = [
        {
          rowNumber: 1,
          enrollmentNumber: 'ENR-BATCH-01',
          firstName: 'Robert',
          lastName: 'Pike',
          email: 'rob@nexus.edu',
          phone: '9875551111',
          gender: 'male' as const,
          course: 'B.Tech',
          department: 'CS',
          academicYear: 2,
          isValid: true,
          errors: [],
        },
        {
          rowNumber: 2,
          enrollmentNumber: 'ENR-BATCH-02',
          firstName: 'Ken',
          lastName: 'Thompson',
          email: 'ken@nexus.edu',
          phone: '9875552222',
          gender: 'male' as const,
          course: 'B.Tech',
          department: 'CS',
          academicYear: 2,
          isValid: true,
          errors: [],
        },
      ];

      const result = await ImportExportService.executeStudentImport(mockAdmin, previewRows);
      expect(result.importedCount).toBe(2);
      expect(result.errors.length).toBe(0);

      const db = getDb();
      const stus = await db.select().from(students).where(eq(students.department, 'CS'));
      // Existing student + 2 new students = 3
      expect(stus.length).toBe(3);

      const rob = stus.find((s: any) => s.enrollmentNumber === 'ENR-BATCH-01');
      expect(rob?.firstName).toBe('Robert');
      expect(rob?.status).toBe('active');
      expect(rob?.feeStatus).toBe('pending');

      // Audit log created
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'DATA_IMPORT_COMPLETED'));
      expect(logs.length).toBe(1);
    });

    it('throws when no valid records are provided for import', async () => {
      await expect(
        ImportExportService.executeStudentImport(mockAdmin, [
          {
            rowNumber: 1,
            enrollmentNumber: 'BAD',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            gender: 'other',
            course: 'X',
            department: 'Y',
            academicYear: 1,
            isValid: false,
            errors: ['Invalid'],
          },
        ])
      ).rejects.toThrow(/NO_VALID_RECORDS/i);
    });

    it('enforces RBAC permission check on batch import', async () => {
      await expect(
        ImportExportService.executeStudentImport(mockUnauthorized, [
          {
            rowNumber: 1,
            enrollmentNumber: 'ENR-X',
            firstName: 'X',
            lastName: 'Y',
            email: 'x@nexus.edu',
            phone: '9870000000',
            gender: 'male',
            course: 'B.Tech',
            department: 'CS',
            academicYear: 1,
            isValid: true,
            errors: [],
          },
        ])
      ).rejects.toThrow(/FORBIDDEN/i);
    });
  });

  describe('Filtered Student Export & Formula Injection Defense', () => {
    it('exports students to RFC 4180 CSV with column headers', async () => {
      const csv = await ImportExportService.exportStudentsCsv(mockAdmin);
      expect(csv).toContain('"Student ID","Enrollment Number","First Name","Last Name"');
      expect(csv).toContain('Existing');
      expect(csv).toContain('ENR-EXISTING-99');
    });

    it('neutralizes spreadsheet formula injection (=, +, -, @) by prepending a single quote', async () => {
      const db = getDb();
      const now = Date.now();

      // Insert student with formula injection attack in name
      await db.insert(students).values({
        id: 'STU-HACK-001',
        institutionId: 'INST-0001',
        enrollmentNumber: '=cmd|’ /C calc’!A0',
        firstName: '+2+5',
        lastName: '-@harmful',
        dateOfBirth: '2004-01-01',
        gender: 'male',
        email: 'hack@nexus.edu',
        phone: '9879997777',
        course: '@dangerous',
        department: 'CS',
        academicYear: 1,
        admissionDate: '2024-08-01',
        permanentAddress: 'Test',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      const csv = await ImportExportService.exportStudentsCsv(mockAdmin);
      // All malicious prefix characters must be sanitized with leading '
      expect(csv).toContain("\"'=cmd");
      expect(csv).toContain("\"'+2+5\"");
      expect(csv).toContain("\"'-@harmful\"");
      expect(csv).toContain("\"'@dangerous\"");
    });

    it('enforces RBAC permission check on student export', async () => {
      await expect(ImportExportService.exportStudentsCsv(mockUnauthorized)).rejects.toThrow(/FORBIDDEN/i);
    });
  });
});
