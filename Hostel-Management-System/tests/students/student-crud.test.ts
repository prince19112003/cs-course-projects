import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { StudentService } from '../../src/main/services/StudentService.js';
import { StudentRepository } from '../../src/main/database/repositories/StudentRepository.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 05: Student CRUD, Uniqueness, Search & Bulk Operations', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Admin Supervisor',
    email: 'admin@nexus.test',
    phone: '9999999991',
    role: 'admin',
    permissions: ['students:view', 'students:create', 'students:edit', 'students:archive', 'allocations:manage'],
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
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates student with unique STU- ID and atomic guardian records', async () => {
    const student = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-2026-001',
      nationalId: 'NAT-99001',
      firstName: 'Samantha',
      lastName: 'Carter',
      dateOfBirth: '2004-05-14',
      gender: 'female',
      bloodGroup: 'B+',
      email: 'samantha.carter@nexus.edu',
      phone: '9888888801',
      course: 'B.Tech Cybersecurity',
      department: 'Computer Science',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: '14 Stargate Way, District 4',
      guardians: [
        {
          name: 'Jacob Carter',
          relationship: 'father',
          phone: '9888888899',
          email: 'jacob.carter@nexus.test',
          isPrimary: true,
        },
      ],
    });

    expect(student.id).toMatch(/^STU-[A-F0-9]{8}$/);
    expect(student.enrollmentNumber).toBe('ENR-2026-001');
    expect(student.status).toBe('active');
    expect(student.guardians).toHaveLength(1);
    expect(student.guardians[0].name).toBe('Jacob Carter');
    expect(student.guardians[0].relationship).toBe('father');
  });

  it('rejects duplicate enrollment numbers, emails, and phone numbers', async () => {
    await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-2026-UNIQUE',
      firstName: 'Daniel',
      lastName: 'Jackson',
      dateOfBirth: '2003-07-08',
      gender: 'male',
      email: 'daniel@nexus.edu',
      phone: '9777777701',
      course: 'Archaeology',
      department: 'Humanities',
      academicYear: 2,
      admissionDate: '2025-08-01',
      permanentAddress: '7 Pyramid Row',
    });

    // Duplicate enrollment
    await expect(
      StudentService.createStudent(mockAdmin, {
        enrollmentNumber: 'ENR-2026-UNIQUE',
        firstName: 'Jack',
        lastName: 'O’Neill',
        dateOfBirth: '2002-10-20',
        gender: 'male',
        email: 'jack@nexus.edu',
        phone: '9777777702',
        course: 'Physics',
        department: 'Science',
        academicYear: 3,
        admissionDate: '2024-08-01',
        permanentAddress: '10 Airforce Lane',
      })
    ).rejects.toThrow('DUPLICATE_ENROLLMENT');

    // Duplicate email
    await expect(
      StudentService.createStudent(mockAdmin, {
        enrollmentNumber: 'ENR-2026-NEW',
        firstName: 'Jack',
        lastName: 'O’Neill',
        dateOfBirth: '2002-10-20',
        gender: 'male',
        email: 'daniel@nexus.edu',
        phone: '9777777703',
        course: 'Physics',
        department: 'Science',
        academicYear: 3,
        admissionDate: '2024-08-01',
        permanentAddress: '10 Airforce Lane',
      })
    ).rejects.toThrow('DUPLICATE_EMAIL');

    // Duplicate phone
    await expect(
      StudentService.createStudent(mockAdmin, {
        enrollmentNumber: 'ENR-2026-NEW2',
        firstName: 'Jack',
        lastName: 'O’Neill',
        dateOfBirth: '2002-10-20',
        gender: 'male',
        email: 'jack@nexus.edu',
        phone: '9777777701',
        course: 'Physics',
        department: 'Science',
        academicYear: 3,
        admissionDate: '2024-08-01',
        permanentAddress: '10 Airforce Lane',
      })
    ).rejects.toThrow('DUPLICATE_PHONE');
  });

  it('performs multi-field database-backed search and filtering', async () => {
    await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-CS-101',
      firstName: 'Alice',
      lastName: 'Vance',
      dateOfBirth: '2004-01-01',
      gender: 'female',
      email: 'alice@nexus.edu',
      phone: '9111111101',
      course: 'Computer Science',
      department: 'Engineering',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: 'City 17',
    });

    await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-EE-102',
      firstName: 'Gordon',
      lastName: 'Freeman',
      dateOfBirth: '2003-03-03',
      gender: 'male',
      email: 'gordon@nexus.edu',
      phone: '9111111102',
      course: 'Theoretical Physics',
      department: 'Physics',
      academicYear: 2,
      admissionDate: '2025-08-01',
      permanentAddress: 'Black Mesa Compound',
    });

    // Search by partial name
    const searchAlice = await StudentService.searchStudents(mockAdmin, { query: 'alice' });
    expect(searchAlice.total).toBe(1);
    expect(searchAlice.data[0].firstName).toBe('Alice');

    // Search by enrollment
    const searchEnrollment = await StudentService.searchStudents(mockAdmin, { query: 'EE-102' });
    expect(searchEnrollment.total).toBe(1);
    expect(searchEnrollment.data[0].lastName).toBe('Freeman');

    // Filter by gender
    const femaleStudents = await StudentService.searchStudents(mockAdmin, { gender: 'female' });
    expect(femaleStudents.total).toBe(1);
    expect(femaleStudents.data[0].firstName).toBe('Alice');

    // Filter by department
    const physicsStudents = await StudentService.searchStudents(mockAdmin, { department: 'Physics' });
    expect(physicsStudents.total).toBe(1);
    expect(physicsStudents.data[0].firstName).toBe('Gordon');
  });

  it('updates student details and updates primary guardian', async () => {
    const student = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-UPDATE-01',
      firstName: 'Miles',
      lastName: 'Morales',
      dateOfBirth: '2005-06-12',
      gender: 'male',
      email: 'miles@nexus.edu',
      phone: '9222222201',
      course: 'Art & Graphic Design',
      department: 'Arts',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: 'Brooklyn, NY',
      guardians: [
        {
          name: 'Rio Morales',
          relationship: 'mother',
          phone: '9222222299',
          isPrimary: true,
        },
      ],
    });

    const updated = await StudentService.updateStudent(mockAdmin, student.id, {
      firstName: 'Miles',
      lastName: 'G. Morales',
      course: 'Digital Media Arts',
      guardians: [
        {
          name: 'Jefferson Davis',
          relationship: 'father',
          phone: '9222222288',
          isPrimary: true,
        },
      ],
    });

    expect(updated.lastName).toBe('G. Morales');
    expect(updated.course).toBe('Digital Media Arts');
    expect(updated.guardians).toHaveLength(1);
    expect(updated.guardians[0].name).toBe('Jefferson Davis');
  });

  it('executes atomic bulk status update across multiple students', async () => {
    const s1 = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-BULK-01',
      firstName: 'Student',
      lastName: 'One',
      dateOfBirth: '2004-01-01',
      gender: 'male',
      email: 's1@nexus.edu',
      phone: '9333333301',
      course: 'CS',
      department: 'CS',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: 'Campus Hall',
    });

    const s2 = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-BULK-02',
      firstName: 'Student',
      lastName: 'Two',
      dateOfBirth: '2004-02-02',
      gender: 'female',
      email: 's2@nexus.edu',
      phone: '9333333302',
      course: 'CS',
      department: 'CS',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: 'Campus Hall',
    });

    const bulkRes = await StudentService.bulkUpdateStatus(
      mockAdmin,
      [s1.id, s2.id],
      'graduated',
      'Completed degree program'
    );

    expect(bulkRes.updatedCount).toBe(2);

    const s1Reload = await StudentService.getStudentById(mockAdmin, s1.id);
    const s2Reload = await StudentService.getStudentById(mockAdmin, s2.id);

    expect(s1Reload.status).toBe('graduated');
    expect(s2Reload.status).toBe('graduated');
  });
});
