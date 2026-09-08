import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { hostels, blocks, rooms, beds } from '../schema/infrastructure.js';
import { students } from '../schema/students.js';
import { allocations } from '../schema/allocations.js';
import { invoices } from '../schema/billing.js';
import { attendance, gatePasses, complaints } from '../schema/operations.js';
import {
  OccupancyReportDto,
  OccupancyReportItem,
  FeeDefaultersReportDto,
  FeeDefaulterItem,
  AttendanceAnalyticsReportDto,
  ChronicAbsenteeItem,
  GatePassRegisterReportDto,
  GatePassRegisterItem,
  MaintenanceAnalyticsReportDto,
  MaintenanceReportItem,
  DemographicsReportDto,
} from '../../shared/types.js';

export class ReportingRepository {
  // 1. Occupancy & Capacity Report
  static async getOccupancyReport(hostelId?: string): Promise<OccupancyReportDto> {
    const db = getDb();
    const allHostels = await db.select().from(hostels).where(hostelId ? eq(hostels.id, hostelId) : undefined);

    const hostelItems: OccupancyReportItem[] = [];
    let campusTotalCapacity = 0;
    let campusOccupiedBeds = 0;

    for (const h of allHostels) {
      const hBlocks = await db.select().from(blocks).where(eq(blocks.hostelId, h.id));
      const blockIds = hBlocks.map((b) => b.id);

      let totalRooms = 0;
      let totalCapacity = 0;
      let occupiedBeds = 0;

      if (blockIds.length > 0) {
        // Query rooms in blocks
        const hRooms = await db
          .select({
            id: rooms.id,
            capacity: rooms.capacity,
          })
          .from(rooms)
          .innerJoin(blocks, eq(blocks.id, sql`floors.block_id`))
          .innerJoin(sql`floors`, eq(rooms.floorId, sql`floors.id`))
          .where(sql`floors.block_id IN (${sql.join(blockIds.map((id) => sql`${id}`), sql`, `)})`);

        totalRooms = hRooms.length;
        totalCapacity = hRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

        // Count active allocations in this hostel
        const activeAllocs = await db
          .select({ count: sql<number>`count(*)` })
          .from(allocations)
          .innerJoin(beds, eq(allocations.bedId, beds.id))
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .innerJoin(sql`floors`, eq(rooms.floorId, sql`floors.id`))
          .where(
            and(
              eq(allocations.status, 'active'),
              sql`floors.block_id IN (${sql.join(blockIds.map((id) => sql`${id}`), sql`, `)})`
            )
          );

        occupiedBeds = activeAllocs[0]?.count || 0;
      }

      const vacantBeds = Math.max(0, totalCapacity - occupiedBeds);
      const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 1000) / 10 : 0;

      campusTotalCapacity += totalCapacity;
      campusOccupiedBeds += occupiedBeds;

      hostelItems.push({
        hostelId: h.id,
        hostelName: h.name,
        hostelCode: h.code,
        genderType: h.genderType,
        totalBlocks: hBlocks.length,
        totalRooms,
        totalCapacity,
        occupiedBeds,
        vacantBeds,
        occupancyRate,
      });
    }

    const campusVacantBeds = Math.max(0, campusTotalCapacity - campusOccupiedBeds);
    const campusOccupancyRate =
      campusTotalCapacity > 0 ? Math.round((campusOccupiedBeds / campusTotalCapacity) * 1000) / 10 : 0;

