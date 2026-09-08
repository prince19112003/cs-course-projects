import { InfrastructureRepository, RoomQueryParams, BedQueryParams } from '../database/repositories/InfrastructureRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { generateEntityId } from '../database/utils/id-generator.js';
import { Hostel, Block, Floor, Room, Bed } from '../database/schema/infrastructure.js';
import { institutions } from '../database/schema/institutions.js';
import { getDb } from '../database/connection.js';
import { SessionUser } from '../../shared/types.js';

export class InfrastructureService {
  // --------------------------------------------------------------------------
  // HOSTELS
  // --------------------------------------------------------------------------
  static async getHostels(includeInactive = false): Promise<Hostel[]> {
    return InfrastructureRepository.getHostels(includeInactive);
  }

  static async getHostelById(id: string): Promise<Hostel | null> {
    return InfrastructureRepository.getHostelById(id);
  }

  static async createHostel(
    user: SessionUser,
    data: {
      institutionId?: string;
      name: string;
      code: string;
      genderType: 'boys' | 'girls' | 'coed';
      wardenId?: string;
      totalCapacity?: number;
    }
  ): Promise<Hostel> {
    if (!data.name || !data.code || !data.genderType) {
      throw new Error('Hostel name, code, and gender type are required.');
    }

    const db = getDb();
    let institutionId = data.institutionId;
    if (!institutionId) {
      const instRows = await db.select().from(institutions).limit(1);
      institutionId = instRows[0]?.id || 'INST-0001';
    }

    const now = Date.now();
    const hostelId = generateEntityId('HST');

    const created = await InfrastructureRepository.createHostel({
      id: hostelId,
      institutionId,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      genderType: data.genderType,
      wardenId: data.wardenId || null,
      totalCapacity: data.totalCapacity || 0,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'HOSTEL_CREATED',
      entityType: 'hostels',
      entityId: hostelId,
      details: JSON.stringify({ name: data.name, code: data.code }),
    });

    return created;
  }

