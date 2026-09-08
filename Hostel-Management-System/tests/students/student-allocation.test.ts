import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { InfrastructureService } from '../../src/main/services/InfrastructureService.js';
import { AllocationService } from '../../src/main/services/AllocationService.js';
import { StudentService } from '../../src/main/services/StudentService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 05: Student Management & Phase 04 Allocation Integration', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Admin Supervisor',
    email: 'admin@nexus.test',
    phone: '9999999991',
    role: 'admin',
    permissions: [
      'students:view',
      'students:create',
      'students:edit',
      'students:archive',
      'allocations:view',
      'allocations:manage',
      'rooms:view',
    ],
    forcePasswordChange: false,
  };

  let testBedId1: string;
  let testBedId2: string;

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
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });

    // Create infrastructure hierarchy
    const hostel = await InfrastructureService.createHostel(mockAdmin, {
      name: 'Sahyadri Residence',
      code: 'SHY-1',
      genderType: 'boys',
      totalCapacity: 50,
    });

    const block = await InfrastructureService.createBlock(mockAdmin, {
      hostelId: hostel.id,
      name: 'North Block',
      code: 'NB',
      totalFloors: 2,
    });

    const floor = await InfrastructureService.createFloor(mockAdmin, {
      blockId: block.id,
      floorNumber: 1,
      name: 'First Floor',
    });

    const room = await InfrastructureService.createRoom(mockAdmin, {
      floorId: floor.id,
      roomNumber: '101',
      capacity: 2,
      roomType: 'double',
      acType: 'non_ac',
      monthlyRent: 3500,
    });

    const bed1 = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: 'A',
    });
    const bed2 = await InfrastructureService.createBed(mockAdmin, {
      roomId: room.id,
      bedLabel: 'B',
    });

    testBedId1 = bed1.id;
    testBedId2 = bed2.id;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('allocates bed during student creation and populates spatial details', async () => {
    const student = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-ALLOC-01',
      firstName: 'Vikram',
      lastName: 'Malhotra',
      dateOfBirth: '2004-09-15',
      gender: 'male',
      email: 'vikram@nexus.edu',
      phone: '9555555501',
      course: 'Electronics',
      department: 'Engineering',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: '15 Nehru Nagar',
      initialBedId: testBedId1,
    });

    expect(student.assignedBedId).toBe(testBedId1);
    expect(student.roomNumber).toBe('101');
    expect(student.bedLabel).toBe('A');
    expect(student.hostelName).toBe('Sahyadri Residence');

    const dossier = await StudentService.getStudentById(mockAdmin, student.id);
    expect(dossier.activeAllocation).not.toBeNull();
    expect(dossier.activeAllocation?.bedId).toBe(testBedId1);
    expect(dossier.allocationHistory).toHaveLength(1);
    expect(dossier.allocationHistory![0].status).toBe('active');
  });

  it('reflects room transfer in student dossier allocation history', async () => {
    const student = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-ALLOC-02',
      firstName: 'Rohan',
      lastName: 'Verma',
      dateOfBirth: '2004-03-21',
      gender: 'male',
      email: 'rohan@nexus.edu',
      phone: '9555555502',
      course: 'Civil',
      department: 'Engineering',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: '22 Park Street',
      initialBedId: testBedId1,
    });

    // Transfer from Bed 1 to Bed 2
    await AllocationService.transferBed(mockAdmin, {
      studentId: student.id,
      destinationBedId: testBedId2,
      transferType: 'requested_transfer',
      remarks: 'Student requested change of bed position',
    });

    const dossier = await StudentService.getStudentById(mockAdmin, student.id);
    expect(dossier.assignedBedId).toBe(testBedId2);
    expect(dossier.bedLabel).toBe('B');

    // Allocation history has 2 records: one transferred, one active
    expect(dossier.allocationHistory).toHaveLength(2);
    const transferred = dossier.allocationHistory!.find((a) => a.status === 'transferred');
    const active = dossier.allocationHistory!.find((a) => a.status === 'active');

    expect(transferred).toBeDefined();
    expect(transferred?.bedId).toBe(testBedId1);
    expect(active).toBeDefined();
    expect(active?.bedId).toBe(testBedId2);
  });

  it('automatically vacates bed when student status changes to graduated or vacated', async () => {
    const student = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-ALLOC-03',
      firstName: 'Karan',
      lastName: 'Singhania',
      dateOfBirth: '2003-11-11',
      gender: 'male',
      email: 'karan@nexus.edu',
      phone: '9555555503',
      course: 'Mechanical',
      department: 'Engineering',
      academicYear: 4,
      admissionDate: '2023-08-01',
      permanentAddress: '78 Ring Road',
      initialBedId: testBedId1,
    });

    expect(student.assignedBedId).toBe(testBedId1);

    // Change status to graduated
    await StudentService.setStudentStatus(mockAdmin, student.id, 'graduated', 'Completed degree');

    const dossier = await StudentService.getStudentById(mockAdmin, student.id);
    expect(dossier.status).toBe('graduated');
    expect(dossier.assignedBedId).toBeNull();
    expect(dossier.activeAllocation).toBeNull();

    // Past allocation is preserved with status 'vacated'
    expect(dossier.allocationHistory).toHaveLength(1);
    expect(dossier.allocationHistory![0].status).toBe('vacated');
  });
});
