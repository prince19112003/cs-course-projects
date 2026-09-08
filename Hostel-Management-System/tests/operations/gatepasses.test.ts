import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { students } from '../../src/main/database/schema/students.js';
import { OperationsService } from '../../src/main/services/OperationsService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 06 Operations: Digital Gate Passes & Campus Movements', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Admin Warden',
    email: 'admin@nexus.test',
    phone: '9876543210',
    role: 'admin',
    permissions: ['students:view', 'students:edit', 'gatepass:approve'],
    forcePasswordChange: false,
  };

  const mockGuard: SessionUser = {
    id: 'USR-GUARD-001',
    name: 'Security Guard',
    email: 'guard@nexus.test',
    phone: '9876543222',
    role: 'guard',
    permissions: ['students:view'],
    forcePasswordChange: false,
  };

  const studentId = 'STU-GP-0001';

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

    await db.insert(students).values({
      id: studentId,
      institutionId: 'INST-0001',
      enrollmentNumber: 'ENR-GP-001',
      firstName: 'David',
      lastName: 'Miller',
      dateOfBirth: '2004-03-15',
      gender: 'male',
      email: 'david@nexus.edu',
      phone: '9870001111',
      course: 'B.Tech',
      department: 'EE',
      academicYear: 3,
      admissionDate: '2023-08-01',
      permanentAddress: 'City D',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates a gate pass with valid dates and pending status', async () => {
    const depTime = Date.now() + 3600000;
    const retTime = Date.now() + 7200000;

    const pass = await OperationsService.createGatePass(mockAdmin, {
      studentId,
      passType: 'day_out',
      reason: 'Library visit downtown',
      destination: 'Central Library',
      departureTime: depTime,
      expectedReturnTime: retTime,
    });

    expect(pass.id).toMatch(/^GP-[A-F0-9]{8}$/);
    expect(pass.status).toBe('pending');
    expect(pass.studentId).toBe(studentId);
  });

  it('rejects gate pass where departure time is after expected return time', async () => {
    const depTime = Date.now() + 7200000;
    const retTime = Date.now() + 3600000; // earlier than departure!

    await expect(
      OperationsService.createGatePass(mockAdmin, {
        studentId,
        passType: 'day_out',
        reason: 'Invalid timing test',
        destination: 'Nowhere',
        departureTime: depTime,
        expectedReturnTime: retTime,
      })
    ).rejects.toThrow(/INVALID_TIME_RANGE|precede/i);
  });

  it('allows warden to approve gate pass and logs movement exit/return cycle', async () => {
    const depTime = Date.now() + 3600000;
    const retTime = Date.now() + 7200000;

    const pass = await OperationsService.createGatePass(mockAdmin, {
      studentId,
      passType: 'night_out',
      reason: 'Family visit',
      destination: 'Home',
      departureTime: depTime,
      expectedReturnTime: retTime,
    });

    // 1. Approve
    const approved = await OperationsService.reviewGatePass(mockAdmin, pass.id, 'approved', 'Authorized by Warden');
    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe(mockAdmin.id);
    expect(approved.reviewNotes).toBe('Authorized by Warden');

    // 2. Log gate exit
    const exited = await OperationsService.logGatePassMovement(mockAdmin, pass.id, 'exit');
    expect(exited.status).toBe('active_out');
    expect(exited.actualExitTime).toBeDefined();

    // 3. Log safe return
    const returned = await OperationsService.logGatePassMovement(mockAdmin, pass.id, 'return');
    expect(returned.status).toBe('closed');
    expect(returned.actualReturnTime).toBeDefined();
  });

  it('enforces gatepass:approve permission on reviews', async () => {
    const depTime = Date.now() + 3600000;
    const retTime = Date.now() + 7200000;

    const pass = await OperationsService.createGatePass(mockAdmin, {
      studentId,
      passType: 'day_out',
      reason: 'Errands',
      destination: 'Market',
      departureTime: depTime,
      expectedReturnTime: retTime,
    });

    await expect(
      OperationsService.reviewGatePass(mockGuard, pass.id, 'approved')
    ).rejects.toThrow(/FORBIDDEN/i);
  });
});
