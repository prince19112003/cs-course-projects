import { initDatabaseAsync, checkDatabaseHealth, closeDatabase, persistDatabase, getDb, DatabaseHealth, InitDbOptions } from '../connection.js';
import {
  institutions,
  users,
  hostels,
  blocks,
  floors,
  rooms,
  beds,
  students,
  guardians,
  allocations,
  invoices,
  attendance,
  complaints,
  notices,
} from '../schema/index.js';
import { count, eq } from 'drizzle-orm';
import { StudentRepository } from '../repositories/StudentRepository.js';
import { InfrastructureRepository } from '../repositories/InfrastructureRepository.js';
import { AllocationRepository } from '../repositories/AllocationRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { SystemRepository } from '../repositories/SystemRepository.js';
import { generateEntityId } from '../utils/id-generator.js';

export interface StandardDatabaseError {
  code: string;
  message: string;
  field?: string;
}

export class DatabaseService {
  private static initialized = false;

  /**
   * Initializes the database subsystem, applies migrations, and seeds baseline metadata if empty.
   */
  static async initialize(options?: InitDbOptions): Promise<DatabaseHealth> {
    try {
      await initDatabaseAsync(options);
      this.initialized = true;

      // Verify baseline metadata & seed baseline institution if table is completely empty
      await this.ensureBaselineData();

      // Persist any seed changes to disk
      persistDatabase();

      const health = checkDatabaseHealth();
      return health;
    } catch (error) {
      this.initialized = false;
      throw new Error(`DATABASE_INIT_FAILED: ${(error as Error).message}`);
    }
  }

