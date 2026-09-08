import { AllocationRepository, EnrichedAllocation, AllocationQueryParams } from '../database/repositories/AllocationRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { StudentRepository } from '../database/repositories/StudentRepository.js';
import { Allocation } from '../database/schema/allocations.js';
import { SessionUser } from '../../shared/types.js';

export class AllocationService {
  /**
   * Retrieves enriched allocations with student and spatial details.
   */
  static async getAllocations(params: AllocationQueryParams = {}): Promise<{ data: EnrichedAllocation[]; total: number }> {
    return AllocationRepository.getAllocations(params);
  }

  /**
   * Retrieves chronological allocation history for a student or bed.
   */
  static async getAllocationHistory(studentId?: string, bedId?: string): Promise<EnrichedAllocation[]> {
    return AllocationRepository.getAllocationHistory(studentId, bedId);
  }

  /**
   * Performs a new bed allocation inside an ACID transaction.
   */
  static async allocateBed(
    user: SessionUser,
    params: {
      studentId: string;
      bedId: string;
      allocationType?: 'fresh_admission' | 'requested_transfer' | 'administrative_transfer';
      remarks?: string;
    }
  ): Promise<Allocation> {
    const allocation = await AllocationRepository.executeAtomicAllocation({
      studentId: params.studentId,
      bedId: params.bedId,
      allocatedBy: user.id,
      allocationType: params.allocationType,
      remarks: params.remarks,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ALLOCATION_CREATED',
      entityType: 'allocations',
      entityId: allocation.id,
      details: JSON.stringify({
        studentId: params.studentId,
        bedId: params.bedId,
        type: params.allocationType || 'fresh_admission',
      }),
    });

    return allocation;
  }

  /**
   * Performs an atomic bed transfer inside an ACID transaction.
   */
  static async transferBed(
    user: SessionUser,
    params: {
      studentId: string;
      destinationBedId: string;
      transferType?: 'requested_transfer' | 'administrative_transfer';
      remarks?: string;
    }
  ): Promise<{ oldAllocation: Allocation; newAllocation: Allocation }> {
    const result = await AllocationRepository.executeAtomicTransfer({
      studentId: params.studentId,
      destinationBedId: params.destinationBedId,
      allocatedBy: user.id,
      transferType: params.transferType,
      remarks: params.remarks,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ALLOCATION_TRANSFERRED',
      entityType: 'allocations',
      entityId: result.newAllocation.id,
      details: JSON.stringify({
        studentId: params.studentId,
        fromBedId: result.oldAllocation.bedId,
        toBedId: params.destinationBedId,
        transferType: params.transferType || 'requested_transfer',
      }),
    });

    return result;
  }

  /**
   * Vacates an active bed allocation inside an ACID transaction.
   */
  static async vacateBed(
    user: SessionUser,
    params: {
      allocationId: string;
      remarks?: string;
    }
  ): Promise<Allocation> {
    const vacated = await AllocationRepository.executeAtomicVacate(params.allocationId, params.remarks);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ALLOCATION_VACATED',
      entityType: 'allocations',
      entityId: params.allocationId,
      details: JSON.stringify({
        studentId: vacated.studentId,
        bedId: vacated.bedId,
        remarks: params.remarks,
      }),
    });

    return vacated;
  }

  /**
   * Returns registered student directory for room allocations.
   */
  static async getDevTestStudents(): Promise<Array<{ id: string; name: string; enrollmentNumber: string; isAllocated: boolean }>> {
    const studentsRes = await StudentRepository.searchStudents({ page: 1, pageSize: 100 });
    let list = studentsRes.data;

    if (list.length === 0) {
      const now = Date.now();
      const initialStudents = [
        {
          id: 'STU-0001',
          enrollmentNumber: 'ENR-2026-001',
          firstName: 'Aarav',
          lastName: 'Sharma',
          dateOfBirth: '2004-05-14',
          gender: 'male',
          email: 'aarav.sharma@nexus.edu',
          phone: '9870000001',
          course: 'B.Tech Computer Science',
          department: 'Computer Science',
          academicYear: 2,
          admissionDate: '2025-08-01',
          permanentAddress: '42 Orchid Way, Metro City',
          status: 'active',
          feeStatus: 'paid',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'STU-0002',
          enrollmentNumber: 'ENR-2026-002',
          firstName: 'Rohan',
          lastName: 'Verma',
          dateOfBirth: '2004-08-20',
          gender: 'male',
          email: 'rohan.verma@nexus.edu',
          phone: '9870000002',
          course: 'B.Tech Electrical Engineering',
          department: 'Electrical Engineering',
          academicYear: 2,
          admissionDate: '2025-08-01',
          permanentAddress: '18 Greenfield Sector, New Town',
          status: 'active',
          feeStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'STU-0003',
          enrollmentNumber: 'ENR-2026-003',
          firstName: 'Priya',
          lastName: 'Patel',
          dateOfBirth: '2005-02-11',
          gender: 'female',
          email: 'priya.patel@nexus.edu',
          phone: '9870000003',
          course: 'B.Sc Biotechnology',
          department: 'Biotechnology',
          academicYear: 1,
          admissionDate: '2026-08-01',
          permanentAddress: '88 Lakeview Heights, West District',
          status: 'active',
          feeStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const s of initialStudents) {
        await StudentRepository.createStudent(s as any);
      }

      const refreshed = await StudentRepository.searchStudents({ page: 1, pageSize: 100 });
      list = refreshed.data;
    }

    return list.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      enrollmentNumber: s.enrollmentNumber,
      isAllocated: Boolean(s.assignedBedId),
    }));
  }
}
