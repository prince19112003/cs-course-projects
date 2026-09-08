import { getDb } from '../database/connection.js';
import { students, Student } from '../database/schema/students.js';
import { institutions } from '../database/schema/institutions.js';
import { StudentRepository } from '../database/repositories/StudentRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { generateEntityId } from '../database/utils/id-generator.js';
import { sanitizeAndFormatCsv } from './ReportingService.js';
import { eq, or } from 'drizzle-orm';
import {
  SessionUser,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportExecutionResult,
  StudentSearchParams,
} from '../../shared/types.js';

function verifyPermission(user: SessionUser, requiredPermission: string) {
  const hasWildcard = user.permissions.includes('*');
  const hasSpecific = user.permissions.includes(requiredPermission);
  if (!hasWildcard && !hasSpecific) {
    throw new Error(`FORBIDDEN: User lacks required permission '${requiredPermission}'.`);
  }
}

// Simple RFC 4180 CSV Parser
function parseCsv(content: string): string[][] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

export class ImportExportService {
  // 1. Preview Student CSV with Pre-Validation & Collision Detection
  static async previewStudentCsv(csvContent: string): Promise<ImportPreviewResult> {
    const rawRows = parseCsv(csvContent);
    if (rawRows.length < 2) {
      throw new Error('INVALID_CSV: File must contain a header row and at least one data row.');
    }

    const header = rawRows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const expectedHeaders = ['enrollmentnumber', 'firstname', 'lastname', 'email', 'phone'];
    for (const req of expectedHeaders) {
      if (!header.includes(req)) {
        throw new Error(`MISSING_HEADER: Required column '${req}' is missing from the CSV header.`);
      }
    }

    const colIndex = {
      enrollmentNumber: header.indexOf('enrollmentnumber'),
      firstName: header.indexOf('firstname'),
      lastName: header.indexOf('lastname'),
      email: header.indexOf('email'),
      phone: header.indexOf('phone'),
      gender: header.indexOf('gender'),
      course: header.indexOf('course'),
      department: header.indexOf('department'),
      academicYear: header.indexOf('academicyear'),
      dateOfBirth: header.indexOf('dateofbirth'),
      permanentAddress: header.indexOf('permanentaddress'),
    };

    const db = getDb();
    // Cache existing values to detect collisions
    const existing = await db
      .select({
        enrollmentNumber: students.enrollmentNumber,
        email: students.email,
        phone: students.phone,
      })
      .from(students);

    const existingEnrollments = new Set(existing.map((s) => s.enrollmentNumber.toLowerCase()));
    const existingEmails = new Set(existing.map((s) => s.email.toLowerCase()));
    const existingPhones = new Set(existing.map((s) => s.phone.toLowerCase()));

    // In-file duplicate trackers
    const fileEnrollments = new Set<string>();
    const fileEmails = new Set<string>();
    const filePhones = new Set<string>();

    const previewRows: ImportPreviewRow[] = [];
    let validCount = 0;
    let hasCollisions = false;

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const errors: string[] = [];

      const enrollmentNumber = (row[colIndex.enrollmentNumber] || '').trim();
      const firstName = (row[colIndex.firstName] || '').trim();
      const lastName = (row[colIndex.lastName] || '').trim();
      const email = (row[colIndex.email] || '').trim();
      const phone = (row[colIndex.phone] || '').trim();
      const gender = (colIndex.gender !== -1 ? row[colIndex.gender] : 'other').trim().toLowerCase();
      const course = (colIndex.course !== -1 ? row[colIndex.course] : 'General').trim();
      const department = (colIndex.department !== -1 ? row[colIndex.department] : 'General').trim();
      const academicYear = Number(colIndex.academicYear !== -1 ? row[colIndex.academicYear] : 1) || 1;

      // Basic field checks
      if (!enrollmentNumber) errors.push('Missing Enrollment Number');
      if (!firstName) errors.push('Missing First Name');
      if (!lastName) errors.push('Missing Last Name');
      if (!email || !email.includes('@')) errors.push('Invalid or missing Email');
      if (!phone || phone.length < 7) errors.push('Invalid or missing Phone');

      // Database Collisions
      if (enrollmentNumber && existingEnrollments.has(enrollmentNumber.toLowerCase())) {
        errors.push(`Enrollment '${enrollmentNumber}' already exists in database`);
        hasCollisions = true;
      }
      if (email && existingEmails.has(email.toLowerCase())) {
        errors.push(`Email '${email}' already exists in database`);
        hasCollisions = true;
      }
      if (phone && existingPhones.has(phone.toLowerCase())) {
        errors.push(`Phone '${phone}' already exists in database`);
        hasCollisions = true;
      }

      // In-file duplicate checks
      if (enrollmentNumber && fileEnrollments.has(enrollmentNumber.toLowerCase())) {
        errors.push(`Duplicate Enrollment '${enrollmentNumber}' within this CSV`);
        hasCollisions = true;
      }
      if (email && fileEmails.has(email.toLowerCase())) {
        errors.push(`Duplicate Email '${email}' within this CSV`);
        hasCollisions = true;
      }
      if (phone && filePhones.has(phone.toLowerCase())) {
        errors.push(`Duplicate Phone '${phone}' within this CSV`);
        hasCollisions = true;
      }

      if (enrollmentNumber) fileEnrollments.add(enrollmentNumber.toLowerCase());
      if (email) fileEmails.add(email.toLowerCase());
      if (phone) filePhones.add(phone.toLowerCase());

      const isValid = errors.length === 0;
      if (isValid) validCount++;

      previewRows.push({
        rowNumber: i,
        enrollmentNumber,
        firstName,
        lastName,
        email,
        phone,
        gender: ['male', 'female', 'other'].includes(gender) ? gender : 'other',
        course,
        department,
        academicYear,
        isValid,
        errors,
      });
    }

