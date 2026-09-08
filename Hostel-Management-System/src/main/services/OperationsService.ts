import { z } from 'zod';
import { OperationsRepository } from '../database/repositories/OperationsRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { StudentRepository } from '../database/repositories/StudentRepository.js';
import { SessionUser } from '../../shared/types.js';
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
  MarkAttendanceItem,
  CreateGatePassInput,
  CreateComplaintInput,
  CreateNoticeInput,
  RegisterVisitorInput,
  CreateStaffInput,
  CreateRoomAssetInput,
} from '../../shared/types.js';

function verifyPermission(user: SessionUser, permission: string): void {
  if (user.role === 'super_admin' || user.permissions.includes('*')) {
    return;
  }
  if (!user.permissions.includes(permission)) {
    throw new Error(`FORBIDDEN: User lacks required permission '${permission}'.`);
  }
}

export class OperationsService {
  // --------------------------------------------------------------------------
  // 1. ATTENDANCE
  // --------------------------------------------------------------------------
  static async markAttendance(
    user: SessionUser,
    date: string,
    items: MarkAttendanceItem[]
  ): Promise<{ savedCount: number }> {
    verifyPermission(user, 'attendance:mark');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('INVALID_DATE: Date must be in YYYY-MM-DD format.');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No attendance items provided.');
    }

    // Process items & auto-detect approved leave passes
    const processedRecords = await Promise.all(
      items.map(async (item) => {
        let status = item.status;
        let remarks = item.remarks;
        // Automated rule: If unmarked/absent, check if student has approved gate pass
        if (status === 'absent' || status === 'unmarked' as any) {
          const hasPass = await OperationsRepository.hasActiveApprovedPass(item.studentId, date);
          if (hasPass) {
            status = 'approved_leave';
            remarks = remarks ? `${remarks} (Approved Gate Pass)` : 'Approved Gate Pass';
          }
        }
        return {
          studentId: item.studentId,
          date,
          status,
          recordedBy: user.id,
          remarks,
        };
      })
    );