    return {
      campusTotalCapacity,
      campusOccupiedBeds,
      campusVacantBeds,
      campusOccupancyRate,
      hostels: hostelItems,
    };
  }

  // 2. Fee Defaulters Report
  static async getFeeDefaultersReport(params: {
    minBalance?: number;
    billingCycle?: string;
  } = {}): Promise<FeeDefaultersReportDto> {
    const db = getDb();
    const minBalance = params.minBalance || 1;

    // Fetch unpaid or partially_paid invoices
    const invoiceRows = await db
      .select({
        inv: invoices,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        phone: students.phone,
      })
      .from(invoices)
      .innerJoin(students, eq(invoices.studentId, students.id))
      .where(
        and(
          sql`${invoices.status} IN ('unpaid', 'partially_paid')`,
          params.billingCycle ? eq(invoices.billingCycle, params.billingCycle) : undefined
        )
      )
      .orderBy(invoices.studentId, invoices.dueDate);

    // Group balance by student
    const studentMap = new Map<string, FeeDefaulterItem>();

    for (const r of invoiceRows) {
      const balance = r.inv.amountDue - r.inv.amountPaid;
      if (balance <= 0) continue;

      if (!studentMap.has(r.inv.studentId)) {
        studentMap.set(r.inv.studentId, {
          studentId: r.inv.studentId,
          studentName: `${r.studentFirstName} ${r.studentLastName}`,
          enrollmentNumber: r.enrollmentNumber,
          phone: r.phone,
          totalInvoiced: 0,
          totalPaid: 0,
          balanceDue: 0,
          oldestOverdueCycle: r.inv.billingCycle,
        });
      }

      const item = studentMap.get(r.inv.studentId)!;
      item.totalInvoiced += r.inv.amountDue;
      item.totalPaid += r.inv.amountPaid;
      item.balanceDue += balance;
    }

    const defaulters = Array.from(studentMap.values())
      .filter((d) => d.balanceDue >= minBalance)
      .sort((a, b) => b.balanceDue - a.balanceDue);

    const totalOutstandingAmount = defaulters.reduce((acc, d) => acc + d.balanceDue, 0);

    return {
      totalDefaulters: defaulters.length,
      totalOutstandingAmount,
      defaulters,
    };
  }

  // 3. Attendance & Habitual Absenteeism Analytics
  static async getAttendanceAnalytics(params: {
    startDate: string;
    endDate: string;
    hostelId?: string;
    minAbsences?: number;
  }): Promise<AttendanceAnalyticsReportDto> {
    const db = getDb();
    const { startDate, endDate, minAbsences = 3 } = params;

    const rows = await db
      .select({
        att: attendance,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
      })
      .from(attendance)
      .innerJoin(students, eq(attendance.studentId, students.id))
      .where(and(gte(attendance.date, startDate), lte(attendance.date, endDate)));

    let totalPresentMarks = 0;
    let totalAbsentMarks = 0;
    let totalLeaveMarks = 0;

    const studentMap = new Map<
      string,
      { studentId: string; name: string; enrollment: string; totalDays: number; absentDays: number }
    >();

    for (const r of rows) {
      if (r.att.status === 'present') totalPresentMarks++;
      else if (r.att.status === 'absent') totalAbsentMarks++;
      else if (r.att.status === 'approved_leave') totalLeaveMarks++;

      if (!studentMap.has(r.att.studentId)) {
        studentMap.set(r.att.studentId, {
          studentId: r.att.studentId,
          name: `${r.studentFirstName} ${r.studentLastName}`,
          enrollment: r.enrollmentNumber,
          totalDays: 0,
          absentDays: 0,
        });
      }

      const s = studentMap.get(r.att.studentId)!;
      s.totalDays++;
      if (r.att.status === 'absent') s.absentDays++;
    }

    const totalMarks = totalPresentMarks + totalAbsentMarks + totalLeaveMarks;
    const overallAttendanceRate =
      totalMarks > 0 ? Math.round((totalPresentMarks / totalMarks) * 1000) / 10 : 100;

    const chronicAbsentees: ChronicAbsenteeItem[] = Array.from(studentMap.values())
      .filter((s) => s.absentDays >= minAbsences)
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.name,
        enrollmentNumber: s.enrollment,
        totalDaysRecorded: s.totalDays,
        absentDays: s.absentDays,
        absentRate: s.totalDays > 0 ? Math.round((s.absentDays / s.totalDays) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.absentDays - a.absentDays);

    return {
      dateRange: { startDate, endDate },
      overallAttendanceRate,
      totalPresentMarks,
      totalAbsentMarks,
      totalLeaveMarks,
      chronicAbsentees,
    };
  }

  // 4. Gate Movement & Out-Pass Register
  static async getGatePassRegister(params: {
    startDate?: number;
    endDate?: number;
    status?: string;
  } = {}): Promise<GatePassRegisterReportDto> {
    const db = getDb();
    const now = Date.now();

    const conditions = [];
    if (params.startDate) conditions.push(gte(gatePasses.departureTime, params.startDate));
    if (params.endDate) conditions.push(lte(gatePasses.expectedReturnTime, params.endDate));
    if (params.status && params.status !== 'all') conditions.push(eq(gatePasses.status, params.status));

    const rows = await db
      .select({
        gp: gatePasses,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
      })
      .from(gatePasses)
      .innerJoin(students, eq(gatePasses.studentId, students.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(gatePasses.createdAt))
      .limit(200);

    let activeOutCount = 0;
    let overdueCount = 0;

    const passes: GatePassRegisterItem[] = rows.map((r) => {
      const isOverdue = r.gp.status === 'active_out' && r.gp.expectedReturnTime < now;
      if (r.gp.status === 'active_out') activeOutCount++;
      if (isOverdue) overdueCount++;

      return {
        id: r.gp.id,
        studentName: `${r.studentFirstName} ${r.studentLastName}`,
        enrollmentNumber: r.enrollmentNumber,
        passType: r.gp.passType,
        reason: r.gp.reason,
        destination: r.gp.destination,
        departureTime: r.gp.departureTime,
        expectedReturnTime: r.gp.expectedReturnTime,
        actualExitTime: r.gp.actualExitTime,
        actualReturnTime: r.gp.actualReturnTime,
        status: r.gp.status,
        isOverdue,
      };
    });

    return {
      totalPasses: passes.length,
      activeOutCount,
      overdueCount,
      passes,
    };
  }

  // 5. Maintenance Tickets & SLA Report
  static async getMaintenanceAnalytics(params: {
    startDate?: number;
    endDate?: number;
  } = {}): Promise<MaintenanceAnalyticsReportDto> {
    const db = getDb();
    const conditions = [];
    if (params.startDate) conditions.push(gte(complaints.createdAt, params.startDate));
    if (params.endDate) conditions.push(lte(complaints.createdAt, params.endDate));

    const rows = await db
      .select()
      .from(complaints)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    let totalTickets = rows.length;
    let openTickets = 0;
    let resolvedTickets = 0;

    const catMap = new Map<string, { total: number; open: number; resolved: number; totalHours: number }>();

    for (const c of rows) {
      if (c.status === 'resolved') resolvedTickets++;
      else openTickets++;

      if (!catMap.has(c.category)) {
        catMap.set(c.category, { total: 0, open: 0, resolved: 0, totalHours: 0 });
      }

      const cat = catMap.get(c.category)!;
      cat.total++;
      if (c.status === 'resolved') {
        cat.resolved++;
        if (c.resolvedAt && c.createdAt) {
          const hours = (c.resolvedAt - c.createdAt) / 3600000;
          cat.totalHours += hours;
        }
      } else {
        cat.open++;
      }
    }

    const categories: MaintenanceReportItem[] = Array.from(catMap.entries()).map(([category, stats]) => ({
      category,
      totalTickets: stats.total,
      openTickets: stats.open,
      resolvedTickets: stats.resolved,
      avgResolutionHours: stats.resolved > 0 ? Math.round((stats.totalHours / stats.resolved) * 10) / 10 : 0,
    }));

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      categories,
    };
  }

  // 6. Resident Demographics Report
  static async getDemographicsReport(): Promise<DemographicsReportDto> {
    const db = getDb();
    const rows = await db
      .select({
        gender: students.gender,
        course: students.course,
        department: students.department,
        academicYear: students.academicYear,
      })
      .from(students)
      .where(eq(students.status, 'active'));

    const byGender: Record<string, number> = {};
    const byCourse: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byAcademicYear: Record<number, number> = {};

    for (const s of rows) {
      byGender[s.gender] = (byGender[s.gender] || 0) + 1;
      byCourse[s.course] = (byCourse[s.course] || 0) + 1;
      byDepartment[s.department] = (byDepartment[s.department] || 0) + 1;
      byAcademicYear[s.academicYear] = (byAcademicYear[s.academicYear] || 0) + 1;
    }

    return {
      totalResidents: rows.length,
      byGender,
      byCourse,
      byDepartment,
      byAcademicYear,
    };
  }

  // 7. Live Real-Time Dashboard KPIs
  static async getDashboardKpis(): Promise<any> {
    const db = getDb();
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // Students
    const allStus = await db.select().from(students);
    const totalStudents = allStus.length;
    const activeResidents = allStus.filter((s: any) => s.status === 'active').length;

    // Hostels & Beds
    const allHostels = await db.select().from(hostels);
    const allBeds = await db.select().from(beds);
    const totalBeds = allBeds.length;
    const occupiedBeds = allBeds.filter((b: any) => b.status === 'occupied').length;
    const vacantBeds = allBeds.filter((b: any) => b.status === 'vacant').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Today Attendance
    const todayAtt = await db.select().from(attendance).where(eq(attendance.date, todayStr));
    const todayPresentCount = todayAtt.filter((a: any) => a.status === 'present').length;
    const todayAbsentCount = todayAtt.filter((a: any) => a.status === 'absent').length;
    const todayAttendanceRate =
      todayAtt.length > 0 ? Math.round((todayPresentCount / todayAtt.length) * 100) : 100;

    // Gate Passes
    const activePasses = await db.select().from(gatePasses).where(eq(gatePasses.status, 'active_out'));
    const activeGatePassesCount = activePasses.length;
    const overdueGatePassesCount = activePasses.filter((p: any) => p.expectedReturnTime < now).length;

    // Complaints
    const allComplaints = await db.select().from(complaints);
    const pendingComplaintsCount = allComplaints.filter((c: any) => c.status === 'open' || c.status === 'in_progress').length;
    const resolvedComplaintsCount = allComplaints.filter((c: any) => c.status === 'resolved').length;

    // Invoices / Financials
    const allInvoices = await db.select().from(invoices);
    const totalRevenueInvoiced = allInvoices.reduce((sum: number, i: any) => sum + (i.amountDue || 0), 0);
    const totalRevenueCollected = allInvoices.reduce((sum: number, i: any) => sum + (i.amountPaid || 0), 0);
    const totalPendingFees = Math.max(0, totalRevenueInvoiced - totalRevenueCollected);

    // Notices
    const allNotices = await db.select().from(notices);
    const activeNoticesCount = allNotices.length;

    return {
      totalStudents,
      activeResidents,
      totalHostels: allHostels.length,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
      todayPresentCount,
      todayAbsentCount,
      todayAttendanceRate,
      activeGatePassesCount,
      overdueGatePassesCount,
      pendingComplaintsCount,
      resolvedComplaintsCount,
      totalRevenueInvoiced,
      totalRevenueCollected,
      totalPendingFees,
      activeNoticesCount,
    };
  }
}
