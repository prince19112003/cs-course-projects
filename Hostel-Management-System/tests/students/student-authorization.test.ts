import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { StudentService } from '../../src/main/services/StudentService.js';
import { AuditRepository } from '../../src/main/database/repositories/AuditRepository.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 05: Student Service RBAC Authorization & Audit Trail', () => {
  const mockSuperAdmin: SessionUser = {
    id: 'USR-SUPER-001',
    name: 'Super Admin',
    email: 'super@nexus.test',
    phone: '9999999999',
    role: 'super_admin',
    permissions: ['*'],
    forcePasswordChange: false,
  };

  const mockViewer: SessionUser = {
    id: 'USR-VIEWER-001',
    name: 'Viewer Only',
    email: 'viewer@nexus.test',
    phone: '9999999992',
    role: 'viewer',
    permissions: ['students:view'],
    forcePasswordChange: false,
  };

  const mockUnauth: SessionUser = {
    id: 'USR-UNAUTH-001',
    name: 'Unauth Staff',
    email: 'unauth@nexus.test',
    phone: '9999999993',
    role: 'staff',
    permissions: ['rooms:view'],
    forcePasswordChange: false,
  };

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
      id: mockSuperAdmin.id,
      name: mockSuperAdmin.name,
      email: mockSuperAdmin.email,
      phone: mockSuperAdmin.phone,
      passwordHash: 'hashed_pw',
      role: 'super_admin',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('enforces service-layer permissions and rejects unauthorized users with FORBIDDEN', async () => {
    // Unauth user cannot view students
    await expect(
      StudentService.searchStudents(mockUnauth, {})
    ).rejects.toThrow('FORBIDDEN');

    // Viewer can view students
    const searchRes = await StudentService.searchStudents(mockViewer, {});
    expect(searchRes.total).toBe(0);

    // Viewer cannot create student
    await expect(
      StudentService.createStudent(mockViewer, {
        enrollmentNumber: 'ENR-RBAC-01',
        firstName: 'Unauthorized',
        lastName: 'Attempt',
        dateOfBirth: '2004-01-01',
        gender: 'male',
        email: 'unauth@nexus.edu',
        phone: '9666666601',
        course: 'CS',
        department: 'CS',
        academicYear: 1,
        admissionDate: '2026-08-01',
        permanentAddress: 'Blocked Road',
      })
    ).rejects.toThrow('FORBIDDEN');
  });

  it('records audit log entries for student lifecycle mutations', async () => {
    const student = await StudentService.createStudent(mockSuperAdmin, {
      enrollmentNumber: 'ENR-AUDIT-01',
      firstName: 'Arthur',
      lastName: 'Dent',
      dateOfBirth: '2004-04-04',
      gender: 'male',
      email: 'arthur@nexus.edu',
      phone: '9666666602',
      course: 'Space Travel',
      department: 'Astrophysics',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: 'Country Lane, Cottington',
    });

    await StudentService.updateStudent(mockSuperAdmin, student.id, {
      firstName: 'Arthur',
      lastName: 'Philip Dent',
    });

    await StudentService.setStudentStatus(mockSuperAdmin, student.id, 'inactive', 'Temporarily relocated');

    const recentLogs = await AuditRepository.getRecent(10);
    const actions = recentLogs.map((l) => l.action);

    expect(actions).toContain('STUDENT_CREATED');
    expect(actions).toContain('STUDENT_UPDATED');
    expect(actions).toContain('STUDENT_STATUS_CHANGED');
  });
});
