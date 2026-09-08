import { eq, and, count, inArray } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { hostels, blocks, floors, rooms, beds } from '../schema/infrastructure.js';

export interface OccupancyMetrics {
  totalHostels?: number;
  totalBlocks?: number;
  totalFloors?: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  maintenanceBeds: number;
  occupancyPercentage: number;
}

export class OccupancyCalculator {
  /**
   * Calculates real-time occupancy metrics for a single room.
   */
  static async calculateRoomOccupancy(roomId: string): Promise<{
    roomId: string;
    capacity: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    maintenanceBeds: number;
    dynamicStatus: 'available' | 'partially_occupied' | 'full' | 'maintenance' | 'decommissioned';
  }> {
    const db = getDb();
    const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    const room = roomRows[0];
    if (!room) {
      throw new Error(`Room with ID ${roomId} not found.`);
    }

    const roomBeds = await db.select().from(beds).where(and(eq(beds.roomId, roomId), eq(beds.isArchived, 0)));
    const totalBeds = roomBeds.length;
    const occupiedBeds = roomBeds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = roomBeds.filter((b) => b.status === 'vacant').length;
    const maintenanceBeds = roomBeds.filter((b) => b.status === 'maintenance').length;

    let dynamicStatus: 'available' | 'partially_occupied' | 'full' | 'maintenance' | 'decommissioned';
    if (room.status === 'maintenance' || room.status === 'decommissioned') {
      dynamicStatus = room.status;
    } else if (occupiedBeds >= room.capacity || (totalBeds > 0 && vacantBeds === 0)) {
      dynamicStatus = 'full';
    } else if (occupiedBeds > 0 && vacantBeds > 0) {
      dynamicStatus = 'partially_occupied';
    } else {
      dynamicStatus = 'available';
    }

    return {
      roomId,
      capacity: room.capacity,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      maintenanceBeds,
      dynamicStatus,
    };
  }

  /**
   * Calculates occupancy metrics for a floor.
   */
  static async calculateFloorOccupancy(floorId: string): Promise<OccupancyMetrics> {
    const db = getDb();
    const floorRooms = await db.select().from(rooms).where(and(eq(rooms.floorId, floorId), eq(rooms.isArchived, 0)));
    const roomIds = floorRooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return {
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        maintenanceBeds: 0,
        occupancyPercentage: 0,
      };
    }

    const floorBeds = await db.select().from(beds).where(and(inArray(beds.roomId, roomIds), eq(beds.isArchived, 0)));
    const totalBeds = floorBeds.length;
    const occupiedBeds = floorBeds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = floorBeds.filter((b) => b.status === 'vacant').length;
    const maintenanceBeds = floorBeds.filter((b) => b.status === 'maintenance').length;