  static async updateHostel(
    user: SessionUser,
    id: string,
    data: {
      name?: string;
      genderType?: 'boys' | 'girls' | 'coed';
      wardenId?: string;
      totalCapacity?: number;
    }
  ): Promise<Hostel | null> {
    const existing = await InfrastructureRepository.getHostelById(id);
    if (!existing) {
      throw new Error(`Hostel ${id} not found.`);
    }

    const updated = await InfrastructureRepository.updateHostel(id, data);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'HOSTEL_UPDATED',
      entityType: 'hostels',
      entityId: id,
      details: JSON.stringify(data),
    });

    return updated;
  }

  static async toggleHostelStatus(user: SessionUser, id: string, isActive: boolean): Promise<boolean> {
    if (!isActive) {
      const hasAllocations = await InfrastructureRepository.hasActiveAllocationsForHostel(id);
      if (hasAllocations) {
        throw new Error('CANNOT_DEACTIVATE: Cannot deactivate hostel while it contains active resident allocations.');
      }
    }

    const result = await InfrastructureRepository.toggleHostelStatus(id, isActive);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: isActive ? 'HOSTEL_ACTIVATED' : 'HOSTEL_DEACTIVATED',
      entityType: 'hostels',
      entityId: id,
      details: JSON.stringify({ isActive }),
    });

    return result;
  }

  // --------------------------------------------------------------------------
  // BLOCKS
  // --------------------------------------------------------------------------
  static async getBlocks(hostelId?: string, includeInactive = false): Promise<Block[]> {
    return InfrastructureRepository.getBlocks(hostelId, includeInactive);
  }

  static async getBlockById(id: string): Promise<Block | null> {
    return InfrastructureRepository.getBlockById(id);
  }

  static async createBlock(
    user: SessionUser,
    data: {
      hostelId: string;
      name: string;
      code: string;
      totalFloors?: number;
    }
  ): Promise<Block> {
    const parentHostel = await InfrastructureRepository.getHostelById(data.hostelId);
    if (!parentHostel) {
      throw new Error(`Parent hostel ${data.hostelId} does not exist.`);
    }
    if (parentHostel.isActive === 0) {
      throw new Error('Cannot add a block to an inactive hostel.');
    }

    const blockId = generateEntityId('BLK');
    const now = Date.now();

    const created = await InfrastructureRepository.createBlock({
      id: blockId,
      hostelId: data.hostelId,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      totalFloors: data.totalFloors || 1,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BLOCK_CREATED',
      entityType: 'blocks',
      entityId: blockId,
      details: JSON.stringify({ name: data.name, code: data.code, hostelId: data.hostelId }),
    });

    return created;
  }

  static async updateBlock(
    user: SessionUser,
    id: string,
    data: { name?: string; totalFloors?: number }
  ): Promise<Block | null> {
    const updated = await InfrastructureRepository.updateBlock(id, data);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BLOCK_UPDATED',
      entityType: 'blocks',
      entityId: id,
      details: JSON.stringify(data),
    });

    return updated;
  }

  static async toggleBlockStatus(user: SessionUser, id: string, isActive: boolean): Promise<boolean> {
    if (!isActive) {
      const hasAllocations = await InfrastructureRepository.hasActiveAllocationsForBlock(id);
      if (hasAllocations) {
        throw new Error('CANNOT_DEACTIVATE: Cannot deactivate block while it contains active resident allocations.');
      }
    }

    const result = await InfrastructureRepository.toggleBlockStatus(id, isActive);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: isActive ? 'BLOCK_ACTIVATED' : 'BLOCK_DEACTIVATED',
      entityType: 'blocks',
      entityId: id,
      details: JSON.stringify({ isActive }),
    });

    return result;
  }

  // --------------------------------------------------------------------------
  // FLOORS
  // --------------------------------------------------------------------------
  static async getFloors(blockId?: string, includeInactive = false): Promise<Floor[]> {
    return InfrastructureRepository.getFloors(blockId, includeInactive);
  }

  static async getFloorById(id: string): Promise<Floor | null> {
    return InfrastructureRepository.getFloorById(id);
  }

  static async createFloor(
    user: SessionUser,
    data: {
      blockId: string;
      floorNumber: number;
      name: string;
    }
  ): Promise<Floor> {
    const parentBlock = await InfrastructureRepository.getBlockById(data.blockId);
    if (!parentBlock) {
      throw new Error(`Parent block ${data.blockId} does not exist.`);
    }
    if (parentBlock.isActive === 0) {
      throw new Error('Cannot add a floor to an inactive block.');
    }

    const floorId = generateEntityId('FLR');
    const now = Date.now();

    const created = await InfrastructureRepository.createFloor({
      id: floorId,
      blockId: data.blockId,
      floorNumber: data.floorNumber,
      name: data.name.trim(),
      isActive: 1,
      createdAt: now,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'FLOOR_CREATED',
      entityType: 'floors',
      entityId: floorId,
      details: JSON.stringify({ name: data.name, floorNumber: data.floorNumber, blockId: data.blockId }),
    });

    return created;
  }

  static async updateFloor(
    user: SessionUser,
    id: string,
    data: { name?: string }
  ): Promise<Floor | null> {
    const updated = await InfrastructureRepository.updateFloor(id, data);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'FLOOR_UPDATED',
      entityType: 'floors',
      entityId: id,
      details: JSON.stringify(data),
    });

    return updated;
  }

  static async toggleFloorStatus(user: SessionUser, id: string, isActive: boolean): Promise<boolean> {
    if (!isActive) {
      const hasAllocations = await InfrastructureRepository.hasActiveAllocationsForFloor(id);
      if (hasAllocations) {
        throw new Error('CANNOT_DEACTIVATE: Cannot deactivate floor while it contains active resident allocations.');
      }
    }

    const result = await InfrastructureRepository.toggleFloorStatus(id, isActive);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: isActive ? 'FLOOR_ACTIVATED' : 'FLOOR_DEACTIVATED',
      entityType: 'floors',
      entityId: id,
      details: JSON.stringify({ isActive }),
    });

    return result;
  }

  // --------------------------------------------------------------------------
  // ROOMS
  // --------------------------------------------------------------------------
  static async getRooms(params: RoomQueryParams = {}): Promise<{ data: Room[]; total: number }> {
    return InfrastructureRepository.getRooms(params);
  }

  static async getRoomById(id: string): Promise<Room | null> {
    return InfrastructureRepository.getRoomById(id);
  }

  static async createRoom(
    user: SessionUser,
    data: {
      floorId: string;
      roomNumber: string;
      capacity: number;
      roomType: 'single' | 'double' | 'triple' | 'dormitory';
      acType?: 'ac' | 'non_ac';
      monthlyRent?: number;
    }
  ): Promise<Room> {
    const parentFloor = await InfrastructureRepository.getFloorById(data.floorId);
    if (!parentFloor) {
      throw new Error(`Parent floor ${data.floorId} does not exist.`);
    }
    if (parentFloor.isActive === 0) {
      throw new Error('Cannot add a room to an inactive floor.');
    }

    if (!data.capacity || data.capacity <= 0) {
      throw new Error('Room capacity must be at least 1.');
    }

    const roomId = generateEntityId('RM');
    const now = Date.now();

    const created = await InfrastructureRepository.createRoom({
      id: roomId,
      floorId: data.floorId,
      roomNumber: data.roomNumber.trim(),
      capacity: data.capacity,
      roomType: data.roomType,
      acType: data.acType || 'non_ac',
      monthlyRent: data.monthlyRent || 0,
      status: 'available',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_CREATED',
      entityType: 'rooms',
      entityId: roomId,
      details: JSON.stringify({ roomNumber: data.roomNumber, capacity: data.capacity, floorId: data.floorId }),
    });

    return created;
  }

  static async updateRoom(
    user: SessionUser,
    id: string,
    data: {
      capacity?: number;
      roomType?: 'single' | 'double' | 'triple' | 'dormitory';
      acType?: 'ac' | 'non_ac';
      monthlyRent?: number;
      status?: 'available' | 'full' | 'maintenance' | 'decommissioned';
    }
  ): Promise<Room | null> {
    if (data.capacity !== undefined) {
      const existingBeds = await InfrastructureRepository.getBedsByRoom(id);
      if (existingBeds.length > data.capacity) {
        throw new Error(`CANNOT_REDUCE_CAPACITY: Room already contains ${existingBeds.length} beds. Cannot set capacity lower than active bed count.`);
      }
    }

    const updated = await InfrastructureRepository.updateRoom(id, data);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_UPDATED',
      entityType: 'rooms',
      entityId: id,
      details: JSON.stringify(data),
    });

    return updated;
  }

  static async toggleRoomStatus(
    user: SessionUser,
    id: string,
    status?: 'available' | 'maintenance' | 'decommissioned',
    isArchived?: boolean
  ): Promise<boolean> {
    if (isArchived) {
      const hasAllocations = await InfrastructureRepository.hasActiveAllocationsForRoom(id);
      if (hasAllocations) {
        throw new Error('CANNOT_ARCHIVE_ROOM: Cannot archive room with active bed allocations.');
      }
    }

    const result = await InfrastructureRepository.toggleRoomStatus(id, status, isArchived);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: isArchived ? 'ROOM_ARCHIVED' : `ROOM_STATUS_${status?.toUpperCase()}`,
      entityType: 'rooms',
      entityId: id,
      details: JSON.stringify({ status, isArchived }),
    });

    return result;
  }

  // --------------------------------------------------------------------------
  // BEDS
  // --------------------------------------------------------------------------
  static async getBeds(params: BedQueryParams = {}): Promise<Bed[]> {
    return InfrastructureRepository.getBeds(params);
  }

  static async getBedById(id: string): Promise<Bed | null> {
    return InfrastructureRepository.getBedById(id);
  }

  static async createBed(
    user: SessionUser,
    data: {
      roomId: string;
      bedLabel: string;
    }
  ): Promise<Bed> {
    const parentRoom = await InfrastructureRepository.getRoomById(data.roomId);
    if (!parentRoom) {
      throw new Error(`Parent room ${data.roomId} does not exist.`);
    }
    if (parentRoom.isArchived === 1 || parentRoom.status === 'decommissioned') {
      throw new Error('Cannot add a bed to an archived or decommissioned room.');
    }

    // Capacity Check
    const currentBeds = await InfrastructureRepository.getBedsByRoom(data.roomId);
    if (currentBeds.length >= parentRoom.capacity) {
      throw new Error(`ROOM_CAPACITY_EXCEEDED: Room ${parentRoom.roomNumber} has reached its maximum capacity ceiling of ${parentRoom.capacity} bed(s).`);
    }

    const bedId = generateEntityId('BED');
    const now = Date.now();

    const created = await InfrastructureRepository.createBed({
      id: bedId,
      roomId: data.roomId,
      bedLabel: data.bedLabel.trim(),
      status: 'vacant',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BED_CREATED',
      entityType: 'beds',
      entityId: bedId,
      details: JSON.stringify({ bedLabel: data.bedLabel, roomId: data.roomId }),
    });

    return created;
  }

  static async updateBed(
    user: SessionUser,
    id: string,
    data: {
      bedLabel?: string;
      status?: 'vacant' | 'occupied' | 'maintenance' | 'decommissioned';
    }
  ): Promise<Bed | null> {
    const updated = await InfrastructureRepository.updateBed(id, data);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BED_UPDATED',
      entityType: 'beds',
      entityId: id,
      details: JSON.stringify(data),
    });

    return updated;
  }

  static async toggleBedStatus(
    user: SessionUser,
    id: string,
    status?: 'vacant' | 'maintenance' | 'decommissioned',
    isArchived?: boolean
  ): Promise<boolean> {
    if (isArchived || status === 'maintenance' || status === 'decommissioned') {
      const hasAlloc = await InfrastructureRepository.hasActiveAllocationsForBed(id);
      if (hasAlloc) {
        throw new Error('CANNOT_MODIFY_BED: Bed is currently occupied by an active student allocation. Please vacate or transfer the student first.');
      }
    }

    const result = await InfrastructureRepository.toggleBedStatus(id, status, isArchived);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: isArchived ? 'BED_ARCHIVED' : `BED_STATUS_${status?.toUpperCase()}`,
      entityType: 'beds',
      entityId: id,
      details: JSON.stringify({ status, isArchived }),
    });

    return result;
  }
}
