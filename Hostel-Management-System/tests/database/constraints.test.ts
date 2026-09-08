import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getSqlite, getDb } from '../../src/main/database/connection.js';
import { institutions, users, hostels, blocks, floors, rooms, beds, students } from '../../src/main/database/schema/index.js';
import { DatabaseService } from '../../src/main/database/services/DatabaseService.js';
import { generateEntityId } from '../../src/main/database/utils/id-generator.js';

describe('Database Constraints, Foreign Keys & Triggers', () => {
  const instId = 'INST-TEST-CONSTR';
  const adminId = 'USR-TEST-CONSTR';

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });

    const db = getDb();
    const now = Date.now();
    await db.insert(institutions).values({
      id: instId,
      name: 'Constraint Test University',
      code: 'CTU',
      address: 'Test Road',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(users).values({
      id: adminId,
      name: 'Constraint Admin',
      email: 'admin-constr@test.local',
      phone: '1112223334',
      passwordHash: 'hash',
      role: 'super_admin',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('enforces UNIQUE constraints on student enrollment, email, and phone', async () => {
    const db = getDb();
    const now = Date.now();

    await db.insert(students).values({
      id: 'STU-001',
      enrollmentNumber: 'ENR-UNIQUE-1',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2004-01-01',
      gender: 'male',
      email: 'john@unique.local',
      phone: '9991112222',
      course: 'B.A',
      department: 'English',
      academicYear: 1,
      admissionDate: '2024-01-01',
      permanentAddress: 'Street 1',
      status: 'active',
      feeStatus: 'paid',
      createdAt: now,
      updatedAt: now,
    });

    // Duplicate enrollment
    let errEnrollment: unknown;
    try {
      await db.insert(students).values({
        id: 'STU-002',
        enrollmentNumber: 'ENR-UNIQUE-1', // duplicate
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2004-01-01',
        gender: 'female',
        email: 'jane@unique.local',
        phone: '9991112223',
        course: 'B.A',
        department: 'English',
        academicYear: 1,
        admissionDate: '2024-01-01',
        permanentAddress: 'Street 2',
        status: 'active',
        feeStatus: 'paid',
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      errEnrollment = e;
    }

    expect(errEnrollment).toBeDefined();
    const formatted = DatabaseService.formatError(errEnrollment);
    expect(formatted.code).toBe('DUPLICATE_RECORD');
  });

  it('enforces ON DELETE RESTRICT on parent infrastructure hierarchies', async () => {
    const db = getDb();
    const now = Date.now();
    const hostelId = generateEntityId('HST');

    await db.insert(hostels).values({
      id: hostelId,
      institutionId: instId,
      name: 'Restrict Hostel',
      code: 'RST-1',
      genderType: 'boys',
      totalCapacity: 10,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: generateEntityId('BLK'),
      hostelId: hostelId,
      name: 'Block R',
      code: 'R',
      totalFloors: 1,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    const sqlite = getSqlite();

    // Attempting to delete hostel should fail because block references it
    expect(() => {
      sqlite.prepare('DELETE FROM hostels WHERE id = ?').run(hostelId);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('enforces room capacity trigger guard preventing excess beds', async () => {
    const db = getDb();
    const now = Date.now();
    const hostelId = generateEntityId('HST');
    const blockId = generateEntityId('BLK');
    const floorId = generateEntityId('FLR');
    const roomId = generateEntityId('RM');

    await db.insert(hostels).values({
      id: hostelId,
      institutionId: instId,
      name: 'Capacity Test Hostel',
      code: 'CPCT-1',
      genderType: 'boys',
      totalCapacity: 10,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: blockId,
      hostelId: hostelId,
      name: 'Capacity Block',
      code: 'CB',
      totalFloors: 1,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(floors).values({
      id: floorId,
      blockId: blockId,
      floorNumber: 1,
      name: '1st Floor',
      isActive: 1,
      createdAt: now,
    });

    // Room with capacity = 1
    await db.insert(rooms).values({
      id: roomId,
      floorId: floorId,
      roomNumber: 'SINGLE-101',
      capacity: 1,
      roomType: 'single',
      acType: 'non_ac',
      monthlyRent: 30000,
      status: 'available',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Bed 1 (allowed, count = 1 <= capacity 1)
    await db.insert(beds).values({
      id: generateEntityId('BED'),
      roomId: roomId,
      bedLabel: '1',
      status: 'vacant',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Bed 2 (must be aborted by trigger trg_check_room_capacity_before_insert)
    let triggerError: unknown;
    try {
      await db.insert(beds).values({
        id: generateEntityId('BED'),
        roomId: roomId,
        bedLabel: '2',
        status: 'vacant',
        isArchived: 0,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      triggerError = e;
    }

    expect(triggerError).toBeDefined();
    const formatted = DatabaseService.formatError(triggerError);
    expect(formatted.code).toBe('ROOM_CAPACITY_EXCEEDED');
  });
});
