import { eq, and, count, inArray, like, or } from 'drizzle-orm';
import { getDb } from '../connection.js';
import {
  hostels,
  blocks,
  floors,
  rooms,
  beds,
  Hostel,
  Block,
  Floor,
  Room,
  Bed,
} from '../schema/infrastructure.js';
import { allocations } from '../schema/allocations.js';

export interface RoomWithBeds extends Room {
  beds: Bed[];
}

export interface BlockWithRooms extends Block {
  rooms: RoomWithBeds[];
}

export interface RoomQueryParams {
  hostelId?: string;
  blockId?: string;
  floorId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}

export interface BedQueryParams {
  roomId?: string;
  status?: string;
  search?: string;
  includeArchived?: boolean;
}

export class InfrastructureRepository {
  // --------------------------------------------------------------------------
  // HOSTELS
  // --------------------------------------------------------------------------
  static async getHostels(includeInactive = false): Promise<Hostel[]> {
    const db = getDb();
    if (includeInactive) {
      return db.select().from(hostels);
    }
    return db.select().from(hostels).where(eq(hostels.isActive, 1));
  }

  static async getHostelById(id: string): Promise<Hostel | null> {
    const db = getDb();
    const rows = await db.select().from(hostels).where(eq(hostels.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createHostel(data: typeof hostels.$inferInsert): Promise<Hostel> {
    const db = getDb();
    await db.insert(hostels).values(data);
    const rows = await db.select().from(hostels).where(eq(hostels.id, data.id));
    return rows[0];
  }

  static async updateHostel(id: string, data: Partial<typeof hostels.$inferInsert>): Promise<Hostel | null> {
    const db = getDb();
    await db.update(hostels).set({ ...data, updatedAt: Date.now() }).where(eq(hostels.id, id));
    return this.getHostelById(id);
  }

  static async toggleHostelStatus(id: string, isActive: boolean): Promise<boolean> {
    const db = getDb();
    await db.update(hostels).set({ isActive: isActive ? 1 : 0, updatedAt: Date.now() }).where(eq(hostels.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // BLOCKS
  // --------------------------------------------------------------------------
  static async getBlocks(hostelId?: string, includeInactive = false): Promise<Block[]> {
    const db = getDb();
    const conditions = [];
    if (hostelId) {
      conditions.push(eq(blocks.hostelId, hostelId));
    }
    if (!includeInactive) {
      conditions.push(eq(blocks.isActive, 1));
    }

    if (conditions.length === 0) {
      return db.select().from(blocks);
    }
    return db.select().from(blocks).where(and(...conditions));
  }

  static async getBlocksByHostel(hostelId: string): Promise<Block[]> {
    return this.getBlocks(hostelId, false);
  }

  static async getBlockById(id: string): Promise<Block | null> {
    const db = getDb();
    const rows = await db.select().from(blocks).where(eq(blocks.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createBlock(data: typeof blocks.$inferInsert): Promise<Block> {
    const db = getDb();
    await db.insert(blocks).values(data);
    const rows = await db.select().from(blocks).where(eq(blocks.id, data.id));
    return rows[0];
  }

  static async updateBlock(id: string, data: Partial<typeof blocks.$inferInsert>): Promise<Block | null> {
    const db = getDb();
    await db.update(blocks).set({ ...data, updatedAt: Date.now() }).where(eq(blocks.id, id));
    return this.getBlockById(id);
  }

  static async toggleBlockStatus(id: string, isActive: boolean): Promise<boolean> {
    const db = getDb();
    await db.update(blocks).set({ isActive: isActive ? 1 : 0, updatedAt: Date.now() }).where(eq(blocks.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // FLOORS
  // --------------------------------------------------------------------------
  static async getFloors(blockId?: string, includeInactive = false): Promise<Floor[]> {
    const db = getDb();
    const conditions = [];
    if (blockId) {
      conditions.push(eq(floors.blockId, blockId));
    }
    if (!includeInactive) {
      conditions.push(eq(floors.isActive, 1));
    }

    if (conditions.length === 0) {
      return db.select().from(floors);
    }
    return db.select().from(floors).where(and(...conditions));
  }

  static async getFloorsByBlock(blockId: string): Promise<Floor[]> {
    return this.getFloors(blockId, false);
  }

  static async getFloorById(id: string): Promise<Floor | null> {
    const db = getDb();
    const rows = await db.select().from(floors).where(eq(floors.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createFloor(data: typeof floors.$inferInsert): Promise<Floor> {
    const db = getDb();
    await db.insert(floors).values(data);
    const rows = await db.select().from(floors).where(eq(floors.id, data.id));
    return rows[0];
  }

  static async updateFloor(id: string, data: Partial<typeof floors.$inferInsert>): Promise<Floor | null> {
    const db = getDb();
    await db.update(floors).set(data).where(eq(floors.id, id));
    return this.getFloorById(id);
  }

  static async toggleFloorStatus(id: string, isActive: boolean): Promise<boolean> {
    const db = getDb();
    await db.update(floors).set({ isActive: isActive ? 1 : 0 }).where(eq(floors.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // ROOMS
  // --------------------------------------------------------------------------
  static async getRooms(params: RoomQueryParams = {}): Promise<{ data: Room[]; total: number }> {
    const db = getDb();
    const conditions = [];

    if (!params.includeArchived) {
      conditions.push(eq(rooms.isArchived, 0));
    }
    if (params.floorId) {
      conditions.push(eq(rooms.floorId, params.floorId));
    }
    if (params.status) {
      conditions.push(eq(rooms.status, params.status));
    }
    if (params.search) {
      conditions.push(like(rooms.roomNumber, `%${params.search}%`));
    }

    // If blockId or hostelId specified, filter by floorIds
    if (params.blockId && !params.floorId) {
      const blockFloors = await this.getFloors(params.blockId, true);
      const floorIds = blockFloors.map((f) => f.id);
      if (floorIds.length > 0) {
        conditions.push(inArray(rooms.floorId, floorIds));
      } else {
        return { data: [], total: 0 };
      }
    } else if (params.hostelId && !params.blockId && !params.floorId) {
      const hostelBlocks = await this.getBlocks(params.hostelId, true);
      const blockIds = hostelBlocks.map((b) => b.id);
      if (blockIds.length > 0) {
        const blockFloors = await db.select().from(floors).where(inArray(floors.blockId, blockIds));
        const floorIds = blockFloors.map((f) => f.id);
        if (floorIds.length > 0) {
          conditions.push(inArray(rooms.floorId, floorIds));
        } else {
          return { data: [], total: 0 };
        }
      } else {
        return { data: [], total: 0 };
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: count() })
      .from(rooms)
      .where(whereClause);
    const total = totalRes?.count || 0;

    let query = db.select().from(rooms).where(whereClause);
    if (params.pageSize) {
      const page = params.page || 1;
      const offset = (page - 1) * params.pageSize;
      query = (query as any).limit(params.pageSize).offset(offset);
    }

    const data = await query;
    return { data, total };
  }

  static async getRoomsByFloor(floorId: string): Promise<Room[]> {
    const res = await this.getRooms({ floorId, includeArchived: false });
    return res.data;
  }

  static async getRoomById(id: string): Promise<Room | null> {
    const db = getDb();
    const rows = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createRoom(data: typeof rooms.$inferInsert): Promise<Room> {
    const db = getDb();
    await db.insert(rooms).values(data);
    const rows = await db.select().from(rooms).where(eq(rooms.id, data.id));
    return rows[0];
  }

  static async updateRoom(id: string, data: Partial<typeof rooms.$inferInsert>): Promise<Room | null> {
    const db = getDb();
    await db.update(rooms).set({ ...data, updatedAt: Date.now() }).where(eq(rooms.id, id));
    return this.getRoomById(id);
  }

  static async toggleRoomStatus(id: string, status?: string, isArchived?: boolean): Promise<boolean> {
    const db = getDb();
    const updateData: any = { updatedAt: Date.now() };
    if (status) updateData.status = status;
    if (isArchived !== undefined) updateData.isArchived = isArchived ? 1 : 0;
    await db.update(rooms).set(updateData).where(eq(rooms.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // BEDS
  // --------------------------------------------------------------------------
  static async getBeds(params: BedQueryParams = {}): Promise<Bed[]> {
    const db = getDb();
    const conditions = [];

    if (!params.includeArchived) {
      conditions.push(eq(beds.isArchived, 0));
    }
    if (params.roomId) {
      conditions.push(eq(beds.roomId, params.roomId));
    }
    if (params.status) {
      conditions.push(eq(beds.status, params.status));
    }
    if (params.search) {
      conditions.push(like(beds.bedLabel, `%${params.search}%`));
    }

    if (conditions.length === 0) {
      return db.select().from(beds);
    }
    return db.select().from(beds).where(and(...conditions));
  }

  static async getBedsByRoom(roomId: string): Promise<Bed[]> {
    return this.getBeds({ roomId, includeArchived: false });
  }

  static async getBedById(id: string): Promise<Bed | null> {
    const db = getDb();
    const rows = await db.select().from(beds).where(eq(beds.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createBed(data: typeof beds.$inferInsert): Promise<Bed> {
    const db = getDb();
    await db.insert(beds).values(data);
    const rows = await db.select().from(beds).where(eq(beds.id, data.id));
    return rows[0];
  }

  static async updateBed(id: string, data: Partial<typeof beds.$inferInsert>): Promise<Bed | null> {
    const db = getDb();
    await db.update(beds).set({ ...data, updatedAt: Date.now() }).where(eq(beds.id, id));
    return this.getBedById(id);
  }

  static async toggleBedStatus(id: string, status?: string, isArchived?: boolean): Promise<boolean> {
    const db = getDb();
    const updateData: any = { updatedAt: Date.now() };
    if (status) updateData.status = status;
    if (isArchived !== undefined) updateData.isArchived = isArchived ? 1 : 0;
    await db.update(beds).set(updateData).where(eq(beds.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // ACTIVE ALLOCATION CHECK GUARDS
  // --------------------------------------------------------------------------
  static async hasActiveAllocationsForBed(bedId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .select({ count: count() })
      .from(allocations)
      .where(and(eq(allocations.bedId, bedId), eq(allocations.status, 'active')));
    return (rows[0]?.count || 0) > 0;
  }

  static async hasActiveAllocationsForRoom(roomId: string): Promise<boolean> {
    const db = getDb();
    const roomBeds = await this.getBedsByRoom(roomId);
    const bedIds = roomBeds.map((b) => b.id);
    if (bedIds.length === 0) return false;

    const rows = await db
      .select({ count: count() })
      .from(allocations)
      .where(and(inArray(allocations.bedId, bedIds), eq(allocations.status, 'active')));
    return (rows[0]?.count || 0) > 0;
  }

  static async hasActiveAllocationsForFloor(floorId: string): Promise<boolean> {
    const db = getDb();
    const floorRooms = await this.getRoomsByFloor(floorId);
    const roomIds = floorRooms.map((r) => r.id);
    if (roomIds.length === 0) return false;

    const floorBeds = await db.select().from(beds).where(inArray(beds.roomId, roomIds));
    const bedIds = floorBeds.map((b) => b.id);
    if (bedIds.length === 0) return false;

    const rows = await db
      .select({ count: count() })
      .from(allocations)
      .where(and(inArray(allocations.bedId, bedIds), eq(allocations.status, 'active')));
    return (rows[0]?.count || 0) > 0;
  }

  static async hasActiveAllocationsForBlock(blockId: string): Promise<boolean> {
    const db = getDb();
    const blockFloors = await this.getFloorsByBlock(blockId);
    const floorIds = blockFloors.map((f) => f.id);
    if (floorIds.length === 0) return false;

    const blockRooms = await db.select().from(rooms).where(inArray(rooms.floorId, floorIds));
    const roomIds = blockRooms.map((r) => r.id);
    if (roomIds.length === 0) return false;

    const blockBeds = await db.select().from(beds).where(inArray(beds.roomId, roomIds));
    const bedIds = blockBeds.map((b) => b.id);
    if (bedIds.length === 0) return false;

    const rows = await db
      .select({ count: count() })
      .from(allocations)
      .where(and(inArray(allocations.bedId, bedIds), eq(allocations.status, 'active')));
    return (rows[0]?.count || 0) > 0;
  }

  static async hasActiveAllocationsForHostel(hostelId: string): Promise<boolean> {
    const db = getDb();
    const hostelBlocks = await this.getBlocksByHostel(hostelId);
    const blockIds = hostelBlocks.map((b) => b.id);
    if (blockIds.length === 0) return false;

    const hostelFloors = await db.select().from(floors).where(inArray(floors.blockId, blockIds));
    const floorIds = hostelFloors.map((f) => f.id);
    if (floorIds.length === 0) return false;

    const hostelRooms = await db.select().from(rooms).where(inArray(rooms.floorId, floorIds));
    const roomIds = hostelRooms.map((r) => r.id);
    if (roomIds.length === 0) return false;

    const hostelBeds = await db.select().from(beds).where(inArray(beds.roomId, roomIds));
    const bedIds = hostelBeds.map((b) => b.id);
    if (bedIds.length === 0) return false;

    const rows = await db
      .select({ count: count() })
      .from(allocations)
      .where(and(inArray(allocations.bedId, bedIds), eq(allocations.status, 'active')));
    return (rows[0]?.count || 0) > 0;
  }

  // --------------------------------------------------------------------------
  // ROOM MATRIX & STATS
  // --------------------------------------------------------------------------
  static async getRoomMatrix(hostelId?: string): Promise<BlockWithRooms[]> {
    const db = getDb();

    const blockList = hostelId
      ? await db.select().from(blocks).where(and(eq(blocks.hostelId, hostelId), eq(blocks.isActive, 1)))
      : await db.select().from(blocks).where(eq(blocks.isActive, 1));

    const result: BlockWithRooms[] = [];

    for (const block of blockList) {
      const floorList = await db.select().from(floors).where(and(eq(floors.blockId, block.id), eq(floors.isActive, 1)));
      const floorIds = floorList.map((f) => f.id);

      const blockRoomsWithBeds: RoomWithBeds[] = [];

      for (const floorId of floorIds) {
        const floorRooms = await db.select().from(rooms).where(and(eq(rooms.floorId, floorId), eq(rooms.isArchived, 0)));
        for (const r of floorRooms) {
          const roomBeds = await db.select().from(beds).where(and(eq(beds.roomId, r.id), eq(beds.isArchived, 0)));
          blockRoomsWithBeds.push({
            ...r,
            beds: roomBeds,
          });
        }
      }

      result.push({
        ...block,
        rooms: blockRoomsWithBeds,
      });
    }

    return result;
  }

  static async getStats(): Promise<{
    totalHostels: number;
    totalBlocks: number;
    totalRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
  }> {
    const db = getDb();
    const [hCount, blkCount, rCount, bCount, occCount, vacCount] = await Promise.all([
      db.select({ value: count() }).from(hostels).where(eq(hostels.isActive, 1)),
      db.select({ value: count() }).from(blocks).where(eq(blocks.isActive, 1)),
      db.select({ value: count() }).from(rooms).where(eq(rooms.isArchived, 0)),
      db.select({ value: count() }).from(beds).where(eq(beds.isArchived, 0)),
      db.select({ value: count() }).from(beds).where(and(eq(beds.status, 'occupied'), eq(beds.isArchived, 0))),
      db.select({ value: count() }).from(beds).where(and(eq(beds.status, 'vacant'), eq(beds.isArchived, 0))),
    ]);

    return {
      totalHostels: hCount[0]?.value || 0,
      totalBlocks: blkCount[0]?.value || 0,
      totalRooms: rCount[0]?.value || 0,
      totalBeds: bCount[0]?.value || 0,
      occupiedBeds: occCount[0]?.value || 0,
      vacantBeds: vacCount[0]?.value || 0,
    };
  }
}
