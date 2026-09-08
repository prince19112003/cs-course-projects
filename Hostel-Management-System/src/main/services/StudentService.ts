import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { StudentRepository } from '../database/repositories/StudentRepository.js';
import { AllocationRepository } from '../database/repositories/AllocationRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { generateEntityId } from '../database/utils/id-generator.js';
import { Student, StudentDocument } from '../database/schema/students.js';
import {
  SessionUser,
  StudentDto,
  StudentDetailedDto,
  StudentSearchParams,
  CreateStudentInput,
  UpdateStudentInput,
  AllocationDto,
} from '../../shared/types.js';

// Authorization helper
function verifyPermission(user: SessionUser, permission: string): void {
  if (user.role === 'super_admin' || user.permissions.includes('*')) {
    return;
  }
  if (!user.permissions.includes(permission)) {
    throw new Error(`FORBIDDEN: User lacks required permission '${permission}'.`);
  }
}

// Storage path helper
function getStorageDirectory(subDir: 'photos' | 'documents'): string {
  let baseDir: string;
  try {
    // Dynamic check for electron
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    baseDir = path.join(app.getPath('userData'), 'NexusHostel');
  } catch {
    const root = process.env.APPDATA || process.cwd();
    baseDir = path.join(root, 'NexusHostel');
  }

  const targetDir = path.join(baseDir, subDir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

// Validation Schemas
export const GuardianInputSchema = z.object({
  name: z.string().trim().min(2, 'Guardian name must be at least 2 characters'),
  relationship: z.enum(['father', 'mother', 'guardian']),
  phone: z.string().trim().min(7, 'Guardian phone must be at least 7 digits'),
  alternatePhone: z.string().trim().optional(),
  email: z.string().trim().email('Invalid guardian email').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  isPrimary: z.boolean().optional(),
});

export const CreateStudentSchema = z.object({
  enrollmentNumber: z.string().trim().min(2, 'Enrollment number is required'),
  nationalId: z.string().trim().optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits'),
  course: z.string().trim().min(1, 'Course is required'),
  department: z.string().trim().min(1, 'Department is required'),
  academicYear: z.number().int().min(1, 'Academic year must be greater than 0'),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Admission date must be in YYYY-MM-DD format'),
  permanentAddress: z.string().trim().min(3, 'Permanent address is required'),
  currentAddress: z.string().trim().optional().or(z.literal('')),
  photoPath: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'left', 'graduated', 'vacated', 'expelled', 'suspended']).optional(),
  feeStatus: z.enum(['paid', 'pending', 'overdue']).optional(),
  guardians: z.array(GuardianInputSchema).optional(),
  initialBedId: z.string().optional().or(z.literal('')),
});

export const UpdateStudentSchema = z.object({
  enrollmentNumber: z.string().trim().min(2).optional(),
  nationalId: z.string().trim().optional().or(z.literal('')),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(7).optional(),
  course: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  academicYear: z.number().int().min(1).optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  permanentAddress: z.string().trim().min(3).optional(),
  currentAddress: z.string().trim().optional().or(z.literal('')),
  photoPath: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'left', 'graduated', 'vacated', 'expelled', 'suspended']).optional(),
  feeStatus: z.enum(['paid', 'pending', 'overdue']).optional(),
  guardians: z.array(GuardianInputSchema).optional(),
});

export class StudentService {
  /**
   * Search / filter student directory with database-side execution.
   */
  static async searchStudents(
    user: SessionUser,
    params: StudentSearchParams = {}
  ): Promise<{ data: StudentDto[]; total: number }> {
    verifyPermission(user, 'students:view');
    return StudentRepository.search(params);
  }

