import { eq, or, like, and, count, desc, asc, isNull, isNotNull, inArray } from 'drizzle-orm';
import { getDb } from '../connection.js';
import {
  students,
  guardians,
  studentDocuments,
  Student,
  NewStudent,
  Guardian,
  StudentDocument,
} from '../schema/students.js';
import { beds, rooms, floors, blocks, hostels } from '../schema/infrastructure.js';
import { AllocationRepository, EnrichedAllocation } from './AllocationRepository.js';
import { generateEntityId } from '../utils/id-generator.js';
import {
  StudentDto,
  StudentDetailedDto,
  GuardianDto,
  StudentDocumentDto,
  StudentSearchParams,
  CreateGuardianInput,
} from '../../shared/types.js';

export class StudentRepository {
  static async findById(id: string): Promise<Student | null> {
    const db = getDb();
    const rows = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return rows[0] || null;
  }

  static async findByEnrollment(enrollmentNumber: string): Promise<Student | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.enrollmentNumber, enrollmentNumber.trim()))
      .limit(1);
    return rows[0] || null;
  }

  static async findByEmail(email: string): Promise<Student | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] || null;
  }

  static async findByPhone(phone: string): Promise<Student | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.phone, phone.trim()))
      .limit(1);
    return rows[0] || null;
  }

  static async findByNationalId(nationalId: string): Promise<Student | null> {
    if (!nationalId || !nationalId.trim()) return null;
    const db = getDb();
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.nationalId, nationalId.trim()))
      .limit(1);
    return rows[0] || null;
  }

  /**
   * Comprehensive search with database-side filtering, spatial joins, and pagination.
   */
  static async search(params: StudentSearchParams = {}): Promise<{ data: StudentDto[]; total: number }> {
    const db = getDb();
    const {
      query,
      status,
      gender,
      course,
      department,
      academicYear,
      hostelId,
      allocationStatus,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params as any;

    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(students.status, status));
    }

    if (gender && gender !== 'all') {
      conditions.push(eq(students.gender, gender));
    }

    if (course && course !== 'all') {
      conditions.push(eq(students.course, course));
    }

    if (department && department !== 'all') {
      conditions.push(eq(students.department, department));
    }

    if (academicYear) {
      conditions.push(eq(students.academicYear, Number(academicYear)));
    }

    if (allocationStatus === 'allocated') {
      conditions.push(isNotNull(students.assignedBedId));
    } else if (allocationStatus === 'unallocated') {
      conditions.push(isNull(students.assignedBedId));
    }

    if (query && query.trim().length > 0) {
      const q = `%${query.trim()}%`;
      conditions.push(
        or(
          like(students.id, q),
          like(students.firstName, q),
          like(students.lastName, q),
          like(students.enrollmentNumber, q),
          like(students.phone, q),
          like(students.email, q),
          like(students.course, q),
          like(students.department, q)
        )
      );
    }

    if (hostelId && hostelId !== 'all') {
      conditions.push(eq(hostels.id, hostelId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    let orderColumn: any = students.createdAt;
    if (sortBy === 'firstName') orderColumn = students.firstName;
    else if (sortBy === 'lastName') orderColumn = students.lastName;
    else if (sortBy === 'enrollmentNumber') orderColumn = students.enrollmentNumber;
    else if (sortBy === 'status') orderColumn = students.status;

    const orderByClause = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    // Enriched query joining spatial details
    const rows = await db
      .select({
        student: students,
        bedLabel: beds.bedLabel,
        roomNumber: rooms.roomNumber,
        floorName: floors.name,
        blockName: blocks.name,
        hostelName: hostels.name,
        hostelId: hostels.id,
      })
      .from(students)
      .leftJoin(beds, eq(students.assignedBedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(floors, eq(rooms.floorId, floors.id))
      .leftJoin(blocks, eq(floors.blockId, blocks.id))
      .leftJoin(hostels, eq(blocks.hostelId, hostels.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Total count query
    const countQuery = await db
      .select({ value: count() })
      .from(students)
      .leftJoin(beds, eq(students.assignedBedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(floors, eq(rooms.floorId, floors.id))
      .leftJoin(blocks, eq(floors.blockId, blocks.id))
      .leftJoin(hostels, eq(blocks.hostelId, hostels.id))
      .where(whereClause);

    const total = countQuery[0]?.value || 0;

    const data: StudentDto[] = rows.map((r) => ({
      ...r.student,
      gender: r.student.gender as any,
      status: r.student.status as any,
      feeStatus: r.student.feeStatus as any,
      bedLabel: r.bedLabel || undefined,
      roomNumber: r.roomNumber || undefined,
      floorName: r.floorName || undefined,
      blockName: r.blockName || undefined,
      hostelName: r.hostelName || undefined,
      hostelId: r.hostelId || undefined,
    }));

    return { data, total };
  }

  /**
   * Fetches student with associated guardians, documents, and room allocation history.
   */
  static async findByIdWithRelations(id: string): Promise<StudentDetailedDto | null> {
    const db = getDb();
    const student = await this.findById(id);
    if (!student) return null;

    // Fetch guardians
    const guardianRows = await db
      .select()
      .from(guardians)
      .where(eq(guardians.studentId, id));

    // Fetch documents
    const docRows = await db
      .select()
      .from(studentDocuments)
      .where(eq(studentDocuments.studentId, id))
      .orderBy(desc(studentDocuments.uploadedAt));

    // Fetch allocation history
    const allocationHistory = await AllocationRepository.getAllocationHistory(id);
    const activeAllocation = allocationHistory.find((a) => a.status === 'active') || null;

    // Fetch spatial details if assigned to a bed
    let spatialInfo: {
      bedLabel?: string;
      roomNumber?: string;
      floorName?: string;
      blockName?: string;
      hostelName?: string;
      hostelId?: string;
    } = {};

    if (student.assignedBedId) {
      const spatial = await db
        .select({
          bedLabel: beds.bedLabel,
          roomNumber: rooms.roomNumber,
          floorName: floors.name,
          blockName: blocks.name,
          hostelName: hostels.name,
          hostelId: hostels.id,
        })
        .from(beds)
        .leftJoin(rooms, eq(beds.roomId, rooms.id))
        .leftJoin(floors, eq(rooms.floorId, floors.id))
        .leftJoin(blocks, eq(floors.blockId, blocks.id))
        .leftJoin(hostels, eq(blocks.hostelId, hostels.id))
        .where(eq(beds.id, student.assignedBedId))
        .limit(1);

      if (spatial.length > 0) {
        spatialInfo = {
          bedLabel: spatial[0].bedLabel || undefined,
          roomNumber: spatial[0].roomNumber || undefined,
          floorName: spatial[0].floorName || undefined,
          blockName: spatial[0].blockName || undefined,
          hostelName: spatial[0].hostelName || undefined,
          hostelId: spatial[0].hostelId || undefined,
        };
      }
    }

    return {
      ...student,
      gender: student.gender as any,
      status: student.status as any,
      feeStatus: student.feeStatus as any,
      ...spatialInfo,
      guardians: guardianRows.map((g) => ({
        id: g.id,
        studentId: g.studentId,
        name: g.name,
        relationship: g.relationship as any,
        phone: g.phone,
        alternatePhone: g.alternatePhone,
        email: g.email,
        address: g.address,
        isPrimary: g.isPrimary,
      })),
      documents: docRows.map((d) => ({
        id: d.id,
        studentId: d.studentId,
        docType: d.docType as any,
        fileName: d.fileName,
        filePath: d.filePath,
        fileHash: d.fileHash,
        uploadedAt: d.uploadedAt,
      })),
      activeAllocation: activeAllocation as any,
      allocationHistory: allocationHistory as any,
    };
  }

  /**
   * Atomic student creation with guardian records.
   */
  static async createWithGuardians(
    studentData: NewStudent,
    guardiansList: CreateGuardianInput[] = []
  ): Promise<StudentDetailedDto> {
    const db = getDb();

    return db.transaction((tx) => {
      tx.insert(students).values(studentData).run();

      for (let i = 0; i < guardiansList.length; i++) {
        const g = guardiansList[i];
        const guardianId = generateEntityId('GRD');
        tx.insert(guardians)
          .values({
            id: guardianId,
            studentId: studentData.id,
            name: g.name,
            relationship: g.relationship,
            phone: g.phone,
            alternatePhone: g.alternatePhone || null,
            email: g.email || null,
            address: g.address || null,
            isPrimary: g.isPrimary === false ? 0 : 1,
          })
          .run();
      }

      // Return newly created student record
      const created = tx.select().from(students).where(eq(students.id, studentData.id)).get();
      if (!created) {
        throw new Error(`Failed to create student ${studentData.id}`);
      }

      const guardianRows = tx
        .select()
        .from(guardians)
        .where(eq(guardians.studentId, studentData.id))
        .all();

      return {
        ...created,
        gender: created.gender as any,
        status: created.status as any,
        feeStatus: created.feeStatus as any,
        guardians: guardianRows.map((g) => ({
          id: g.id,
          studentId: g.studentId,
          name: g.name,
          relationship: g.relationship as any,
          phone: g.phone,
          alternatePhone: g.alternatePhone,
          email: g.email,
          address: g.address,
          isPrimary: g.isPrimary,
        })),
        documents: [],
        allocationHistory: [],
      };
    });
  }

  /**
   * Atomic student updates with optional guardian synchronization.
   */
  static async updateWithGuardians(
    id: string,
    studentUpdates: Partial<NewStudent>,
    guardiansList?: CreateGuardianInput[]
  ): Promise<StudentDetailedDto | null> {
    const db = getDb();
    const now = Date.now();

    db.transaction((tx) => {
      tx.update(students)
        .set({ ...studentUpdates, updatedAt: now })
        .where(eq(students.id, id))
        .run();

      if (guardiansList !== undefined) {
        // Clear previous guardians and re-insert
        tx.delete(guardians).where(eq(guardians.studentId, id)).run();

        for (const g of guardiansList) {
          const guardianId = generateEntityId('GRD');
          tx.insert(guardians)
            .values({
              id: guardianId,
              studentId: id,
              name: g.name,
              relationship: g.relationship,
              phone: g.phone,
              alternatePhone: g.alternatePhone || null,
              email: g.email || null,
              address: g.address || null,
              isPrimary: g.isPrimary === false ? 0 : 1,
            })
            .run();
        }
      }
    });

    return this.findByIdWithRelations(id);
  }

  /**
   * Bulk updates student status inside a transaction.
   */
  static async bulkUpdateStatus(
    studentIds: string[],
    newStatus: string
  ): Promise<{ updatedCount: number }> {
    const db = getDb();
    const now = Date.now();

    return db.transaction((tx) => {
      let count = 0;
      for (const id of studentIds) {
        const res = tx
          .update(students)
          .set({ status: newStatus, updatedAt: now })
          .where(eq(students.id, id))
          .run();
        count += res.changes;
      }
      return { updatedCount: count };
    });
  }

  /**
   * Document record attachments.
   */
  static async attachDocument(data: {
    id: string;
    studentId: string;
    docType: string;
    fileName: string;
    filePath: string;
    fileHash: string;
    uploadedAt: number;
  }): Promise<StudentDocument> {
    const db = getDb();
    await db.insert(studentDocuments).values(data);
    const rows = await db
      .select()
      .from(studentDocuments)
      .where(eq(studentDocuments.id, data.id))
      .limit(1);
    return rows[0];
  }

  static async removeDocument(docId: string): Promise<StudentDocument | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(studentDocuments)
      .where(eq(studentDocuments.id, docId))
      .limit(1);
    if (rows.length === 0) return null;

    await db.delete(studentDocuments).where(eq(studentDocuments.id, docId));
    return rows[0];
  }

  static async getDocuments(studentId: string): Promise<StudentDocument[]> {
    const db = getDb();
    return db
      .select()
      .from(studentDocuments)
      .where(eq(studentDocuments.studentId, studentId))
      .orderBy(desc(studentDocuments.uploadedAt));
  }

  static async updatePhoto(studentId: string, photoPath: string | null): Promise<Student | null> {
    const db = getDb();
    await db
      .update(students)
      .set({ photoPath, updatedAt: Date.now() })
      .where(eq(students.id, studentId));
    return this.findById(studentId);
  }

  static async create(studentData: NewStudent): Promise<Student> {
    const db = getDb();
    await db.insert(students).values(studentData);
    const created = await this.findById(studentData.id);
    if (!created) {
      throw new Error(`Failed to retrieve newly inserted student with ID: ${studentData.id}`);
    }
    return created;
  }

  static async update(id: string, updates: Partial<NewStudent>): Promise<Student | null> {
    const db = getDb();
    await db
      .update(students)
      .set({ ...updates, updatedAt: Date.now() })
      .where(eq(students.id, id));
    return this.findById(id);
  }

  static async count(): Promise<number> {
    const db = getDb();
    const result = await db.select({ value: count() }).from(students);
    return result[0]?.value || 0;
  }

  static async searchStudents(params: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: string;
  } = {}): Promise<{ data: StudentDto[]; total: number }> {
    const limit = params.pageSize || 50;
    const offset = ((params.page || 1) - 1) * limit;
    return this.search({ query: params.query, status: params.status, limit, offset });
  }

  static async createStudent(studentData: NewStudent): Promise<Student> {
    return this.create(studentData);
  }
}
