import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { hostels, blocks, floors, rooms } from '../../src/main/database/schema/infrastructure.js';
import { students } from '../../src/main/database/schema/students.js';
import { staff } from '../../src/main/database/schema/operations.js';
import { OperationsService } from '../../src/main/services/OperationsService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 06 Operations: Maintenance Complaints & Work Orders', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Facility Supervisor',
    email: 'facility@nexus.test',
    phone: '9876543201',
    role: 'admin',
    permissions: ['rooms:view', 'complaints:resolve', 'users:manage'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-GUEST-001',
    name: 'Guest Resident',
    email: 'guest@nexus.test',
    phone: '9876543202',
    role: 'resident',
    permissions: ['rooms:view'],
    forcePasswordChange: false,
  };

  const studentId = 'STU-CMP-0001';
  const roomId = 'RM-CMP-0001';
  const staffId = 'STF-CMP-0001';

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

    await db.insert(hostels).values({
      id: 'HST-CMP-0001',
      institutionId: 'INST-0001',
      name: 'Main Block',
      code: 'MB',
      genderType: 'boys',
      address: 'Central',
      totalFloors: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: 'BLK-CMP-0001',
      hostelId: 'HST-CMP-0001',
      name: 'Block 1',
      code: 'B1',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(floors).values({
      id: 'FLR-CMP-0001',
      blockId: 'BLK-CMP-0001',
      floorNumber: 1,
      name: 'Ground Floor',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(rooms).values({
      id: roomId,
      floorId: 'FLR-CMP-0001',
      roomNumber: 'G-01',
      roomType: 'double',
      capacity: 2,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(students).values({
      id: studentId,
      institutionId: 'INST-0001',
      enrollmentNumber: 'ENR-CMP-001',
      firstName: 'Emily',
      lastName: 'Blunt',
      dateOfBirth: '2004-04-12',
      gender: 'female',
      email: 'emily@nexus.edu',
      phone: '9870003333',
      course: 'B.Tech',
      department: 'EE',
      academicYear: 1,
      admissionDate: '2024-08-01',
      permanentAddress: 'City E',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(staff).values({
      id: staffId,
      institutionId: 'INST-0001',
      name: 'Ramesh Plumber',
      phone: '9876540001',
      designation: 'maintenance',
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates maintenance complaint and allows progression to resolved with staff assignment', async () => {
    // 1. Create
    const complaint = await OperationsService.createComplaint(mockAdmin, {
      studentId,
      roomId,
      category: 'plumbing',
      subject: 'Bathroom pipe leakage',
      description: 'Water leaking continuously under sink',
      priority: 'urgent',
    });

    expect(complaint.id).toMatch(/^CMP-[A-F0-9]{8}$/);
    expect(complaint.status).toBe('open');
    expect(complaint.priority).toBe('urgent');

    // 2. Mark in_progress with staff assignment
    const inProgress = await OperationsService.resolveComplaint(
      mockAdmin,
      complaint.id,
      'in_progress',
      staffId,
      'Work order dispatched to plumber'
    );
    expect(inProgress.status).toBe('in_progress');
    expect(inProgress.assignedStaffId).toBe(staffId);

    // 3. Mark resolved
    const resolved = await OperationsService.resolveComplaint(
      mockAdmin,
      complaint.id,
      'resolved',
      staffId,
      'Pipe joint replaced and sealed.'
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.resolutionNotes).toBe('Pipe joint replaced and sealed.');
  });

  it('rejects complaint resolution by unauthorized user', async () => {
    const complaint = await OperationsService.createComplaint(mockAdmin, {
      studentId,
      roomId,
      category: 'electrical',
      subject: 'Switchboard sparking',
      description: 'Switchboard sparks when fan is switched on',
    });

    await expect(
      OperationsService.resolveComplaint(mockUnauthorized, complaint.id, 'resolved')
    ).rejects.toThrow(/FORBIDDEN/i);
  });
});
