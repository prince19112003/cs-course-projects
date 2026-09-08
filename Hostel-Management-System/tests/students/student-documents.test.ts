import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { StudentService } from '../../src/main/services/StudentService.js';
import { SessionUser } from '../../src/shared/types.js';
import fs from 'fs';

describe('Phase 05: Student Documents & Photo Handling Sandbox', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-001',
    name: 'Admin Supervisor',
    email: 'admin@nexus.test',
    phone: '9999999991',
    role: 'admin',
    permissions: ['students:view', 'students:create', 'students:edit', 'students:archive'],
    forcePasswordChange: false,
  };

  let testStudentId: string;

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

    const student = await StudentService.createStudent(mockAdmin, {
      enrollmentNumber: 'ENR-DOC-001',
      firstName: 'Elena',
      lastName: 'Rostova',
      dateOfBirth: '2004-04-10',
      gender: 'female',
      email: 'elena@nexus.edu',
      phone: '9444444401',
      course: 'Civil Engineering',
      department: 'Engineering',
      academicYear: 1,
      admissionDate: '2026-08-01',
      permanentAddress: '42 Academic Boulevard',
    });
    testStudentId = student.id;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('uploads document, computes SHA-256 hash, and saves metadata', async () => {
    const sampleContent = 'Official Admission Agreement for Elena Rostova';
    const base64Content = Buffer.from(sampleContent).toString('base64');

    const docRecord = await StudentService.uploadDocument(mockAdmin, testStudentId, {
      docType: 'admission_agreement',
      fileName: 'agreement.pdf',
      base64: base64Content,
    });

    expect(docRecord.id).toMatch(/^DOC-[A-F0-9]{8}$/);
    expect(docRecord.docType).toBe('admission_agreement');
    expect(docRecord.fileName).toBe('agreement.pdf');
    expect(docRecord.fileHash).toHaveLength(64); // SHA-256 hex length
    expect(fs.existsSync(docRecord.filePath)).toBe(true);

    const dossier = await StudentService.getStudentById(mockAdmin, testStudentId);
    expect(dossier.documents).toHaveLength(1);
    expect(dossier.documents[0].id).toBe(docRecord.id);

    // Clean up created file
    try {
      fs.unlinkSync(docRecord.filePath);
    } catch {}
  });

  it('uploads portrait photo and updates student photoPath', async () => {
    const mockImageContent = 'mock-jpg-image-binary-stream';
    const base64Content = Buffer.from(mockImageContent).toString('base64');

    const photoRes = await StudentService.uploadPhoto(mockAdmin, testStudentId, {
      base64: base64Content,
      fileName: 'portrait.jpg',
    });

    expect(photoRes.photoPath.endsWith('.jpg')).toBe(true);
    expect(fs.existsSync(photoRes.photoPath)).toBe(true);

    const dossier = await StudentService.getStudentById(mockAdmin, testStudentId);
    expect(dossier.photoPath).toBe(photoRes.photoPath);

    // Clean up created photo file
    try {
      fs.unlinkSync(photoRes.photoPath);
    } catch {}
  });

  it('removes attached document and cleans up file reference', async () => {
    const sampleContent = 'Disciplinary Undertaking';
    const base64Content = Buffer.from(sampleContent).toString('base64');

    const docRecord = await StudentService.uploadDocument(mockAdmin, testStudentId, {
      docType: 'undertaking',
      fileName: 'undertaking.pdf',
      base64: base64Content,
    });

    const deleteRes = await StudentService.deleteDocument(mockAdmin, testStudentId, docRecord.id);
    expect(deleteRes.success).toBe(true);

    const dossier = await StudentService.getStudentById(mockAdmin, testStudentId);
    expect(dossier.documents).toHaveLength(0);
    expect(fs.existsSync(docRecord.filePath)).toBe(false);
  });
});
