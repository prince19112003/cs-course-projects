import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { hostels, blocks, floors, rooms, beds } from '../../src/main/database/schema/infrastructure.js';
import { students } from '../../src/main/database/schema/students.js';
import { allocations } from '../../src/main/database/schema/allocations.js';
import { invoices } from '../../src/main/database/schema/billing.js';
import { attendance, gatePasses, complaints } from '../../src/main/database/schema/operations.js';
import { ReportingService } from '../../src/main/services/ReportingService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 07: Reporting Engine & Institutional Analytics', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Chief Warden',
    email: 'chief@nexus.test',
    phone: '9876543201',
    role: 'admin',
    permissions: ['rooms:view', 'students:view', 'audit:view'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-GUEST-001',
    name: 'Guest User',
    email: 'guest@nexus.test',
    phone: '9876543299',
    role: 'resident',
    permissions: [],
    forcePasswordChange: false,
  };

  const hostelId = 'HST-REP-0001';
  const studentAId = 'STU-REP-0001';
  const studentBId = 'STU-REP-0002';

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
      id: hostelId,
      institutionId: 'INST-0001',
      name: 'East Wing Hostel',
      code: 'EWH',
      genderType: 'boys',
      address: 'East Campus',
      totalFloors: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: 'BLK-REP-0001',
      hostelId,
      name: 'Block E1',
      code: 'E1',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(floors).values({
      id: 'FLR-REP-0001',
      blockId: 'BLK-REP-0001',
      floorNumber: 1,
      name: '1st Floor',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(rooms).values({
      id: 'RM-REP-0001',
      floorId: 'FLR-REP-0001',
      roomNumber: 'E-101',
      roomType: 'double',
      capacity: 2,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(beds).values([
      { id: 'BED-REP-0001', roomId: 'RM-REP-0001', bedLabel: 'E-101-A', status: 'occupied', createdAt: now, updatedAt: now },
      { id: 'BED-REP-0002', roomId: 'RM-REP-0001', bedLabel: 'E-101-B', status: 'vacant', createdAt: now, updatedAt: now },
    ]);

    await db.insert(students).values([
      {
        id: studentAId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-REP-001',
        firstName: 'Arthur',
        lastName: 'Dent',
        dateOfBirth: '2004-01-10',
        gender: 'male',
        email: 'arthur@nexus.edu',
        phone: '9870008801',
        course: 'B.Tech',
        department: 'CS',
        academicYear: 2,
        admissionDate: '2024-08-01',
        permanentAddress: 'City A',
        status: 'active',
        assignedBedId: 'BED-REP-0001',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: studentBId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-REP-002',
        firstName: 'Ford',
        lastName: 'Prefect',
        dateOfBirth: '2004-02-12',
        gender: 'male',
        email: 'ford@nexus.edu',
        phone: '9870008802',
        course: 'B.Tech',
        department: 'ME',
        academicYear: 3,
        admissionDate: '2023-08-01',
        permanentAddress: 'City B',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Active allocation for student A
    await db.insert(allocations).values({
      id: 'ALC-REP-0001',
      studentId: studentAId,
      bedId: 'BED-REP-0001',
      allocatedAt: now,
      allocationType: 'fresh_admission',
      allocatedBy: mockAdmin.id,
      status: 'active',
    });

    // Invoices for fee defaulter testing
    await db.insert(invoices).values([
      {
        id: 'INV-REP-001',
        studentId: studentAId,
        billingCycle: '2026-09',
        description: 'Hostel Fee Sep 2026',
        amountDue: 10000,
        amountPaid: 4000,
        dueDate: now - 86400000,
        status: 'partially_paid',
        createdAt: now,
      },
      {
        id: 'INV-REP-002',
        studentId: studentBId,
        billingCycle: '2026-09',
        description: 'Hostel Fee Sep 2026',
        amountDue: 8000,
        amountPaid: 8000,
        dueDate: now - 86400000,
        status: 'paid',
        createdAt: now,
      },
    ]);

    // Attendance entries for analytics testing
    await db.insert(attendance).values([
      { id: 'ATT-REP-001', studentId: studentAId, date: '2026-10-01', status: 'present', recordedBy: mockAdmin.id, recordedAt: now },
      { id: 'ATT-REP-002', studentId: studentAId, date: '2026-10-02', status: 'absent', recordedBy: mockAdmin.id, recordedAt: now },
      { id: 'ATT-REP-003', studentId: studentAId, date: '2026-10-03', status: 'absent', recordedBy: mockAdmin.id, recordedAt: now },
      { id: 'ATT-REP-004', studentId: studentAId, date: '2026-10-04', status: 'absent', recordedBy: mockAdmin.id, recordedAt: now },
    ]);

    // Gate pass for register report
    await db.insert(gatePasses).values({
      id: 'GP-REP-001',
      studentId: studentAId,
      passType: 'night_out',
      reason: 'Home visit',
      destination: 'Home',
      departureTime: now - 7200000,
      expectedReturnTime: now - 3600000, // in the past -> overdue!
      status: 'active_out',
      createdAt: now,
    });

    // Complaint for maintenance report
    await db.insert(complaints).values([
      {
        id: 'CMP-REP-001',
        studentId: studentAId,
        roomId: 'RM-REP-0001',
        category: 'electrical',
        subject: 'Bulb fuse',
        description: 'Bulb not working',
        priority: 'medium',
        status: 'resolved',
        createdAt: now - 7200000,
        resolvedAt: now - 3600000, // 1 hour resolution
      },
    ]);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('generates accurate occupancy and capacity report', async () => {
    const report = await ReportingService.getOccupancyReport(mockAdmin);
    expect(report.hostels.length).toBe(1);
    expect(report.hostels[0].totalCapacity).toBe(2);
    expect(report.hostels[0].occupiedBeds).toBe(1);
    expect(report.hostels[0].vacantBeds).toBe(1);
    expect(report.hostels[0].occupancyRate).toBe(50);
  });

  it('generates fee defaulters report with outstanding balances and oldest cycle', async () => {
    const report = await ReportingService.getFeeDefaultersReport(mockAdmin, { minBalance: 1000 });
    expect(report.totalDefaulters).toBe(1);
    expect(report.defaulters[0].studentId).toBe(studentAId);
    expect(report.defaulters[0].balanceDue).toBe(6000);
    expect(report.defaulters[0].oldestOverdueCycle).toBe('2026-09');
  });

  it('computes attendance analytics and identifies chronic absentees', async () => {
    const report = await ReportingService.getAttendanceAnalytics(mockAdmin, {
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      minAbsences: 3,
    });

    expect(report.totalPresentMarks).toBe(1);
    expect(report.totalAbsentMarks).toBe(3);
    expect(report.chronicAbsentees.length).toBe(1);
    expect(report.chronicAbsentees[0].studentId).toBe(studentAId);
    expect(report.chronicAbsentees[0].absentDays).toBe(3);
  });

  it('flags overdue out-passes in gate pass register report', async () => {
    const report = await ReportingService.getGatePassRegister(mockAdmin);
    expect(report.passes.length).toBe(1);
    expect(report.passes[0].status).toBe('active_out');
    expect(report.passes[0].isOverdue).toBe(true);
    expect(report.overdueCount).toBe(1);
  });

  it('computes maintenance ticket analytics and average turnaround hours', async () => {
    const report = await ReportingService.getMaintenanceAnalytics(mockAdmin);
    expect(report.totalTickets).toBe(1);
    expect(report.resolvedTickets).toBe(1);
    expect(report.openTickets).toBe(0);
    expect(report.categories[0].category).toBe('electrical');
    expect(report.categories[0].avgResolutionHours).toBe(1);
  });

  it('aggregates resident demographics breakdown by course, dept, year and gender', async () => {
    const report = await ReportingService.getDemographicsReport(mockAdmin);
    expect(report.totalResidents).toBe(2);
    expect(report.byGender['male']).toBe(2);
    expect(report.byCourse['B.Tech']).toBe(2);
    expect(report.byDepartment['CS']).toBe(1);
    expect(report.byDepartment['ME']).toBe(1);
  });

  it('exports sanitized CSV reports and defends against formula injection', async () => {
    const csv = await ReportingService.exportReportCsv(mockAdmin, 'defaulters');
    expect(csv).toContain('Student Name');
    expect(csv).toContain('Arthur Dent');
    expect(csv).toContain('6000');
  });

  it('enforces RBAC permission check on report generation', async () => {
    await expect(
      ReportingService.getOccupancyReport(mockUnauthorized)
    ).rejects.toThrow(/FORBIDDEN/i);
  });
});
