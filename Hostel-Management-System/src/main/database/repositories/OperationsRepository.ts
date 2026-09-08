import { eq, and, desc, asc, count, or, like, sql, isNull } from 'drizzle-orm';
import { getDb } from '../connection.js';
import {
  staff,
  attendance,
  gatePasses,
  complaints,
  messOptOuts,
  notices,
  visitors,
  Staff,
  Attendance,
  GatePass,
  Complaint,
  MessOptOut,
  Notice,
  Visitor,
} from '../schema/operations.js';
import { roomAssets, RoomAsset, rooms, beds, floors, blocks, hostels } from '../schema/infrastructure.js';
import { students } from '../schema/students.js';
import { users } from '../schema/users.js';
import { generateEntityId } from '../utils/id-generator.js';
import {
  AttendanceDto,
  AttendanceSummaryDto,
  GatePassDto,
  ComplaintDto,
  NoticeDto,
  VisitorDto,
  StaffDto,
  RoomAssetDto,
  MessOptOutDto,
} from '../../shared/types.js';

export class OperationsRepository {
  // --------------------------------------------------------------------------
  // ATTENDANCE
  // --------------------------------------------------------------------------
  static async markAttendanceBatch(
    records: Array<{
      studentId: string;
      date: string;
      status: 'present' | 'absent' | 'approved_leave' | 'late';
      recordedBy: string;
      remarks?: string;
    }>
  ): Promise<{ savedCount: number }> {
    const db = getDb();
    const now = Date.now();

    return db.transaction((tx) => {
      let count = 0;
      for (const rec of records) {
        const existing = tx
          .select()
          .from(attendance)
          .where(and(eq(attendance.date, rec.date), eq(attendance.studentId, rec.studentId)))
          .get();

        if (existing) {
          tx.update(attendance)
            .set({
              status: rec.status,
              recordedBy: rec.recordedBy,
              remarks: rec.remarks || existing.remarks,
              recordedAt: now,
            })
            .where(eq(attendance.id, existing.id))
            .run();
        } else {
          const id = generateEntityId('ATT');
          tx.insert(attendance)
            .values({
              id,
              studentId: rec.studentId,
              date: rec.date,
              status: rec.status,
              recordedBy: rec.recordedBy,
              remarks: rec.remarks || null,
              recordedAt: now,
            })
            .run();
        }
        count++;
      }
      return { savedCount: count };
    });
  }

