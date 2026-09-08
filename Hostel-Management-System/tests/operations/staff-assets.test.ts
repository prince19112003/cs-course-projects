import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { hostels, blocks, floors, rooms } from '../../src/main/database/schema/infrastructure.js';
import { students } from '../../src/main/database/schema/students.js';
import { OperationsService } from '../../src/main/services/OperationsService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 06 Operations: Staff Roster, Room Assets & Dining Opt-Outs', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Super Admin',
    email: 'admin@nexus.test',
    phone: '9876543201',
    role: 'admin',
    permissions: ['rooms:view', 'rooms:manage', 'users:manage', 'students:edit'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-READONLY-001',
    name: 'Readonly User',
    email: 'ro@nexus.test',
    phone: '9876543202',
    role: 'resident',
    permissions: ['rooms:view'],
    forcePasswordChange: false,
  };

  const roomId = 'RM-AST-0001';
  const studentId = 'STU-MESS-0001';

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
      id: 'HST-AST-0001',
      institutionId: 'INST-0001',
      name: 'South Block Hostel',
      code: 'SBH',
      genderType: 'boys',
      address: 'South Campus',
      totalFloors: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: 'BLK-AST-0001',
      hostelId: 'HST-AST-0001',
      name: 'Block S',
      code: 'BS',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(floors).values({
      id: 'FLR-AST-0001',
      blockId: 'BLK-AST-0001',
      floorNumber: 1,
      name: 'Ground Floor',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(rooms).values({
      id: roomId,
      floorId: 'FLR-AST-0001',
      roomNumber: 'S-105',
      roomType: 'double',
      capacity: 2,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(students).values({
      id: studentId,
      institutionId: 'INST-0001',
      enrollmentNumber: 'ENR-MESS-001',
      firstName: 'Hannah',
      lastName: 'Abbott',
      dateOfBirth: '2004-07-22',
      gender: 'female',
      email: 'hannah@nexus.edu',
      phone: '9870005555',
      course: 'B.Tech',
      department: 'CS',
      academicYear: 1,
      admissionDate: '2024-08-01',
      permanentAddress: 'City H',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  // Staff
  it('creates staff personnel and toggles active status', async () => {
    const s = await OperationsService.createStaff(mockAdmin, {
      name: 'Suresh Kumar',
      phone: '9876540099',
      email: 'suresh@nexus.staff',
      designation: 'warden',
    });

    expect(s.id).toMatch(/^STF-[A-F0-9]{8}$/);
    expect(s.isActive).toBe(1);

    const deactivated = await OperationsService.toggleStaffStatus(mockAdmin, s.id, false);
    expect(deactivated).toBe(true);

    const staffList = await OperationsService.getStaff(mockAdmin, { activeOnly: false });
    expect(staffList.some((st) => st.id === s.id)).toBe(true);
  });

  it('enforces users:manage permission for staff creation', async () => {
    await expect(
      OperationsService.createStaff(mockUnauthorized, {
        name: 'Illegal Staff',
        phone: '9870000000',
        designation: 'caretaker',
      })
    ).rejects.toThrow(/FORBIDDEN/i);
  });

  // Room Assets
  it('creates, updates condition, and deletes room assets with audit logging', async () => {
    const asset = await OperationsService.createRoomAsset(mockAdmin, {
      roomId,
      assetName: 'Godrej Steel Study Table',
      serialNumber: 'SN-TBL-9901',
      condition: 'new',
    });

    expect(asset.id).toMatch(/^AST-[A-F0-9]{8}$/);
    expect(asset.condition).toBe('new');

    // Update condition to damaged
    const updated = await OperationsService.updateRoomAsset(mockAdmin, asset.id, { condition: 'damaged' });
    expect(updated.condition).toBe('damaged');

    // Delete asset
    const deleted = await OperationsService.deleteRoomAsset(mockAdmin, asset.id);
    expect(deleted).toBe(true);

    const listAfter = await OperationsService.getRoomAssets(mockAdmin, roomId);
    expect(listAfter.length).toBe(0);
  });

  // Mess Opt-Outs
  it('records and cancels weekend mess opt-out for food wastage prevention', async () => {
    const weekendDate = '2026-10-17';

    // 1. Record opt out
    const optOut = await OperationsService.recordMessOptOut(mockAdmin, studentId, weekendDate);
    expect(optOut.id).toMatch(/^MSO-[A-F0-9]{8}$/);
    expect(optOut.weekendStartDate).toBe(weekendDate);

    // 2. Query opt-outs
    const list = await OperationsService.getMessOptOuts(mockAdmin, weekendDate);
    expect(list.length).toBe(1);
    expect(list[0].studentId).toBe(studentId);

    // 3. Cancel opt out
    const cancelled = await OperationsService.cancelMessOptOut(mockAdmin, studentId, weekendDate);
    expect(cancelled).toBe(true);

    const listAfter = await OperationsService.getMessOptOuts(mockAdmin, weekendDate);
    expect(listAfter.length).toBe(0);
  });
});
