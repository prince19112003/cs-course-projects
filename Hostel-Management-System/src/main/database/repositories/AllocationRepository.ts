import { eq, and, desc, count, or, like } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { allocations, Allocation, NewAllocation } from '../schema/allocations.js';
import { beds, rooms, floors, blocks, hostels } from '../schema/infrastructure.js';
import { students } from '../schema/students.js';
import { users } from '../schema/users.js';
import { generateEntityId } from '../utils/id-generator.js';

export interface EnrichedAllocation extends Allocation {
  studentName?: string;
  enrollmentNumber?: string;
  studentPhone?: string;
  bedLabel?: string;
  roomNumber?: string;
  floorName?: string;
  blockName?: string;
  hostelName?: string;
  hostelId?: string;
  allocatedByName?: string;
}

export interface AllocationQueryParams {
  status?: string;
  hostelId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export class AllocationRepository {
  static async getActiveAllocationForStudent(studentId: string): Promise<Allocation | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(allocations)
      .where(and(eq(allocations.studentId, studentId), eq(allocations.status, 'active')))
      .limit(1);
    return rows[0] || null;
  }

  static async getActiveAllocationForBed(bedId: string): Promise<Allocation | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(allocations)
      .where(and(eq(allocations.bedId, bedId), eq(allocations.status, 'active')))
      .limit(1);
    return rows[0] || null;
  }

  static async getAllocationById(id: string): Promise<Allocation | null> {
    const db = getDb();
    const rows = await db.select().from(allocations).where(eq(allocations.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createAllocation(data: NewAllocation): Promise<Allocation> {
    const db = getDb();
    await db.insert(allocations).values(data);
    const rows = await db.select().from(allocations).where(eq(allocations.id, data.id));
    return rows[0];
  }

  /**
   * Executes an atomic allocation transaction guaranteeing:
   * 1. Target bed exists, is active and status is 'vacant'
   * 2. Target room, floor, block, and hostel are active and not in maintenance
   * 3. Student does not already have an active allocation
   * 4. Bed status is changed to 'occupied'
   * 5. Student assignedBedId is updated
   * 6. Allocation record is created
   */
  static async executeAtomicAllocation(params: {
    studentId: string;
    bedId: string;
    allocatedBy: string;
    allocationType?: 'fresh_admission' | 'requested_transfer' | 'administrative_transfer';
    remarks?: string;
  }): Promise<Allocation> {
    const db = getDb();
    const {
      studentId,
      bedId,
      allocatedBy,
      allocationType = 'fresh_admission',
      remarks,
    } = params;

    const allocationId = generateEntityId('ALC');
    const now = Date.now();

    return db.transaction((tx) => {
      // 1. Verify bed is vacant & active
      const bed = tx.select().from(beds).where(eq(beds.id, bedId)).get();
      if (!bed || bed.isArchived === 1) {
        throw new Error(`BED_NOT_FOUND: Bed with ID ${bedId} does not exist or is archived.`);
      }
      if (bed.status !== 'vacant') {
        throw new Error(`BED_OCCUPIED: Bed ${bed.bedLabel} is currently ${bed.status}. Only vacant beds can be allocated.`);
      }

      // 2. Verify parent room/floor/block/hostel are active
      const room = tx.select().from(rooms).where(eq(rooms.id, bed.roomId)).get();
      if (!room || room.isArchived === 1 || room.status === 'maintenance' || room.status === 'decommissioned') {
        throw new Error(`ROOM_UNAVAILABLE: Room is either archived, decommissioned, or under maintenance.`);
      }

      const floor = tx.select().from(floors).where(eq(floors.id, room.floorId)).get();
      if (!floor || floor.isActive === 0) {
        throw new Error(`FLOOR_INACTIVE: Parent floor is currently inactive.`);
      }

      const block = tx.select().from(blocks).where(eq(blocks.id, floor.blockId)).get();
      if (!block || block.isActive === 0) {
        throw new Error(`BLOCK_INACTIVE: Parent block is currently inactive.`);
      }

      const hostel = tx.select().from(hostels).where(eq(hostels.id, block.hostelId)).get();
      if (!hostel || hostel.isActive === 0) {
        throw new Error(`HOSTEL_INACTIVE: Parent hostel is currently inactive.`);
      }

      // 3. Verify student exists and has no active allocation
      const student = tx.select().from(students).where(eq(students.id, studentId)).get();
      if (!student) {
        throw new Error(`STUDENT_NOT_FOUND: Student with ID ${studentId} does not exist.`);
      }

      const existingActive = tx
        .select()
        .from(allocations)
        .where(and(eq(allocations.studentId, studentId), eq(allocations.status, 'active')))
        .get();

      if (existingActive) {
        throw new Error(`STUDENT_ALREADY_ALLOCATED: Student ${student.firstName} ${student.lastName} (${studentId}) is already allocated to bed ${existingActive.bedId}.`);
      }

      // 4. Insert allocation
      tx.insert(allocations).values({
        id: allocationId,
        studentId,
        bedId,
        allocatedAt: now,
        allocationType,
        status: 'active',
        allocatedBy,
        remarks: remarks || null,
      }).run();

      // 5. Update bed status
      tx.update(beds).set({ status: 'occupied', updatedAt: now }).where(eq(beds.id, bedId)).run();

      // 6. Update student assignedBedId
      tx.update(students).set({ assignedBedId: bedId, updatedAt: now }).where(eq(students.id, studentId)).run();

      const created = tx.select().from(allocations).where(eq(allocations.id, allocationId)).get();
      return created!;
    });
  }

  /**
   * Executes an atomic bed transfer transaction:
   * 1. Finds student's current active allocation
   * 2. Verifies destination bed is vacant and hierarchy is active
   * 3. Marks current allocation as 'transferred' with vacatedAt
   * 4. Marks old bed as 'vacant'
   * 5. Marks destination bed as 'occupied'
   * 6. Updates student assignedBedId to destination bed
   * 7. Creates new allocation record for destination bed
   */
  static async executeAtomicTransfer(params: {
    studentId: string;
    destinationBedId: string;
    allocatedBy: string;
    transferType?: 'requested_transfer' | 'administrative_transfer';
    remarks?: string;
  }): Promise<{ oldAllocation: Allocation; newAllocation: Allocation }> {
    const db = getDb();
    const {
      studentId,
      destinationBedId,
      allocatedBy,
      transferType = 'requested_transfer',
      remarks,
    } = params;

    const newAllocationId = generateEntityId('ALC');
    const now = Date.now();

    return db.transaction((tx) => {
      // 1. Locate current active allocation
      const currentActive = tx
        .select()
        .from(allocations)
        .where(and(eq(allocations.studentId, studentId), eq(allocations.status, 'active')))
        .get();

      if (!currentActive) {
        throw new Error(`NO_ACTIVE_ALLOCATION: Student ${studentId} does not currently have an active bed allocation to transfer.`);
      }

      if (currentActive.bedId === destinationBedId) {
        throw new Error(`IDENTICAL_BED_TRANSFER: Destination bed is identical to current assigned bed.`);
      }

      // 2. Validate destination bed
      const destBed = tx.select().from(beds).where(eq(beds.id, destinationBedId)).get();
      if (!destBed || destBed.isArchived === 1) {
        throw new Error(`DESTINATION_BED_NOT_FOUND: Target bed ${destinationBedId} does not exist or is archived.`);
      }
      if (destBed.status !== 'vacant') {
        throw new Error(`DESTINATION_BED_UNAVAILABLE: Target bed ${destBed.bedLabel} is currently ${destBed.status}.`);
      }

      // 3. Validate destination hierarchy
      const room = tx.select().from(rooms).where(eq(rooms.id, destBed.roomId)).get();
      if (!room || room.isArchived === 1 || room.status === 'maintenance' || room.status === 'decommissioned') {
        throw new Error(`DESTINATION_ROOM_UNAVAILABLE: Target room is not in an available operational status.`);
      }

      const floor = tx.select().from(floors).where(eq(floors.id, room.floorId)).get();
      if (!floor || floor.isActive === 0) {
        throw new Error(`DESTINATION_FLOOR_INACTIVE: Target floor is inactive.`);
      }

      const block = tx.select().from(blocks).where(eq(blocks.id, floor.blockId)).get();
      if (!block || block.isActive === 0) {
        throw new Error(`DESTINATION_BLOCK_INACTIVE: Target block is inactive.`);
      }

      const hostel = tx.select().from(hostels).where(eq(hostels.id, block.hostelId)).get();
      if (!hostel || hostel.isActive === 0) {
        throw new Error(`DESTINATION_HOSTEL_INACTIVE: Target hostel is inactive.`);
      }

      // 4. Mark old allocation as transferred
      tx.update(allocations)
        .set({ status: 'transferred', vacatedAt: now })
        .where(eq(allocations.id, currentActive.id))
        .run();

      // 5. Vacate previous bed
      tx.update(beds).set({ status: 'vacant', updatedAt: now }).where(eq(beds.id, currentActive.bedId)).run();

      // 6. Occupy destination bed
      tx.update(beds).set({ status: 'occupied', updatedAt: now }).where(eq(beds.id, destinationBedId)).run();

      // 7. Update student assignedBedId
      tx.update(students).set({ assignedBedId: destinationBedId, updatedAt: now }).where(eq(students.id, studentId)).run();

      // 8. Create new active allocation
      tx.insert(allocations).values({
        id: newAllocationId,
        studentId,
        bedId: destinationBedId,
        allocatedAt: now,
        allocationType: transferType,
        status: 'active',
        allocatedBy,
        remarks: remarks || `Transferred from bed ${currentActive.bedId}`,
      }).run();

      const oldAlloc = tx.select().from(allocations).where(eq(allocations.id, currentActive.id)).get()!;
      const newAlloc = tx.select().from(allocations).where(eq(allocations.id, newAllocationId)).get()!;

      return { oldAllocation: oldAlloc, newAllocation: newAlloc };
    });
  }

  /**
   * Vacates an active allocation atomically.
   */
  static async executeAtomicVacate(allocationId: string, remarks?: string): Promise<Allocation> {
    const db = getDb();
    const now = Date.now();

    return db.transaction((tx) => {
      const alloc = tx.select().from(allocations).where(eq(allocations.id, allocationId)).get();
      if (!alloc) {
        throw new Error(`ALLOCATION_NOT_FOUND: Allocation with ID ${allocationId} does not exist.`);
      }
      if (alloc.status !== 'active') {
        throw new Error(`ALLOCATION_NOT_ACTIVE: Allocation ${allocationId} is already ${alloc.status}.`);
      }

      // 1. Mark allocation vacated
      tx.update(allocations)
        .set({
          status: 'vacated',
          vacatedAt: now,
          remarks: remarks ? `${alloc.remarks || ''} [Checkout: ${remarks}]`.trim() : alloc.remarks,
        })
        .where(eq(allocations.id, allocationId))
        .run();

      // 2. Mark bed vacant
      tx.update(beds).set({ status: 'vacant', updatedAt: now }).where(eq(beds.id, alloc.bedId)).run();

      // 3. Clear student assignedBedId
      tx.update(students)
        .set({ assignedBedId: null, updatedAt: now })
        .where(eq(students.id, alloc.studentId))
        .run();

      const updated = tx.select().from(allocations).where(eq(allocations.id, allocationId)).get();
      return updated!;
    });
  }

  /**
   * Enriched multi-table query returning allocations joined with student and spatial infrastructure details.
   */
  static async getAllocations(params: AllocationQueryParams = {}): Promise<{ data: EnrichedAllocation[]; total: number }> {
    const db = getDb();

    // Query joined records
    const allRecords = await db
      .select({
        id: allocations.id,
        studentId: allocations.studentId,
        bedId: allocations.bedId,
        allocatedAt: allocations.allocatedAt,
        vacatedAt: allocations.vacatedAt,
        allocationType: allocations.allocationType,
        status: allocations.status,
        allocatedBy: allocations.allocatedBy,
        remarks: allocations.remarks,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        studentPhone: students.phone,
        bedLabel: beds.bedLabel,
        roomId: rooms.id,
        roomNumber: rooms.roomNumber,
        floorId: floors.id,
        floorName: floors.name,
        blockId: blocks.id,
        blockName: blocks.name,
        hostelId: hostels.id,
        hostelName: hostels.name,
        allocatedByName: users.name,
      })
      .from(allocations)
      .leftJoin(students, eq(allocations.studentId, students.id))
      .leftJoin(beds, eq(allocations.bedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(floors, eq(rooms.floorId, floors.id))
      .leftJoin(blocks, eq(floors.blockId, blocks.id))
      .leftJoin(hostels, eq(blocks.hostelId, hostels.id))
      .leftJoin(users, eq(allocations.allocatedBy, users.id))
      .orderBy(desc(allocations.allocatedAt));

    // Filter in-memory for flexible cross-module searching
    let filtered = allRecords;
    if (params.status) {
      filtered = filtered.filter((r) => r.status === params.status);
    }
    if (params.hostelId) {
      filtered = filtered.filter((r) => r.hostelId === params.hostelId);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter((r) => {
        const fullName = `${r.studentFirstName || ''} ${r.studentLastName || ''}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (r.enrollmentNumber && r.enrollmentNumber.toLowerCase().includes(q)) ||
          (r.studentId && r.studentId.toLowerCase().includes(q)) ||
          (r.roomNumber && r.roomNumber.toLowerCase().includes(q)) ||
          (r.bedLabel && r.bedLabel.toLowerCase().includes(q))
        );
      });
    }

    const total = filtered.length;
    let paginated = filtered;
    if (params.pageSize) {
      const page = params.page || 1;
      const offset = (page - 1) * params.pageSize;
      paginated = filtered.slice(offset, offset + params.pageSize);
    }

    const data: EnrichedAllocation[] = paginated.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      bedId: r.bedId,
      allocatedAt: r.allocatedAt,
      vacatedAt: r.vacatedAt,
      allocationType: r.allocationType as any,
      status: r.status as any,
      allocatedBy: r.allocatedBy,
      remarks: r.remarks,
      studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : r.studentId,
      enrollmentNumber: r.enrollmentNumber || undefined,
      studentPhone: r.studentPhone || undefined,
      bedLabel: r.bedLabel || undefined,
      roomNumber: r.roomNumber || undefined,
      floorName: r.floorName || undefined,
      blockName: r.blockName || undefined,
      hostelName: r.hostelName || undefined,
      hostelId: r.hostelId || undefined,
      allocatedByName: r.allocatedByName || undefined,
    }));

    return { data, total };
  }

  static async getAllocationHistory(studentId?: string, bedId?: string): Promise<EnrichedAllocation[]> {
    const res = await this.getAllocations();
    let result = res.data;
    if (studentId) {
      result = result.filter((a) => a.studentId === studentId);
    }
    if (bedId) {
      result = result.filter((a) => a.bedId === bedId);
    }
    return result;
  }
}