    const res = await OperationsRepository.markAttendanceBatch(processedRecords);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ATTENDANCE_MARKED',
      entityType: 'attendance',
      changesSummary: {
        date,
        totalCount: items.length,
      },
    });

    return { markedCount: res.savedCount };
  }

  static async getAttendanceByDate(
    user: SessionUser,
    params: { date: string; hostelId?: string; blockId?: string }
  ): Promise<AttendanceDto[]> {
    return OperationsRepository.getAttendanceByDate(params);
  }

  static async getAttendanceSummary(
    user: SessionUser,
    date: string,
    hostelId?: string
  ): Promise<AttendanceSummaryDto> {
    return OperationsRepository.getAttendanceSummary(date, hostelId);
  }

  static async getAttendanceHistory(
    user: SessionUser,
    studentId: string
  ): Promise<AttendanceDto[]> {
    return OperationsRepository.getAttendanceHistory(studentId);
  }

  // --------------------------------------------------------------------------
  // 2. GATE PASSES / LEAVE
  // --------------------------------------------------------------------------
  static async getGatePasses(
    user: SessionUser,
    params: { status?: string; studentId?: string; limit?: number; offset?: number } = {}
  ): Promise<{ data: GatePassDto[]; total: number }> {
    return OperationsRepository.getGatePasses(params);
  }

  static async createGatePass(
    user: SessionUser,
    input: CreateGatePassInput
  ): Promise<GatePassDto> {
    const student = await StudentRepository.findById(input.studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${input.studentId}' not found.`);
    }

    if (input.departureTime >= input.expectedReturnTime) {
      throw new Error('INVALID_TIME_RANGE: Departure time must precede return time.');
    }

    const created = await OperationsRepository.createGatePass(input);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'GATEPASS_CREATED',
      entityType: 'gate_passes',
      entityId: created.id,
      changesSummary: {
        studentId: input.studentId,
        passType: input.passType,
        destination: input.destination,
      },
    });

    const refreshed = await OperationsRepository.getGatePasses({ studentId: input.studentId, limit: 1 });
    return refreshed.data[0];
  }

  static async reviewGatePass(
    user: SessionUser,
    id: string,
    status: 'approved' | 'rejected',
    reviewNotes?: string
  ): Promise<GatePassDto> {
    verifyPermission(user, 'gatepass:approve');

    const updated = await OperationsRepository.reviewGatePass(id, status, user.id, reviewNotes);
    if (!updated) {
      throw new Error(`GATEPASS_NOT_FOUND: Gate pass '${id}' not found.`);
    }

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'GATEPASS_REVIEWED',
      entityType: 'gate_passes',
      entityId: id,
      changesSummary: { status, reviewNotes },
    });

    const res = await OperationsRepository.getGatePasses({ limit: 50 });
    return res.data.find((g) => g.id === id)!;
  }

  static async logGatePassMovement(
    user: SessionUser,
    id: string,
    movement: 'exit' | 'return'
  ): Promise<GatePassDto> {
    const updated = await OperationsRepository.updateGatePassMovement(id, movement);
    if (!updated) {
      throw new Error(`GATEPASS_NOT_FOUND: Gate pass '${id}' not found.`);
    }

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: movement === 'exit' ? 'GATEPASS_EXIT' : 'GATEPASS_RETURN',
      entityType: 'gate_passes',
      entityId: id,
    });

    const res = await OperationsRepository.getGatePasses({ limit: 50 });
    return res.data.find((g) => g.id === id)!;
  }

  // --------------------------------------------------------------------------
  // 3. COMPLAINTS & MAINTENANCE
  // --------------------------------------------------------------------------
  static async getComplaints(
    user: SessionUser,
    params: {
      status?: string;
      category?: string;
      priority?: string;
      roomId?: string;
      studentId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: ComplaintDto[]; total: number }> {
    return OperationsRepository.getComplaints(params);
  }

  static async createComplaint(
    user: SessionUser,
    input: CreateComplaintInput
  ): Promise<ComplaintDto> {
    const student = await StudentRepository.findById(input.studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${input.studentId}' not found.`);
    }

    const created = await OperationsRepository.createComplaint(input);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'COMPLAINT_CREATED',
      entityType: 'complaints',
      entityId: created.id,
      changesSummary: {
        category: input.category,
        subject: input.subject,
        priority: input.priority || 'medium',
      },
    });

    const res = await OperationsRepository.getComplaints({ studentId: input.studentId, limit: 1 });
    return res.data[0];
  }

  static async resolveComplaint(
    user: SessionUser,
    id: string,
    status: 'open' | 'in_progress' | 'resolved' | 'rejected',
    assignedStaffId?: string,
    resolutionNotes?: string
  ): Promise<ComplaintDto> {
    verifyPermission(user, 'complaints:resolve');

    const updated = await OperationsRepository.updateComplaintStatus(
      id,
      status,
      assignedStaffId,
      resolutionNotes
    );
    if (!updated) {
      throw new Error(`COMPLAINT_NOT_FOUND: Complaint '${id}' not found.`);
    }

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: status === 'resolved' ? 'COMPLAINT_RESOLVED' : 'COMPLAINT_STATUS_CHANGED',
      entityType: 'complaints',
      entityId: id,
      changesSummary: { status, assignedStaffId, resolutionNotes },
    });

    const res = await OperationsRepository.getComplaints({ limit: 50 });
    return res.data.find((c) => c.id === id)!;
  }

  // --------------------------------------------------------------------------
  // 4. NOTICES / ANNOUNCEMENTS
  // --------------------------------------------------------------------------
  static async getNotices(
    user: SessionUser,
    params: { targetAudience?: string; activeOnly?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ data: NoticeDto[]; total: number }> {
    return OperationsRepository.getNotices(params);
  }

  static async createNotice(
    user: SessionUser,
    input: CreateNoticeInput
  ): Promise<NoticeDto> {
    verifyPermission(user, 'notices:publish');

    const created = await OperationsRepository.createNotice({
      ...input,
      publishedBy: user.id,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'NOTICE_PUBLISHED',
      entityType: 'notices',
      entityId: created.id,
      changesSummary: { title: input.title, targetAudience: input.targetAudience },
    });

    const res = await OperationsRepository.getNotices({ limit: 1 });
    return res.data[0];
  }

  static async deleteNotice(user: SessionUser, id: string): Promise<boolean> {
    verifyPermission(user, 'notices:publish');
    await OperationsRepository.deleteNotice(id);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'NOTICE_DELETED',
      entityType: 'notices',
      entityId: id,
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // 5. VISITORS
  // --------------------------------------------------------------------------
  static async getVisitors(
    user: SessionUser,
    params: { studentId?: string; limit?: number; offset?: number } = {}
  ): Promise<{ data: VisitorDto[]; total: number }> {
    return OperationsRepository.getVisitors(params);
  }

  static async registerVisitor(
    user: SessionUser,
    input: RegisterVisitorInput
  ): Promise<VisitorDto> {
    const student = await StudentRepository.findById(input.studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Host student '${input.studentId}' not found.`);
    }

    const created = await OperationsRepository.registerVisitor({
      ...input,
      gateOfficerId: user.id,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'VISITOR_CHECKIN',
      entityType: 'visitors',
      entityId: created.id,
      changesSummary: {
        visitorName: input.visitorName,
        studentId: input.studentId,
        purpose: input.purpose,
      },
    });

    const res = await OperationsRepository.getVisitors({ limit: 1 });
    return res.data[0];
  }

  static async checkOutVisitor(user: SessionUser, id: string): Promise<VisitorDto> {
    const updated = await OperationsRepository.checkOutVisitor(id);
    if (!updated) {
      throw new Error(`VISITOR_NOT_FOUND: Visitor record '${id}' not found.`);
    }

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'VISITOR_CHECKOUT',
      entityType: 'visitors',
      entityId: id,
    });

    const res = await OperationsRepository.getVisitors({ limit: 50 });
    return res.data.find((v) => v.id === id)!;
  }

  // --------------------------------------------------------------------------
  // 6. STAFF & WARDENS
  // --------------------------------------------------------------------------
  static async getStaff(
    user: SessionUser,
    params: { designation?: string; activeOnly?: boolean } = {}
  ): Promise<StaffDto[]> {
    return OperationsRepository.getStaff(params);
  }

  static async createStaff(
    user: SessionUser,
    input: CreateStaffInput
  ): Promise<StaffDto> {
    verifyPermission(user, 'users:manage');

    const created = await OperationsRepository.createStaff(input);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'STAFF_CREATED',
      entityType: 'staff',
      entityId: created.id,
      changesSummary: { name: input.name, designation: input.designation },
    });

    const staffList = await OperationsRepository.getStaff();
    return staffList.find((s) => s.id === created.id)!;
  }

  static async toggleStaffStatus(
    user: SessionUser,
    id: string,
    isActive: boolean
  ): Promise<boolean> {
    verifyPermission(user, 'users:manage');
    await OperationsRepository.toggleStaffStatus(id, isActive);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'STAFF_STATUS_CHANGED',
      entityType: 'staff',
      entityId: id,
      changesSummary: { isActive },
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // 7. ROOM ASSETS & INVENTORY
  // --------------------------------------------------------------------------
  static async getRoomAssets(user: SessionUser, roomId?: string): Promise<RoomAssetDto[]> {
    return OperationsRepository.getRoomAssets(roomId);
  }

  static async createRoomAsset(
    user: SessionUser,
    input: CreateRoomAssetInput
  ): Promise<RoomAssetDto> {
    verifyPermission(user, 'rooms:manage');

    const created = await OperationsRepository.createRoomAsset(input);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_ASSET_CREATED',
      entityType: 'room_assets',
      entityId: created.id,
      changesSummary: { roomId: input.roomId, assetName: input.assetName },
    });

    const assets = await OperationsRepository.getRoomAssets(input.roomId);
    return assets.find((a) => a.id === created.id)!;
  }

  static async updateRoomAsset(
    user: SessionUser,
    id: string,
    updates: { condition?: 'new' | 'good' | 'damaged' | 'condemned'; assetName?: string }
  ): Promise<RoomAssetDto> {
    verifyPermission(user, 'rooms:manage');

    const updated = await OperationsRepository.updateRoomAsset(id, updates);
    if (!updated) {
      throw new Error(`ASSET_NOT_FOUND: Room asset '${id}' not found.`);
    }

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_ASSET_UPDATED',
      entityType: 'room_assets',
      entityId: id,
      changesSummary: updates,
    });

    const assets = await OperationsRepository.getRoomAssets();
    return assets.find((a) => a.id === id)!;
  }

  static async deleteRoomAsset(user: SessionUser, id: string): Promise<boolean> {
    verifyPermission(user, 'rooms:manage');
    await OperationsRepository.deleteRoomAsset(id);
    return true;
  }

  // --------------------------------------------------------------------------
  // 8. MESS OPT-OUTS
  // --------------------------------------------------------------------------
  static async getMessOptOuts(user: SessionUser, weekendStartDate: string): Promise<MessOptOutDto[]> {
    return OperationsRepository.getMessOptOuts(weekendStartDate);
  }

  static async recordMessOptOut(
    user: SessionUser,
    studentId: string,
    weekendStartDate: string
  ): Promise<MessOptOutDto> {
    const student = await StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${studentId}' not found.`);
    }

    const created = await OperationsRepository.recordMessOptOut(studentId, weekendStartDate);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'MESS_OPTOUT_RECORDED',
      entityType: 'mess_opt_outs',
      entityId: created.id,
      changesSummary: { studentId, weekendStartDate },
    });

    const list = await OperationsRepository.getMessOptOuts(weekendStartDate);
    return list.find((m) => m.id === created.id)!;
  }

  static async cancelMessOptOut(
    user: SessionUser,
    studentId: string,
    weekendStartDate: string
  ): Promise<boolean> {
    await OperationsRepository.cancelMessOptOut(studentId, weekendStartDate);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'MESS_OPTOUT_CANCELLED',
      entityType: 'mess_opt_outs',
      changesSummary: { studentId, weekendStartDate },
    });

    return true;
  }
}