    return {
      totalRooms: floorRooms.length,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      maintenanceBeds,
      occupancyPercentage: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    };
  }

  /**
   * Calculates occupancy metrics for a block.
   */
  static async calculateBlockOccupancy(blockId: string): Promise<OccupancyMetrics> {
    const db = getDb();
    const blockFloors = await db.select().from(floors).where(and(eq(floors.blockId, blockId), eq(floors.isActive, 1)));
    const floorIds = blockFloors.map((f) => f.id);

    if (floorIds.length === 0) {
      return {
        totalFloors: 0,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        maintenanceBeds: 0,
        occupancyPercentage: 0,
      };
    }

    const blockRooms = await db.select().from(rooms).where(and(inArray(rooms.floorId, floorIds), eq(rooms.isArchived, 0)));
    const roomIds = blockRooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return {
        totalFloors: blockFloors.length,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        maintenanceBeds: 0,
        occupancyPercentage: 0,
      };
    }

    const blockBeds = await db.select().from(beds).where(and(inArray(beds.roomId, roomIds), eq(beds.isArchived, 0)));
    const totalBeds = blockBeds.length;
    const occupiedBeds = blockBeds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = blockBeds.filter((b) => b.status === 'vacant').length;
    const maintenanceBeds = blockBeds.filter((b) => b.status === 'maintenance').length;

    return {
      totalFloors: blockFloors.length,
      totalRooms: blockRooms.length,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      maintenanceBeds,
      occupancyPercentage: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    };
  }

  /**
   * Calculates occupancy metrics for an entire hostel.
   */
  static async calculateHostelOccupancy(hostelId: string): Promise<OccupancyMetrics> {
    const db = getDb();
    const hostelBlocks = await db.select().from(blocks).where(and(eq(blocks.hostelId, hostelId), eq(blocks.isActive, 1)));
    const blockIds = hostelBlocks.map((b) => b.id);

    if (blockIds.length === 0) {
      return {
        totalBlocks: 0,
        totalFloors: 0,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        maintenanceBeds: 0,
        occupancyPercentage: 0,
      };
    }

    const hostelFloors = await db.select().from(floors).where(and(inArray(floors.blockId, blockIds), eq(floors.isActive, 1)));
    const floorIds = hostelFloors.map((f) => f.id);

    if (floorIds.length === 0) {
      return {
        totalBlocks: hostelBlocks.length,
        totalFloors: 0,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        maintenanceBeds: 0,
        occupancyPercentage: 0,
      };
    }

    const hostelRooms = await db.select().from(rooms).where(and(inArray(rooms.floorId, floorIds), eq(rooms.isArchived, 0)));
    const roomIds = hostelRooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return {
        totalBlocks: hostelBlocks.length,
        totalFloors: hostelFloors.length,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        maintenanceBeds: 0,
        occupancyPercentage: 0,
      };
    }

    const hostelBeds = await db.select().from(beds).where(and(inArray(beds.roomId, roomIds), eq(beds.isArchived, 0)));
    const totalBeds = hostelBeds.length;
    const occupiedBeds = hostelBeds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = hostelBeds.filter((b) => b.status === 'vacant').length;
    const maintenanceBeds = hostelBeds.filter((b) => b.status === 'maintenance').length;

    return {
      totalBlocks: hostelBlocks.length,
      totalFloors: hostelFloors.length,
      totalRooms: hostelRooms.length,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      maintenanceBeds,
      occupancyPercentage: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    };
  }

  /**
   * Campus-wide overall occupancy metrics across all active hostels.
   */
  static async calculateCampusOccupancy(): Promise<OccupancyMetrics> {
    const db = getDb();
    const [hCount, blkCount, flrCount, rCount, bCount, occCount, vacCount, maintCount] = await Promise.all([
      db.select({ value: count() }).from(hostels).where(eq(hostels.isActive, 1)),
      db.select({ value: count() }).from(blocks).where(eq(blocks.isActive, 1)),
      db.select({ value: count() }).from(floors).where(eq(floors.isActive, 1)),
      db.select({ value: count() }).from(rooms).where(eq(rooms.isArchived, 0)),
      db.select({ value: count() }).from(beds).where(eq(beds.isArchived, 0)),
      db.select({ value: count() }).from(beds).where(and(eq(beds.status, 'occupied'), eq(beds.isArchived, 0))),
      db.select({ value: count() }).from(beds).where(and(eq(beds.status, 'vacant'), eq(beds.isArchived, 0))),
      db.select({ value: count() }).from(beds).where(and(eq(beds.status, 'maintenance'), eq(beds.isArchived, 0))),
    ]);

    const totalBeds = bCount[0]?.value || 0;
    const occupiedBeds = occCount[0]?.value || 0;

    return {
      totalHostels: hCount[0]?.value || 0,
      totalBlocks: blkCount[0]?.value || 0,
      totalFloors: flrCount[0]?.value || 0,
      totalRooms: rCount[0]?.value || 0,
      totalBeds,
      occupiedBeds,
      vacantBeds: vacCount[0]?.value || 0,
      maintenanceBeds: maintCount[0]?.value || 0,
      occupancyPercentage: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    };
  }
}
