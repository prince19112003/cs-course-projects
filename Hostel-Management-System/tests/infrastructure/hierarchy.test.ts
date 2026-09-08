import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { InfrastructureService } from '../../src/main/services/InfrastructureService.js';
import { AllocationService } from '../../src/main/services/AllocationService.js';
import { OccupancyCalculator } from '../../src/main/database/services/OccupancyCalculator.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Hostel Spatial Hierarchy, Containment, Capacity & Occupancy', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-TEST-ADMIN',
    name: 'Admin Tester',
    email: 'admin@nexus.test',
    phone: '9000000000',
    role: 'super_admin',
    permissions: ['*'],
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
      id: mockAdmin.id,
      name: mockAdmin.name,
      email: mockAdmin.email,
      phone: mockAdmin.phone,
      passwordHash: 'hashed_pw',
      role: 'super_admin',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('manages Hostel lifecycle and enforces active containment constraints', async () => {
    // 1. Create Hostel
    const hostel = await InfrastructureService.createHostel(mockAdmin, {
      name: 'Phoenix Boys Residence',
      code: 'PHX-1',
      genderType: 'boys',
      totalCapacity: 100,
    });

    expect(hostel.id).toMatch(/^HST-/);
    expect(hostel.name).toBe('Phoenix Boys Residence');
    expect(hostel.code).toBe('PHX-1');
    expect(hostel.isActive).toBe(1);

    // 2. Edit Hostel
    const updated = await InfrastructureService.updateHostel(mockAdmin, hostel.id, {
      name: 'Phoenix Residence Hall (Renamed)',
    });
    expect(updated?.name).toBe('Phoenix Residence Hall (Renamed)');

    // 3. Reject creating block under non-existent hostel
    await expect(
      InfrastructureService.createBlock(mockAdmin, {
        hostelId: 'HST-NON-EXISTENT',
        name: 'Block Alpha',
        code: 'A',
      })
    ).rejects.toThrow('Parent hostel HST-NON-EXISTENT does not exist.');

    // 4. Create Block under valid Hostel
    const block = await InfrastructureService.createBlock(mockAdmin, {
      hostelId: hostel.id,
      name: 'Block Alpha',
      code: 'A',
      totalFloors: 3,
    });
    expect(block.id).toMatch(/^BLK-/);
    expect(block.hostelId).toBe(hostel.id);

    // 5. Deactivate Hostel and verify block creation is blocked under inactive hostel
    await InfrastructureService.toggleHostelStatus(mockAdmin, hostel.id, false);
    const deactivatedHostel = await InfrastructureService.getHostelById(hostel.id);
    expect(deactivatedHostel?.isActive).toBe(0);

    await expect(
      InfrastructureService.createBlock(mockAdmin, {
        hostelId: hostel.id,
        name: 'Block Beta',
        code: 'B',
      })
    ).rejects.toThrow('Cannot add a block to an inactive hostel.');
  });

  it('enforces Floor and Room hierarchy containment and capacity ceiling', async () => {
    const hostel = await InfrastructureService.createHostel(mockAdmin, {
      name: 'Newton Girls Hall',
      code: 'NGH-1',
      genderType: 'girls',
    });

    const block = await InfrastructureService.createBlock(mockAdmin, {
      hostelId: hostel.id,
      name: 'Wing 1',
      code: 'W1',
      totalFloors: 2,
    });

    // 1. Create Floor
    const floor = await InfrastructureService.createFloor(mockAdmin, {
      blockId: block.id,
      floorNumber: 0,
      name: 'Ground Floor',
    });
    expect(floor.id).toMatch(/^FLR-/);
    expect(floor.floorNumber).toBe(0);

    // 2. Reject duplicate floor number under same block
    await expect(
      InfrastructureService.createFloor(mockAdmin, {
        blockId: block.id,
        floorNumber: 0,
        name: 'Duplicate Ground Floor',
      })
    ).rejects.toThrow();

    // 3. Create Room with capacity = 2
    const room = await InfrastructureService.createRoom(mockAdmin, {
      floorId: floor.id,
      roomNumber: 'G01',
      capacity: 2,
      roomType: 'double',
      acType: 'ac',
      monthlyRent: 500000,
    });
    expect(room.id).toMatch(/^RM-/);
    expect(room.capacity).toBe(2);

    // 4. Add Bed 1
    const bed1 = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: 'Bed A',
    });
    expect(bed1.id).toMatch(/^BED-/);
    expect(bed1.status).toBe('vacant');

    // 5. Add Bed 2 (reaches capacity 2)
    const bed2 = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: 'Bed B',
    });
    expect(bed2.id).toMatch(/^BED-/);

    // 6. Attempt adding Bed 3 (must be rejected due to capacity ceiling = 2)
    await expect(
      InfrastructureService.createBed(mockAdmin, {
        roomId: room.id,
        bedLabel: 'Bed C',
      })
    ).rejects.toThrow(/ROOM_CAPACITY_EXCEEDED/);
  });

  it('prevents deactivating entities with active bed allocations', async () => {
    // Setup hierarchy
    const hostel = await InfrastructureService.createHostel(mockAdmin, {
      name: 'Curie Hall',
      code: 'CH-1',
      genderType: 'coed',
    });
    const block = await InfrastructureService.createBlock(mockAdmin, {
      hostelId: hostel.id,
      name: 'Block A',
      code: 'A',
    });
    const floor = await InfrastructureService.createFloor(mockAdmin, {
      blockId: block.id,
      floorNumber: 1,
      name: '1st Floor',
    });
    const room = await InfrastructureService.createRoom(mockAdmin, {
      floorId: floor.id,
      roomNumber: '101',
      capacity: 1,
      roomType: 'single',
    });
    const bed = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: '1',
    });

    // Provision dev student and allocate
    const devStudents = await AllocationService.getDevTestStudents();
    const student = devStudents[0];

    await AllocationService.allocateBed(mockAdmin, {
      studentId: student.id,
      bedId: bed.id,
      remarks: 'Active resident',
    });

    // Attempt deactivating Bed -> Must fail
    await expect(
      InfrastructureService.toggleBedStatus(mockAdmin, bed.id, 'maintenance')
    ).rejects.toThrow(/CANNOT_MODIFY_BED/);

    // Attempt archiving Room -> Must fail
    await expect(
      InfrastructureService.toggleRoomStatus(mockAdmin, room.id, undefined, true)
    ).rejects.toThrow(/CANNOT_ARCHIVE_ROOM/);

    // Attempt deactivating Floor -> Must fail
    await expect(
      InfrastructureService.toggleFloorStatus(mockAdmin, floor.id, false)
    ).rejects.toThrow(/CANNOT_DEACTIVATE/);

    // Attempt deactivating Block -> Must fail
    await expect(
      InfrastructureService.toggleBlockStatus(mockAdmin, block.id, false)
    ).rejects.toThrow(/CANNOT_DEACTIVATE/);

    // Attempt deactivating Hostel -> Must fail
    await expect(
      InfrastructureService.toggleHostelStatus(mockAdmin, hostel.id, false)
    ).rejects.toThrow(/CANNOT_DEACTIVATE/);
  });

  it('reliably calculates real-time occupancy across Room, Floor, Block, Hostel, and Campus', async () => {
    const hostel = await InfrastructureService.createHostel(mockAdmin, {
      name: 'Bose Complex',
      code: 'BC-1',
      genderType: 'boys',
    });
    const block = await InfrastructureService.createBlock(mockAdmin, {
      hostelId: hostel.id,
      name: 'North Wing',
      code: 'NW',
    });
    const floor = await InfrastructureService.createFloor(mockAdmin, {
      blockId: block.id,
      floorNumber: 1,
      name: 'Level 1',
    });
    const room = await InfrastructureService.createRoom(mockAdmin, {
      floorId: floor.id,
      roomNumber: 'N101',
      capacity: 2,
      roomType: 'double',
    });
    const bed1 = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: 'B1',
    });
    const bed2 = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: 'B2',
    });

    // Check initial room occupancy (0/2)
    let roomOcc = await OccupancyCalculator.calculateRoomOccupancy(room.id);
    expect(roomOcc.totalBeds).toBe(2);
    expect(roomOcc.occupiedBeds).toBe(0);
    expect(roomOcc.vacantBeds).toBe(2);
    expect(roomOcc.dynamicStatus).toBe('available');

    // Allocate 1 student
    const devStudents = await AllocationService.getDevTestStudents();
    await AllocationService.allocateBed(mockAdmin, {
      studentId: devStudents[0].id,
      bedId: bed1.id,
    });

    // Check room occupancy after 1 allocation (1/2, partially_occupied)
    roomOcc = await OccupancyCalculator.calculateRoomOccupancy(room.id);
    expect(roomOcc.occupiedBeds).toBe(1);
    expect(roomOcc.vacantBeds).toBe(1);
    expect(roomOcc.dynamicStatus).toBe('partially_occupied');

    // Check Hostel occupancy (50%)
    const hostelOcc = await OccupancyCalculator.calculateHostelOccupancy(hostel.id);
    expect(hostelOcc.totalRooms).toBe(1);
    expect(hostelOcc.totalBeds).toBe(2);
    expect(hostelOcc.occupiedBeds).toBe(1);
    expect(hostelOcc.vacantBeds).toBe(1);
    expect(hostelOcc.occupancyPercentage).toBe(50);

    // Check Campus overall occupancy
    const campusOcc = await OccupancyCalculator.calculateCampusOccupancy();
    expect(campusOcc.totalHostels).toBeGreaterThanOrEqual(1);
    expect(campusOcc.occupiedBeds).toBeGreaterThanOrEqual(1);
  });
});