  static async getAttendanceByDate(params: {
    date: string;
    hostelId?: string;
    blockId?: string;
  }): Promise<AttendanceDto[]> {
    const db = getDb();

    const rows = await db
      .select({
        id: attendance.id,
        studentId: attendance.studentId,
        date: attendance.date,
        status: attendance.status,
        recordedBy: attendance.recordedBy,
        remarks: attendance.remarks,
        recordedAt: attendance.recordedAt,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        bedLabel: beds.bedLabel,
        roomNumber: rooms.roomNumber,
        hostelName: hostels.name,
        hostelId: hostels.id,
        blockId: blocks.id,
      })
      .from(attendance)
      .leftJoin(students, eq(attendance.studentId, students.id))
      .leftJoin(beds, eq(students.assignedBedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(floors, eq(rooms.floorId, floors.id))
      .leftJoin(blocks, eq(floors.blockId, blocks.id))
      .leftJoin(hostels, eq(blocks.hostelId, hostels.id))
      .where(eq(attendance.date, params.date));

    let filtered = rows;
    if (params.hostelId && params.hostelId !== 'all') {
      filtered = filtered.filter((r) => r.hostelId === params.hostelId);
    }
    if (params.blockId && params.blockId !== 'all') {
      filtered = filtered.filter((r) => r.blockId === params.blockId);
    }

    return filtered.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      date: r.date,
      status: r.status as any,
      recordedBy: r.recordedBy,
      remarks: r.remarks,
      recordedAt: r.recordedAt,
      studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : undefined,
      enrollmentNumber: r.enrollmentNumber || undefined,
      roomNumber: r.roomNumber || undefined,
      bedLabel: r.bedLabel || undefined,
      hostelName: r.hostelName || undefined,
    }));
  }

  static async getAttendanceSummary(date: string, hostelId?: string): Promise<AttendanceSummaryDto> {
    const list = await this.getAttendanceByDate({ date, hostelId });
    const total = list.length;
    let present = 0;
    let absent = 0;
    let approvedLeave = 0;
    let late = 0;

    for (const item of list) {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'approved_leave') approvedLeave++;
      else if (item.status === 'late') late++;
    }

    return {
      date,
      totalResidents: total,
      present,
      absent,
      approvedLeave,
      late,
      unmarked: 0,
    };
  }

  static async getAttendanceHistory(studentId: string, limit = 50): Promise<AttendanceDto[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(attendance)
      .where(eq(attendance.studentId, studentId))
      .orderBy(desc(attendance.date))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      date: r.date,
      status: r.status as any,
      recordedBy: r.recordedBy,
      remarks: r.remarks,
      recordedAt: r.recordedAt,
    }));
  }

  // --------------------------------------------------------------------------
  // GATE PASSES / LEAVE
  // --------------------------------------------------------------------------
  static async getGatePasses(params: {
    status?: string;
    studentId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: GatePassDto[]; total: number }> {
    const db = getDb();
    const { status, studentId, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(gatePasses.status, status));
    if (studentId) conditions.push(eq(gatePasses.studentId, studentId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        gp: gatePasses,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        studentPhone: students.phone,
        roomNumber: rooms.roomNumber,
        reviewerName: users.name,
      })
      .from(gatePasses)
      .leftJoin(students, eq(gatePasses.studentId, students.id))
      .leftJoin(beds, eq(students.assignedBedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(users, eq(gatePasses.reviewedBy, users.id))
      .where(whereClause)
      .orderBy(desc(gatePasses.createdAt))
      .limit(limit)
      .offset(offset);

    const countRes = await db
      .select({ value: count() })
      .from(gatePasses)
      .where(whereClause);

    return {
      data: rows.map((r) => ({
        id: r.gp.id,
        studentId: r.gp.studentId,
        passType: r.gp.passType as any,
        reason: r.gp.reason,
        destination: r.gp.destination,
        departureTime: r.gp.departureTime,
        expectedReturnTime: r.gp.expectedReturnTime,
        actualExitTime: r.gp.actualExitTime,
        actualReturnTime: r.gp.actualReturnTime,
        status: r.gp.status as any,
        reviewedBy: r.gp.reviewedBy,
        reviewNotes: r.gp.reviewNotes,
        createdAt: r.gp.createdAt,
        studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : undefined,
        enrollmentNumber: r.enrollmentNumber || undefined,
        studentPhone: r.studentPhone || undefined,
        roomNumber: r.roomNumber || undefined,
        reviewerName: r.reviewerName || undefined,
      })),
      total: countRes[0]?.value || 0,
    };
  }

  static async createGatePass(data: {
    studentId: string;
    passType: 'day_out' | 'night_out' | 'vacation' | 'emergency';
    reason: string;
    destination: string;
    departureTime: number;
    expectedReturnTime: number;
  }): Promise<GatePass> {
    const db = getDb();
    const id = generateEntityId('GP');
    const now = Date.now();

    await db.insert(gatePasses).values({
      id,
      studentId: data.studentId,
      passType: data.passType,
      reason: data.reason.trim(),
      destination: data.destination.trim(),
      departureTime: data.departureTime,
      expectedReturnTime: data.expectedReturnTime,
      status: 'pending',
      createdAt: now,
    });

    const rows = await db.select().from(gatePasses).where(eq(gatePasses.id, id));
    return rows[0];
  }

  static async reviewGatePass(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy: string,
    reviewNotes?: string
  ): Promise<GatePass | null> {
    const db = getDb();
    await db
      .update(gatePasses)
      .set({ status, reviewedBy, reviewNotes: reviewNotes || null })
      .where(eq(gatePasses.id, id));

    const rows = await db.select().from(gatePasses).where(eq(gatePasses.id, id));
    return rows[0] || null;
  }

  static async updateGatePassMovement(
    id: string,
    movement: 'exit' | 'return',
    time = Date.now()
  ): Promise<GatePass | null> {
    const db = getDb();
    if (movement === 'exit') {
      await db
        .update(gatePasses)
        .set({ actualExitTime: time, status: 'active_out' })
        .where(eq(gatePasses.id, id));
    } else {
      await db
        .update(gatePasses)
        .set({ actualReturnTime: time, status: 'closed' })
        .where(eq(gatePasses.id, id));
    }

    const rows = await db.select().from(gatePasses).where(eq(gatePasses.id, id));
    return rows[0] || null;
  }

  static async hasActiveApprovedPass(studentId: string, dateStr: string): Promise<boolean> {
    const db = getDb();
    const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
    const dayEnd = new Date(`${dateStr}T23:59:59`).getTime();

    const passes = await db
      .select()
      .from(gatePasses)
      .where(
        and(
          eq(gatePasses.studentId, studentId),
          or(eq(gatePasses.status, 'approved'), eq(gatePasses.status, 'active_out'))
        )
      );

    return passes.some((p) => p.departureTime <= dayEnd && p.expectedReturnTime >= dayStart);
  }

  // --------------------------------------------------------------------------
  // COMPLAINTS
  // --------------------------------------------------------------------------
  static async getComplaints(params: {
    status?: string;
    category?: string;
    priority?: string;
    roomId?: string;
    studentId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: ComplaintDto[]; total: number }> {
    const db = getDb();
    const { status, category, priority, roomId, studentId, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(complaints.status, status));
    if (category && category !== 'all') conditions.push(eq(complaints.category, category));
    if (priority && priority !== 'all') conditions.push(eq(complaints.priority, priority));
    if (roomId) conditions.push(eq(complaints.roomId, roomId));
    if (studentId) conditions.push(eq(complaints.studentId, studentId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        c: complaints,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        roomNumber: rooms.roomNumber,
        staffName: staff.name,
      })
      .from(complaints)
      .leftJoin(students, eq(complaints.studentId, students.id))
      .leftJoin(rooms, eq(complaints.roomId, rooms.id))
      .leftJoin(staff, eq(complaints.assignedStaffId, staff.id))
      .where(whereClause)
      .orderBy(desc(complaints.createdAt))
      .limit(limit)
      .offset(offset);

    const countRes = await db.select({ value: count() }).from(complaints).where(whereClause);

    return {
      data: rows.map((r) => ({
        id: r.c.id,
        studentId: r.c.studentId,
        roomId: r.c.roomId,
        category: r.c.category as any,
        subject: r.c.subject,
        description: r.c.description,
        priority: r.c.priority as any,
        status: r.c.status as any,
        assignedStaffId: r.c.assignedStaffId,
        resolutionNotes: r.c.resolutionNotes,
        createdAt: r.c.createdAt,
        resolvedAt: r.c.resolvedAt,
        studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : undefined,
        roomNumber: r.roomNumber || undefined,
        assignedStaffName: r.staffName || undefined,
      })),
      total: countRes[0]?.value || 0,
    };
  }

  static async createComplaint(data: {
    studentId: string;
    roomId: string;
    category: string;
    subject: string;
    description: string;
    priority?: 'low' | 'medium' | 'urgent';
  }): Promise<Complaint> {
    const db = getDb();
    const id = generateEntityId('CMP');
    const now = Date.now();

    await db.insert(complaints).values({
      id,
      studentId: data.studentId,
      roomId: data.roomId,
      category: data.category,
      subject: data.subject.trim(),
      description: data.description.trim(),
      priority: data.priority || 'medium',
      status: 'open',
      createdAt: now,
    });

    const rows = await db.select().from(complaints).where(eq(complaints.id, id));
    return rows[0];
  }

  static async updateComplaintStatus(
    id: string,
    status: 'open' | 'in_progress' | 'resolved' | 'rejected',
    assignedStaffId?: string,
    resolutionNotes?: string
  ): Promise<Complaint | null> {
    const db = getDb();
    const now = Date.now();
    const resolvedAt = status === 'resolved' ? now : null;

    await db
      .update(complaints)
      .set({
        status,
        assignedStaffId: assignedStaffId || null,
        resolutionNotes: resolutionNotes || null,
        resolvedAt,
      })
      .where(eq(complaints.id, id));

    const rows = await db.select().from(complaints).where(eq(complaints.id, id));
    return rows[0] || null;
  }

  // --------------------------------------------------------------------------
  // NOTICES / CIRCULARS
  // --------------------------------------------------------------------------
  static async getNotices(params: {
    targetAudience?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: NoticeDto[]; total: number }> {
    const db = getDb();
    const { targetAudience, activeOnly = true, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (targetAudience && targetAudience !== 'all') {
      conditions.push(or(eq(notices.targetAudience, 'all'), eq(notices.targetAudience, targetAudience)));
    }
    if (activeOnly) {
      const now = Date.now();
      conditions.push(or(sql`${notices.expiresAt} IS NULL`, sql`${notices.expiresAt} > ${now}`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        n: notices,
        publisherName: users.name,
        blockName: blocks.name,
      })
      .from(notices)
      .leftJoin(users, eq(notices.publishedBy, users.id))
      .leftJoin(blocks, eq(notices.blockId, blocks.id))
      .where(whereClause)
      .orderBy(desc(notices.isPinned), desc(notices.createdAt))
      .limit(limit)
      .offset(offset);

    const countRes = await db.select({ value: count() }).from(notices).where(whereClause);

    return {
      data: rows.map((r) => ({
        id: r.n.id,
        title: r.n.title,
        content: r.n.content,
        targetAudience: r.n.targetAudience as any,
        blockId: r.n.blockId,
        priority: r.n.priority as any,
        publishedBy: r.n.publishedBy,
        isPinned: r.n.isPinned,
        expiresAt: r.n.expiresAt,
        createdAt: r.n.createdAt,
        publisherName: r.publisherName || undefined,
        blockName: r.blockName || undefined,
      })),
      total: countRes[0]?.value || 0,
    };
  }

  static async createNotice(data: {
    title: string;
    content: string;
    targetAudience?: 'all' | 'boys_only' | 'girls_only' | 'block_specific';
    blockId?: string;
    priority?: 'normal' | 'urgent' | 'critical';
    publishedBy: string;
    isPinned?: boolean;
    expiresAt?: number;
  }): Promise<Notice> {
    const db = getDb();
    const id = generateEntityId('NOT');
    const now = Date.now();

    await db.insert(notices).values({
      id,
      title: data.title.trim(),
      content: data.content.trim(),
      targetAudience: data.targetAudience || 'all',
      blockId: data.blockId || null,
      priority: data.priority || 'normal',
      publishedBy: data.publishedBy,
      isPinned: data.isPinned ? 1 : 0,
      expiresAt: data.expiresAt || null,
      createdAt: now,
    });

    const rows = await db.select().from(notices).where(eq(notices.id, id));
    return rows[0];
  }

  static async deleteNotice(id: string): Promise<boolean> {
    const db = getDb();
    await db.delete(notices).where(eq(notices.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // VISITORS
  // --------------------------------------------------------------------------
  static async getVisitors(params: {
    studentId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: VisitorDto[]; total: number }> {
    const db = getDb();
    const { studentId, activeOnly, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (studentId) conditions.push(eq(visitors.studentId, studentId));
    if (activeOnly) conditions.push(isNull(visitors.checkOutTime));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        v: visitors,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        officerName: users.name,
      })
      .from(visitors)
      .leftJoin(students, eq(visitors.studentId, students.id))
      .leftJoin(users, eq(visitors.gateOfficerId, users.id))
      .where(whereClause)
      .orderBy(desc(visitors.checkInTime))
      .limit(limit)
      .offset(offset);

    const countRes = await db.select({ value: count() }).from(visitors).where(whereClause);

    return {
      data: rows.map((r) => ({
        id: r.v.id,
        visitorName: r.v.visitorName,
        phone: r.v.phone,
        relationship: r.v.relationship,
        studentId: r.v.studentId,
        idProofDetails: r.v.idProofDetails,
        purpose: r.v.purpose,
        checkInTime: r.v.checkInTime,
        checkOutTime: r.v.checkOutTime,
        gateOfficerId: r.v.gateOfficerId,
        studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : undefined,
        enrollmentNumber: r.enrollmentNumber || undefined,
        gateOfficerName: r.officerName || undefined,
      })),
      total: countRes[0]?.value || 0,
    };
  }

  static async registerVisitor(data: {
    visitorName: string;
    phone: string;
    relationship: string;
    studentId: string;
    idProofDetails: string;
    purpose: string;
    gateOfficerId: string;
  }): Promise<Visitor> {
    const db = getDb();
    const id = generateEntityId('VIS');
    const now = Date.now();

    await db.insert(visitors).values({
      id,
      visitorName: data.visitorName.trim(),
      phone: data.phone.trim(),
      relationship: data.relationship.trim(),
      studentId: data.studentId,
      idProofDetails: data.idProofDetails.trim(),
      purpose: data.purpose.trim(),
      checkInTime: now,
      gateOfficerId: data.gateOfficerId,
    });

    const rows = await db.select().from(visitors).where(eq(visitors.id, id));
    return rows[0];
  }

  static async checkOutVisitor(id: string, checkOutTime = Date.now()): Promise<Visitor | null> {
    const db = getDb();
    await db.update(visitors).set({ checkOutTime }).where(eq(visitors.id, id));
    const rows = await db.select().from(visitors).where(eq(visitors.id, id));
    return rows[0] || null;
  }

  // --------------------------------------------------------------------------
  // STAFF & WARDENS
  // --------------------------------------------------------------------------
  static async getStaff(params: {
    designation?: string;
    activeOnly?: boolean;
  } = {}): Promise<StaffDto[]> {
    const db = getDb();
    const conditions = [];
    if (params.designation && params.designation !== 'all') {
      conditions.push(eq(staff.designation, params.designation));
    }
    if (params.activeOnly) {
      conditions.push(eq(staff.isActive, 1));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(staff).where(whereClause).orderBy(staff.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      designation: r.designation as any,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  static async createStaff(data: {
    name: string;
    phone: string;
    email?: string;
    designation: 'chief_warden' | 'warden' | 'security' | 'maintenance' | 'caretaker';
  }): Promise<Staff> {
    const db = getDb();
    const id = generateEntityId('STF');
    const now = Date.now();

    await db.insert(staff).values({
      id,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      designation: data.designation,
      isActive: 1,
      createdAt: now,
    });

    const rows = await db.select().from(staff).where(eq(staff.id, id));
    return rows[0];
  }

  static async toggleStaffStatus(id: string, isActive: boolean): Promise<boolean> {
    const db = getDb();
    await db.update(staff).set({ isActive: isActive ? 1 : 0 }).where(eq(staff.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // ROOM ASSETS & INVENTORY
  // --------------------------------------------------------------------------
  static async getRoomAssets(roomId?: string): Promise<RoomAssetDto[]> {
    const db = getDb();
    const conditions = [];
    if (roomId) conditions.push(eq(roomAssets.roomId, roomId));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        ra: roomAssets,
        roomNumber: rooms.roomNumber,
      })
      .from(roomAssets)
      .leftJoin(rooms, eq(roomAssets.roomId, rooms.id))
      .where(whereClause)
      .orderBy(roomAssets.assetName);

    return rows.map((r) => ({
      id: r.ra.id,
      roomId: r.ra.roomId,
      assetName: r.ra.assetName,
      serialNumber: r.ra.serialNumber,
      condition: r.ra.condition as any,
      createdAt: r.ra.createdAt,
      roomNumber: r.roomNumber || undefined,
    }));
  }

  static async createRoomAsset(data: {
    roomId: string;
    assetName: string;
    serialNumber?: string;
    condition?: 'new' | 'good' | 'damaged' | 'condemned';
  }): Promise<RoomAsset> {
    const db = getDb();
    const id = generateEntityId('AST');
    const now = Date.now();

    await db.insert(roomAssets).values({
      id,
      roomId: data.roomId,
      assetName: data.assetName.trim(),
      serialNumber: data.serialNumber?.trim() || null,
      condition: data.condition || 'good',
      createdAt: now,
    });

    const rows = await db.select().from(roomAssets).where(eq(roomAssets.id, id));
    return rows[0];
  }

  static async updateRoomAsset(
    id: string,
    updates: { condition?: 'new' | 'good' | 'damaged' | 'condemned'; assetName?: string }
  ): Promise<RoomAsset | null> {
    const db = getDb();
    await db.update(roomAssets).set(updates).where(eq(roomAssets.id, id));
    const rows = await db.select().from(roomAssets).where(eq(roomAssets.id, id));
    return rows[0] || null;
  }

  static async deleteRoomAsset(id: string): Promise<boolean> {
    const db = getDb();
    await db.delete(roomAssets).where(eq(roomAssets.id, id));
    return true;
  }

  // --------------------------------------------------------------------------
  // MESS OPT-OUTS
  // --------------------------------------------------------------------------
  static async getMessOptOuts(weekendStartDate: string): Promise<MessOptOutDto[]> {
    const db = getDb();
    const rows = await db
      .select({
        m: messOptOuts,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        roomNumber: rooms.roomNumber,
      })
      .from(messOptOuts)
      .leftJoin(students, eq(messOptOuts.studentId, students.id))
      .leftJoin(beds, eq(students.assignedBedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .where(eq(messOptOuts.weekendStartDate, weekendStartDate))
      .orderBy(students.lastName);

    return rows.map((r) => ({
      id: r.m.id,
      studentId: r.m.studentId,
      weekendStartDate: r.m.weekendStartDate,
      createdAt: r.m.createdAt,
      studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : undefined,
      enrollmentNumber: r.enrollmentNumber || undefined,
      roomNumber: r.roomNumber || undefined,
    }));
  }

  static async recordMessOptOut(studentId: string, weekendStartDate: string): Promise<MessOptOut> {
    const db = getDb();
    const id = generateEntityId('MSO');
    const now = Date.now();

    await db.insert(messOptOuts).values({
      id,
      studentId,
      weekendStartDate,
      createdAt: now,
    });

    const rows = await db.select().from(messOptOuts).where(eq(messOptOuts.id, id));
    return rows[0];
  }

  static async cancelMessOptOut(studentId: string, weekendStartDate: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(messOptOuts)
      .where(and(eq(messOptOuts.studentId, studentId), eq(messOptOuts.weekendStartDate, weekendStartDate)));
    return true;
  }
}