  /**
   * Seeds baseline institution, blocks, rooms, resident students, allocations,
   * attendance, invoices, complaints, and notices if completely uninitialized.
   */
  private static async ensureBaselineData(): Promise<void> {
    try {
      const db = getDb();
      const now = Date.now();
      const todayStr = new Date().toISOString().split('T')[0];
      const currentCycle = todayStr.substring(0, 7);

      const existingHostels = await InfrastructureRepository.getHostels();
      let hostel1Id = existingHostels.length > 0 ? existingHostels[0].id : '';
      const adminId = 'USR-0001';

      if (existingHostels.length === 0) {
        const instId = generateEntityId('INST');

        // Create default institution
        await db.insert(institutions).values({
          id: instId,
          name: 'Nexus Institute of Technology',
          code: 'NIT',
          address: 'Main Campus, Tech Enclave',
          currencySymbol: '$',
          createdAt: now,
          updatedAt: now,
        });

        // Create default super admin user
        await db.insert(users).values({
          id: adminId,
          name: 'Chief Warden Office',
          email: 'admin@nexus.edu',
          phone: '+1 555-0199',
          passwordHash: '$2a$12$e8kPq5pE9J3eR2.0B4Xmke3.v5k2k1w2q1a2s3d4f5g6h7j8k9l0',
          role: 'super_admin',
          isActive: 1,
          forcePasswordChange: 0,
          createdAt: now,
          updatedAt: now,
        });

        // Create Hostel 1
        hostel1Id = generateEntityId('HST');
        await InfrastructureRepository.createHostel({
          id: hostel1Id,
          institutionId: instId,
          name: 'Main Campus Residential Complex',
          code: 'MCRC-1',
          genderType: 'coed',
          wardenId: adminId,
          totalCapacity: 120,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        });

        // Create Block A and Block B
        const blockA = await InfrastructureRepository.createBlock({
          id: generateEntityId('BLK'),
          hostelId: hostel1Id,
          name: 'Block A (Engineering)',
          code: 'A',
          totalFloors: 3,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        });

        const blockB = await InfrastructureRepository.createBlock({
          id: generateEntityId('BLK'),
          hostelId: hostel1Id,
          name: 'Block B (Science & Humanities)',
          code: 'B',
          totalFloors: 3,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        });

        // Create Floor 1 for Block A
        const floorA1 = await InfrastructureRepository.createFloor({
          id: generateEntityId('FLR'),
          blockId: blockA.id,
          floorNumber: 1,
          name: '1st Floor',
          isActive: 1,
          createdAt: now,
        });

        // Create sample rooms & beds in Block A
        const roomNumbers = ['101', '102', '103', '104'];
        for (const num of roomNumbers) {
          const room = await InfrastructureRepository.createRoom({
            id: generateEntityId('RM'),
            floorId: floorA1.id,
            roomNumber: `A${num}`,
            capacity: 2,
            roomType: 'double',
            acType: 'non_ac',
            monthlyRent: 45000,
            status: 'available',
            isArchived: 0,
            createdAt: now,
            updatedAt: now,
          });

          // 2 beds per room
          await InfrastructureRepository.createBed({
            id: generateEntityId('BED'),
            roomId: room.id,
            bedLabel: '1',
            status: 'vacant',
            isArchived: 0,
            createdAt: now,
            updatedAt: now,
          });

          await InfrastructureRepository.createBed({
            id: generateEntityId('BED'),
            roomId: room.id,
            bedLabel: '2',
            status: 'vacant',
            isArchived: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Check if real resident students exist
      const existingStudents = await db.select({ total: count() }).from(students);
      if (existingStudents[0].total === 0) {
        // Query vacant beds in Room A101 and A102
        const allBeds = await db
          .select({
            bedId: beds.id,
            bedLabel: beds.bedLabel,
            roomId: rooms.id,
            roomNumber: rooms.roomNumber,
          })
          .from(beds)
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .orderBy(rooms.roomNumber, beds.bedLabel);

        const a101Bed1 = allBeds.find((b) => b.roomNumber === 'A101' && b.bedLabel === '1')?.bedId;
        const a101Bed2 = allBeds.find((b) => b.roomNumber === 'A101' && b.bedLabel === '2')?.bedId;
        const a102Bed1 = allBeds.find((b) => b.roomNumber === 'A102' && b.bedLabel === '1')?.bedId;
        const a102Bed2 = allBeds.find((b) => b.roomNumber === 'A102' && b.bedLabel === '2')?.bedId;

        const residentRoster = [
          {
            id: 'STU-0001',
            enrollmentNumber: 'ENR-2026-001',
            firstName: 'Aarav',
            lastName: 'Sharma',
            dateOfBirth: '2004-05-14',
            gender: 'male',
            bloodGroup: 'O+',
            email: 'aarav.sharma@nexus.edu',
            phone: '+1 555-0101',
            course: 'B.Tech Computer Science',
            department: 'Computer Science & Engineering',
            academicYear: 2,
            admissionDate: '2025-08-01',
            permanentAddress: '42 Orchid Way, Metro City',
            assignedBedId: null,
            status: 'active',
            feeStatus: 'paid',
            createdAt: now - 30 * 86400000,
            updatedAt: now,
          },
          {
            id: 'STU-0002',
            enrollmentNumber: 'ENR-2026-002',
            firstName: 'Rohan',
            lastName: 'Verma',
            dateOfBirth: '2004-08-20',
            gender: 'male',
            bloodGroup: 'B+',
            email: 'rohan.verma@nexus.edu',
            phone: '+1 555-0102',
            course: 'B.Tech Electrical Engineering',
            department: 'Electrical & Electronics',
            academicYear: 2,
            admissionDate: '2025-08-01',
            permanentAddress: '18 Greenfield Sector, New Town',
            assignedBedId: null,
            status: 'active',
            feeStatus: 'pending',
            createdAt: now - 30 * 86400000,
            updatedAt: now,
          },
          {
            id: 'STU-0003',
            enrollmentNumber: 'ENR-2026-003',
            firstName: 'Priya',
            lastName: 'Patel',
            dateOfBirth: '2005-02-11',
            gender: 'female',
            bloodGroup: 'A+',
            email: 'priya.patel@nexus.edu',
            phone: '+1 555-0103',
            course: 'B.Sc Biotechnology',
            department: 'Applied Life Sciences',
            academicYear: 1,
            admissionDate: '2026-08-01',
            permanentAddress: '88 Lakeview Heights, West District',
            assignedBedId: null,
            status: 'active',
            feeStatus: 'pending',
            createdAt: now - 10 * 86400000,
            updatedAt: now,
          },
          {
            id: 'STU-0004',
            enrollmentNumber: 'ENR-2026-004',
            firstName: 'Aditya',
            lastName: 'Kumar',
            dateOfBirth: '2003-11-09',
            gender: 'male',
            bloodGroup: 'AB+',
            email: 'aditya.kumar@nexus.edu',
            phone: '+1 555-0104',
            course: 'B.Tech Mechanical Engineering',
            department: 'Mechanical Engineering',
            academicYear: 3,
            admissionDate: '2024-08-01',
            permanentAddress: '105 Royal Palm Lane, North Suburb',
            assignedBedId: null,
            status: 'active',
            feeStatus: 'paid',
            createdAt: now - 60 * 86400000,
            updatedAt: now,
          },
          {
            id: 'STU-0005',
            enrollmentNumber: 'ENR-2026-005',
            firstName: 'Ananya',
            lastName: 'Gupta',
            dateOfBirth: '2005-06-25',
            gender: 'female',
            bloodGroup: 'O-',
            email: 'ananya.gupta@nexus.edu',
            phone: '+1 555-0105',
            course: 'B.Tech Information Technology',
            department: 'Computer Science & Engineering',
            academicYear: 1,
            admissionDate: '2026-08-01',
            permanentAddress: '72 Sunrise Avenue, Central Area',
            assignedBedId: null,
            status: 'active',
            feeStatus: 'pending',
            createdAt: now - 5 * 86400000,
            updatedAt: now,
          },
          {
            id: 'STU-0006',
            enrollmentNumber: 'ENR-2026-006',
            firstName: 'Vikram',
            lastName: 'Singh',
            dateOfBirth: '2004-03-30',
            gender: 'male',
            bloodGroup: 'B-',
            email: 'vikram.singh@nexus.edu',
            phone: '+1 555-0106',
            course: 'B.Com Business Analytics',
            department: 'Commerce & Management',
            academicYear: 2,
            admissionDate: '2025-08-01',
            permanentAddress: '31 Heritage Boulevard, Old City',
            assignedBedId: null,
            status: 'active',
            feeStatus: 'pending',
            createdAt: now - 30 * 86400000,
            updatedAt: now,
          },
        ];

        // Insert students & guardians
        for (const s of residentRoster) {
          await db.insert(students).values(s);

          await db.insert(guardians).values({
            id: generateEntityId('GRD'),
            studentId: s.id,
            name: `Parent of ${s.firstName}`,
            relationship: 'father',
            phone: `+1 555-09${s.phone.slice(-2)}`,
            email: `guardian.${s.lastName.toLowerCase()}@nexus.edu`,
            address: s.permanentAddress,
            isPrimary: 1,
          });

          // Generate semester invoice
          const isPaid = s.feeStatus === 'paid';
          const invId = generateEntityId('INV');
          await db.insert(invoices).values({
            id: invId,
            studentId: s.id,
            billingCycle: currentCycle,
            description: 'Room Accommodation & Semester Boarding Fee',
            amountDue: 150000, // $1,500.00
            amountPaid: isPaid ? 150000 : 0,
            dueDate: now + 15 * 86400000,
            status: isPaid ? 'paid' : 'unpaid',
            createdAt: now - 5 * 86400000,
          });

          // Record roll call attendance
          await db.insert(attendance).values({
            id: generateEntityId('ATT'),
            studentId: s.id,
            date: todayStr,
            status: s.id === 'STU-0006' ? 'late' : 'present',
            recordedBy: adminId,
            remarks: s.id === 'STU-0006' ? 'Arrived at 21:15' : 'Night curfew verified',
            recordedAt: now - 3600000,
          });
        }

        // Add 2 real complaints
        const roomA101Id = allBeds.find((b) => b.roomNumber === 'A101')?.roomId;
        const roomA102Id = allBeds.find((b) => b.roomNumber === 'A102')?.roomId;

        if (roomA101Id) {
          await db.insert(complaints).values({
            id: generateEntityId('CMP'),
            studentId: 'STU-0001',
            roomId: roomA101Id,
            category: 'electrical',
            subject: 'Study desk light socket requires replacement',
            description: 'The right-hand desk plug socket is loose and sparks intermittently when laptop charger is plugged in.',
            priority: 'medium',
            status: 'open',
            createdAt: now - 24 * 3600000,
          });
        }

        if (roomA102Id) {
          await db.insert(complaints).values({
            id: generateEntityId('CMP'),
            studentId: 'STU-0004',
            roomId: roomA102Id,
            category: 'electrical',
            subject: 'Ceiling ventilation fan regulator sticking',
            description: 'Fan speed knob is stiff and stuck on speed 2.',
            priority: 'low',
            status: 'in_progress',
            resolutionNotes: 'Assigned to duty electrician for maintenance round.',
            createdAt: now - 48 * 3600000,
          });
        }

        // Add 2 real institutional notices
        await db.insert(notices).values({
          id: generateEntityId('NOT'),
          title: 'Nightly Curfew & Electronic Verification Roll-Call',
          content: 'All residential students are reminded that roll-call is conducted nightly between 21:00 and 21:30. Ensure you are present in your allocated berths.',
          targetAudience: 'all',
          priority: 'urgent',
          publishedBy: adminId,
          isPinned: 1,
          createdAt: now - 3 * 86400000,
        });

        await db.insert(notices).values({
          id: generateEntityId('NOT'),
          title: 'Campus Dining Hall Weekend Operating Hours',
          content: 'The central dining hall will operate from 07:30 to 20:30 during the upcoming weekend. Students traveling must register weekend opt-outs through the resident portal.',
          targetAudience: 'all',
          priority: 'normal',
          publishedBy: adminId,
          isPinned: 0,
          createdAt: now - 24 * 3600000,
        });

        // Record initial setup in audit log
        await AuditRepository.log({
          action: 'SYSTEM_INITIAL_SEED',
          entityType: 'students',
          entityId: 'SYSTEM',
          changesSummary: 'Initialized resident student directory, bed allocations, invoices, and operational desks.',
          userId: adminId,
        });
      }
    } catch (err) {
      console.error('ensureBaselineData error:', err);
    }
  }

  /**
   * Health verification
   */
  static getHealth(): DatabaseHealth {
    return checkDatabaseHealth();
  }

  /**
   * Graceful database shutdown
   */
  static shutdown(): void {
    closeDatabase();
    this.initialized = false;
  }

  /**
   * Formats raw SQLite errors into safe, user-facing error objects.
   */
  static formatError(error: unknown): StandardDatabaseError {
    if (!error) {
      return { code: 'UNKNOWN_ERROR', message: 'An unknown database error occurred.' };
    }

    const err = error as Error & { code?: string };
    const msg = err.message || '';

    if (msg.includes('UNIQUE constraint failed')) {
      const match = msg.match(/UNIQUE constraint failed: (.*)/);
      const field = match ? match[1] : 'record';
      return {
        code: 'DUPLICATE_RECORD',
        message: `A record with this identifier already exists: ${field}`,
        field,
      };
    }

    if (msg.includes('FOREIGN KEY constraint failed')) {
      return {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'The requested operation references a record that does not exist or cannot be removed.',
      };
    }

    if (msg.includes('ROOM_CAPACITY_EXCEEDED')) {
      return {
        code: 'ROOM_CAPACITY_EXCEEDED',
        message: 'Cannot add more beds than the configured room capacity ceiling.',
      };
    }

    if (msg.includes('STUDENT_ALREADY_ALLOCATED')) {
      return {
        code: 'STUDENT_ALREADY_ALLOCATED',
        message: 'Student already holds an active bed allocation.',
      };
    }

    if (msg.includes('BED_OCCUPIED')) {
      return {
        code: 'BED_OCCUPIED',
        message: 'The selected bed is already occupied or unavailable.',
      };
    }

    return {
      code: err.code || 'DATABASE_ERROR',
      message: err.message || 'A database error occurred.',
    };
  }
}