    return {
      totalRows: previewRows.length,
      validRowCount: validCount,
      invalidRowCount: previewRows.length - validCount,
      previewRows,
      hasCollisions,
    };
  }

  // 2. Execute Batch Import
  static async executeStudentImport(
    user: SessionUser,
    validRows: ImportPreviewRow[]
  ): Promise<ImportExecutionResult> {
    verifyPermission(user, 'students:create');

    const eligible = validRows.filter((r) => r.isValid);
    if (eligible.length === 0) {
      throw new Error('NO_VALID_RECORDS: No valid records provided for import.');
    }

    const db = getDb();
    const instRows = await db.select().from(institutions).limit(1);
    const institutionId = instRows[0]?.id || 'INST-0001';
    const now = Date.now();
    const errors: string[] = [];
    let importedCount = 0;

    db.transaction((tx) => {
      for (const row of eligible) {
        try {
          const id = generateEntityId('STU');
          tx.insert(students)
            .values({
              id,
              institutionId,
              enrollmentNumber: row.enrollmentNumber,
              firstName: row.firstName,
              lastName: row.lastName,
              dateOfBirth: '2004-01-01',
              gender: (['male', 'female', 'other'].includes(row.gender) ? row.gender : 'other') as any,
              email: row.email,
              phone: row.phone,
              course: row.course || 'B.Tech',
              department: row.department || 'CS',
              academicYear: row.academicYear || 1,
              admissionDate: new Date().toISOString().split('T')[0],
              permanentAddress: 'Institutional Campus',
              status: 'active',
              feeStatus: 'pending',
              createdAt: now,
              updatedAt: now,
            })
            .run();
          importedCount++;
        } catch (err) {
          errors.push(`Row ${row.rowNumber} (${row.enrollmentNumber}): ${(err as Error).message}`);
        }
      }
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'DATA_IMPORT_COMPLETED',
      entityType: 'students',
      changesSummary: {
        importedCount,
        failedCount: errors.length,
      },
    });

    return {
      importedCount,
      skippedCount: validRows.length - importedCount,
      errors,
    };
  }

  // 3. Export Filtered Students to CSV
  static async exportStudentsCsv(user: SessionUser, params: StudentSearchParams = {}): Promise<string> {
    verifyPermission(user, 'students:view');

    // Fetch up to 10,000 matching records
    const res = await StudentRepository.search({ ...params, pageSize: 10000 });

    const headers = [
      'Student ID',
      'Enrollment Number',
      'First Name',
      'Last Name',
      'Gender',
      'Email',
      'Phone',
      'Course',
      'Department',
      'Year',
      'Status',
      'Fee Status',
      'Hostel',
      'Room',
      'Bed',
    ];

    const rows = res.data.map((s) => [
      s.id,
      s.enrollmentNumber,
      s.firstName,
      s.lastName,
      s.gender,
      s.email,
      s.phone,
      s.course,
      s.department,
      s.academicYear,
      s.status,
      s.feeStatus,
      s.hostelName || 'Unassigned',
      s.roomNumber || '—',
      s.bedLabel || '—',
    ]);

    return sanitizeAndFormatCsv(headers, rows);
  }
}