  /**
   * Retrieve full student dossier including guardians, documents, and past stays.
   */
  static async getStudentById(user: SessionUser, id: string): Promise<StudentDetailedDto> {
    verifyPermission(user, 'students:view');
    const student = await StudentRepository.findByIdWithRelations(id);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student with ID '${id}' does not exist.`);
    }
    return student;
  }

  /**
   * Register a new student with unique constraints and optional initial allocation.
   */
  static async createStudent(
    user: SessionUser,
    rawInput: CreateStudentInput
  ): Promise<StudentDetailedDto> {
    verifyPermission(user, 'students:create');

    const input = CreateStudentSchema.parse(rawInput);

    // Enforce unique constraints
    const [existingEnrollment, existingEmail, existingPhone, existingNationalId] = await Promise.all([
      StudentRepository.findByEnrollment(input.enrollmentNumber),
      StudentRepository.findByEmail(input.email),
      StudentRepository.findByPhone(input.phone),
      input.nationalId ? StudentRepository.findByNationalId(input.nationalId) : Promise.resolve(null),
    ]);

    if (existingEnrollment) {
      throw new Error(`DUPLICATE_ENROLLMENT: Enrollment number '${input.enrollmentNumber}' is already registered.`);
    }
    if (existingEmail) {
      throw new Error(`DUPLICATE_EMAIL: Email '${input.email}' is already in use by another student.`);
    }
    if (existingPhone) {
      throw new Error(`DUPLICATE_PHONE: Phone number '${input.phone}' is already registered.`);
    }
    if (existingNationalId) {
      throw new Error(`DUPLICATE_NATIONAL_ID: National ID '${input.nationalId}' is already on record.`);
    }

    const studentId = generateEntityId('STU');
    const now = Date.now();

    const studentRecord = {
      id: studentId,
      enrollmentNumber: input.enrollmentNumber.trim(),
      nationalId: input.nationalId?.trim() || null,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      bloodGroup: input.bloodGroup?.trim() || null,
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      course: input.course.trim(),
      department: input.department.trim(),
      academicYear: input.academicYear,
      admissionDate: input.admissionDate,
      permanentAddress: input.permanentAddress.trim(),
      currentAddress: input.currentAddress?.trim() || null,
      photoPath: input.photoPath || null,
      assignedBedId: null,
      status: input.status || 'active',
      feeStatus: input.feeStatus || 'paid',
      createdAt: now,
      updatedAt: now,
    };

    // Insert student & guardians atomically
    const createdStudent = await StudentRepository.createWithGuardians(
      studentRecord,
      input.guardians || []
    );

    // If initial bed allocation requested, execute allocation
    if (input.initialBedId && input.initialBedId.trim().length > 0) {
      try {
        await AllocationRepository.executeAtomicAllocation({
          studentId: createdStudent.id,
          bedId: input.initialBedId.trim(),
          allocatedBy: user.id,
          allocationType: 'fresh_admission',
          remarks: 'Assigned during student registration',
        });
      } catch (allocErr) {
        // Bed allocation failure during registration is logged, but student remains registered
        console.error('Initial bed allocation failed:', allocErr);
      }
    }

    // Append Audit Log
    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'STUDENT_CREATED',
      entityType: 'students',
      entityId: studentId,
      changesSummary: {
        enrollmentNumber: input.enrollmentNumber,
        name: `${input.firstName} ${input.lastName}`,
        course: input.course,
      },
    });

    return (await StudentRepository.findByIdWithRelations(studentId))!;
  }

  /**
   * Update student personal, academic, or guardian information.
   */
  static async updateStudent(
    user: SessionUser,
    id: string,
    rawUpdates: UpdateStudentInput
  ): Promise<StudentDetailedDto> {
    verifyPermission(user, 'students:edit');

    const updates = UpdateStudentSchema.parse(rawUpdates);
    const existing = await StudentRepository.findById(id);
    if (!existing) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${id}' not found.`);
    }

    // Uniqueness validations if changed
    if (updates.enrollmentNumber && updates.enrollmentNumber !== existing.enrollmentNumber) {
      const dup = await StudentRepository.findByEnrollment(updates.enrollmentNumber);
      if (dup && dup.id !== id) {
        throw new Error(`DUPLICATE_ENROLLMENT: Enrollment number '${updates.enrollmentNumber}' is already in use.`);
      }
    }

    if (updates.email && updates.email.toLowerCase() !== existing.email.toLowerCase()) {
      const dup = await StudentRepository.findByEmail(updates.email);
      if (dup && dup.id !== id) {
        throw new Error(`DUPLICATE_EMAIL: Email '${updates.email}' is already registered.`);
      }
    }

    if (updates.phone && updates.phone !== existing.phone) {
      const dup = await StudentRepository.findByPhone(updates.phone);
      if (dup && dup.id !== id) {
        throw new Error(`DUPLICATE_PHONE: Phone '${updates.phone}' is already registered.`);
      }
    }

    if (updates.nationalId && updates.nationalId !== existing.nationalId) {
      const dup = await StudentRepository.findByNationalId(updates.nationalId);
      if (dup && dup.id !== id) {
        throw new Error(`DUPLICATE_NATIONAL_ID: National ID '${updates.nationalId}' is already registered.`);
      }
    }

    const studentUpdates: Partial<Student> = {};
    if (updates.enrollmentNumber) studentUpdates.enrollmentNumber = updates.enrollmentNumber.trim();
    if (updates.nationalId !== undefined) studentUpdates.nationalId = updates.nationalId?.trim() || null;
    if (updates.firstName) studentUpdates.firstName = updates.firstName.trim();
    if (updates.lastName) studentUpdates.lastName = updates.lastName.trim();
    if (updates.dateOfBirth) studentUpdates.dateOfBirth = updates.dateOfBirth;
    if (updates.gender) studentUpdates.gender = updates.gender;
    if (updates.bloodGroup !== undefined) studentUpdates.bloodGroup = updates.bloodGroup?.trim() || null;
    if (updates.email) studentUpdates.email = updates.email.trim().toLowerCase();
    if (updates.phone) studentUpdates.phone = updates.phone.trim();
    if (updates.course) studentUpdates.course = updates.course.trim();
    if (updates.department) studentUpdates.department = updates.department.trim();
    if (updates.academicYear !== undefined) studentUpdates.academicYear = updates.academicYear;
    if (updates.admissionDate) studentUpdates.admissionDate = updates.admissionDate;
    if (updates.permanentAddress) studentUpdates.permanentAddress = updates.permanentAddress.trim();
    if (updates.currentAddress !== undefined) studentUpdates.currentAddress = updates.currentAddress?.trim() || null;
    if (updates.photoPath !== undefined) studentUpdates.photoPath = updates.photoPath || null;
    if (updates.status) studentUpdates.status = updates.status;
    if (updates.feeStatus) studentUpdates.feeStatus = updates.feeStatus;

    const updated = await StudentRepository.updateWithGuardians(
      id,
      studentUpdates as any,
      updates.guardians as any
    );

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'STUDENT_UPDATED',
      entityType: 'students',
      entityId: id,
      changesSummary: {
        updatedFields: Object.keys(studentUpdates),
      },
    });

    return updated!;
  }

  /**
   * Change student status (e.g. active, inactive, left, graduated, vacated).
   */
  static async setStudentStatus(
    user: SessionUser,
    id: string,
    newStatus: 'active' | 'inactive' | 'left' | 'graduated' | 'vacated' | 'expelled' | 'suspended',
    remarks?: string
  ): Promise<StudentDetailedDto> {
    verifyPermission(user, 'students:archive');

    const student = await StudentRepository.findById(id);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${id}' not found.`);
    }

    const oldStatus = student.status;
    if (oldStatus === newStatus) {
      return (await StudentRepository.findByIdWithRelations(id))!;
    }

    // Business Rule: If student is marked inactive/left/graduated/vacated/expelled and holds an active bed,
    // we must vacate the bed atomically to prevent orphaned active allocations.
    if (['inactive', 'left', 'graduated', 'vacated', 'expelled'].includes(newStatus)) {
      const activeAlloc = await AllocationRepository.getActiveAllocationForStudent(id);
      if (activeAlloc) {
        await AllocationRepository.executeAtomicVacate(
          activeAlloc.id,
          remarks || `Auto-vacated upon student status change to ${newStatus}`
        );
      }
    }

    await StudentRepository.update(id, { status: newStatus });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'STUDENT_STATUS_CHANGED',
      entityType: 'students',
      entityId: id,
      changesSummary: {
        oldStatus,
        newStatus,
        remarks: remarks || null,
      },
    });

    return (await StudentRepository.findByIdWithRelations(id))!;
  }

  /**
   * Bulk update status for multiple students.
   */
  static async bulkUpdateStatus(
    user: SessionUser,
    studentIds: string[],
    newStatus: string,
    remarks?: string
  ): Promise<{ updatedCount: number }> {
    verifyPermission(user, 'students:archive');

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new Error('No student IDs provided for bulk status update.');
    }

    // If setting to an inactive/vacated state, vacate any active beds
    if (['inactive', 'left', 'graduated', 'vacated', 'expelled'].includes(newStatus)) {
      for (const id of studentIds) {
        const activeAlloc = await AllocationRepository.getActiveAllocationForStudent(id);
        if (activeAlloc) {
          await AllocationRepository.executeAtomicVacate(
            activeAlloc.id,
            remarks || `Auto-vacated during bulk status change to ${newStatus}`
          );
        }
      }
    }

    const res = await StudentRepository.bulkUpdateStatus(studentIds, newStatus);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'STUDENT_BULK_STATUS_UPDATE',
      entityType: 'students',
      changesSummary: {
        studentCount: studentIds.length,
        newStatus,
        remarks: remarks || null,
      },
    });

    return res;
  }

  /**
   * Upload and safely store student portrait photo.
   */
  static async uploadPhoto(
    user: SessionUser,
    studentId: string,
    data: { base64: string; fileName: string }
  ): Promise<{ photoPath: string }> {
    verifyPermission(user, 'students:edit');

    const student = await StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${studentId}' not found.`);
    }

    const ext = path.extname(data.fileName).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      throw new Error(`INVALID_FILE_TYPE: Allowed photo formats are .jpg, .jpeg, .png, .webp.`);
    }

    // Remove base64 data prefix if present (e.g. data:image/jpeg;base64,)
    const cleanBase64 = data.base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error(`FILE_TOO_LARGE: Photo size exceeds 5MB ceiling.`);
    }

    const photosDir = getStorageDirectory('photos');
    const safeFileName = `${studentId}_${Date.now()}${ext}`;
    const destinationPath = path.join(photosDir, safeFileName);

    fs.writeFileSync(destinationPath, buffer);

    // Save relative or absolute path
    await StudentRepository.updatePhoto(studentId, destinationPath);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'PHOTO_UPDATED',
      entityType: 'students',
      entityId: studentId,
      changesSummary: { fileName: safeFileName },
    });

    return { photoPath: destinationPath };
  }

  /**
   * Upload and attach identity or clearance document with SHA-256 integrity hash.
   */
  static async uploadDocument(
    user: SessionUser,
    studentId: string,
    data: {
      docType: 'id_proof' | 'admission_agreement' | 'medical_clearance' | 'undertaking' | 'other';
      fileName: string;
      base64: string;
    }
  ): Promise<StudentDocument> {
    verifyPermission(user, 'students:edit');

    const student = await StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${studentId}' not found.`);
    }

    const ext = path.extname(data.fileName).toLowerCase();
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
    if (!allowedExts.includes(ext)) {
      throw new Error(`INVALID_FILE_TYPE: Allowed document types are ${allowedExts.join(', ')}.`);
    }

    const cleanBase64 = data.base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error(`FILE_TOO_LARGE: Document size exceeds 10MB limit.`);
    }

    // Calculate SHA-256 checksum for audit and integrity verification
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const docId = generateEntityId('DOC');
    const documentsDir = getStorageDirectory('documents');
    const safeName = `${docId}_${path.basename(data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const targetPath = path.join(documentsDir, safeName);

    fs.writeFileSync(targetPath, buffer);

    const docRecord = await StudentRepository.attachDocument({
      id: docId,
      studentId,
      docType: data.docType,
      fileName: data.fileName,
      filePath: targetPath,
      fileHash,
      uploadedAt: Date.now(),
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'DOCUMENT_ATTACHED',
      entityType: 'student_documents',
      entityId: docId,
      changesSummary: {
        studentId,
        docType: data.docType,
        fileName: data.fileName,
        fileHash,
      },
    });

    return docRecord;
  }

  /**
   * Delete an attached document and remove sandboxed file.
   */
  static async deleteDocument(
    user: SessionUser,
    studentId: string,
    docId: string
  ): Promise<{ success: boolean }> {
    verifyPermission(user, 'students:edit');

    const docs = await StudentRepository.getDocuments(studentId);
    const target = docs.find((d) => d.id === docId);
    if (!target) {
      throw new Error(`DOCUMENT_NOT_FOUND: Document '${docId}' does not belong to student '${studentId}'.`);
    }

    await StudentRepository.removeDocument(docId);

    // Delete sandboxed file if exists
    if (fs.existsSync(target.filePath)) {
      try {
        fs.unlinkSync(target.filePath);
      } catch {
        // Ignored if file already unlinked
      }
    }

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'DOCUMENT_REMOVED',
      entityType: 'student_documents',
      entityId: docId,
      changesSummary: { studentId, fileName: target.fileName },
    });

    return { success: true };
  }

  /**
   * Safely open a document in the native system viewer with path traversal validation.
   */
  static async openDocument(user: SessionUser, docId: string): Promise<{ opened: boolean }> {
    verifyPermission(user, 'students:view');

    const db = (await import('../database/connection.js')).getDb();
    const schema = (await import('../database/schema/students.js')).studentDocuments;
    const { eq } = await import('drizzle-orm');

    const rows = await db.select().from(schema).where(eq(schema.id, docId)).limit(1);
    const doc = rows[0];
    if (!doc) {
      throw new Error(`DOCUMENT_NOT_FOUND: Document '${docId}' does not exist.`);
    }

    const documentsDir = getStorageDirectory('documents');
    const resolvedPath = path.resolve(doc.filePath);
    const resolvedBase = path.resolve(documentsDir);

    // Path traversal defense: file MUST reside strictly inside documents directory
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('SECURITY_VIOLATION: Document path resides outside authorized sandbox.');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error('FILE_MISSING: Physical file could not be found on disk.');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { shell } = require('electron');
      await shell.openPath(resolvedPath);
      return { opened: true };
    } catch {
      return { opened: false };
    }
  }

  /**
   * Get student's current allocation and complete stay history.
   */
  static async getAllocationHistory(
    user: SessionUser,
    studentId: string
  ): Promise<AllocationDto[]> {
    verifyPermission(user, 'students:view');
    const history = await AllocationRepository.getAllocationHistory(studentId);
    return history as any;
  }
}
