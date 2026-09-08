import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { students } from '../../src/main/database/schema/students.js';
import { OperationsService } from '../../src/main/services/OperationsService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 06 Operations: Institutional Notices & Campus Visitors', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Warden Admin',
    email: 'admin@nexus.test',
    phone: '9876543201',
    role: 'admin',
    permissions: ['rooms:view', 'notices:publish'],
    forcePasswordChange: false,
  };

  const mockGuard: SessionUser = {
    id: 'USR-GUARD-001',
    name: 'Main Gate Guard',
    email: 'guard@nexus.test',
    phone: '9876543202',
    role: 'staff',
    permissions: ['rooms:view'],
    forcePasswordChange: false,
  };

  const studentId = 'STU-VIS-0001';

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

    await db.insert(users).values([
      {
        id: mockAdmin.id,
        name: mockAdmin.name,
        email: mockAdmin.email,
        phone: mockAdmin.phone,
        passwordHash: 'hash',
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: mockGuard.id,
        name: mockGuard.name,
        email: mockGuard.email,
        phone: mockGuard.phone,
        passwordHash: 'hash',
        role: 'staff',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(students).values({
      id: studentId,
      institutionId: 'INST-0001',
      enrollmentNumber: 'ENR-VIS-001',
      firstName: 'George',
      lastName: 'Clark',
      dateOfBirth: '2004-06-18',
      gender: 'male',
      email: 'george@nexus.edu',
      phone: '9870004444',
      course: 'B.Tech',
      department: 'CS',
      academicYear: 2,
      admissionDate: '2024-08-01',
      permanentAddress: 'City G',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  // Notices
  it('creates and lists notices with pinned order priority, and allows deletion', async () => {
    const unpinned = await OperationsService.createNotice(mockAdmin, {
      title: 'Water Tank Cleaning',
      content: 'Water supply suspended tomorrow 2-4 PM',
      isPinned: false,
      priority: 'normal',
    });

    const pinned = await OperationsService.createNotice(mockAdmin, {
      title: 'URGENT: Curfew Rule Update',
      content: 'Curfew strictly 10 PM tonight due to weather warning',
      isPinned: true,
      priority: 'critical',
    });

    const list = await OperationsService.getNotices(mockAdmin, {});
    expect(list.data.length).toBe(2);
    // Pinned notice must come first
    expect(list.data[0].id).toBe(pinned.id);
    expect(list.data[1].id).toBe(unpinned.id);

    // Delete notice
    const delResult = await OperationsService.deleteNotice(mockAdmin, unpinned.id);
    expect(delResult).toBe(true);

    const afterDel = await OperationsService.getNotices(mockAdmin, {});
    expect(afterDel.data.length).toBe(1);
    expect(afterDel.data[0].id).toBe(pinned.id);
  });

  it('enforces notices:publish permission', async () => {
    await expect(
      OperationsService.createNotice(mockGuard, {
        title: 'Guard Post',
        content: 'No entry allowed',
      })
    ).rejects.toThrow(/FORBIDDEN/i);
  });

  // Visitors
  it('registers visitor and logs departure check-out timestamp', async () => {
    const visitor = await OperationsService.registerVisitor(mockGuard, {
      visitorName: 'Mr. Robert Clark',
      phone: '9888877771',
      relationship: 'Father',
      studentId,
      idProofDetails: 'DL-KA-9901920',
      purpose: 'Delivering textbooks and winter clothing',
    });

    expect(visitor.id).toMatch(/^VIS-[A-F0-9]{8}$/);
    expect(visitor.checkOutTime).toBeNull();
    expect(visitor.studentName).toBe('George Clark');

    // List active visitors
    const activeList = await OperationsService.getVisitors(mockGuard, { activeOnly: true });
    expect(activeList.data.some((v) => v.id === visitor.id)).toBe(true);

    // Check out visitor
    const checkedOut = await OperationsService.checkOutVisitor(mockGuard, visitor.id);
    expect(checkedOut.checkOutTime).toBeDefined();
    expect(checkedOut.checkOutTime).toBeGreaterThanOrEqual(visitor.checkInTime);

    // After checkout, should not appear in activeOnly list
    const activeListAfter = await OperationsService.getVisitors(mockGuard, { activeOnly: true });
    expect(activeListAfter.data.some((v) => v.id === visitor.id)).toBe(false);
  });
});
