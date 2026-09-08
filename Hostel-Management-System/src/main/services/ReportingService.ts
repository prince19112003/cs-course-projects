import { ReportingRepository } from '../database/repositories/ReportingRepository.js';
import { SessionUser } from '../../shared/types.js';
import {
  OccupancyReportDto,
  FeeDefaultersReportDto,
  AttendanceAnalyticsReportDto,
  GatePassRegisterReportDto,
  MaintenanceAnalyticsReportDto,
  DemographicsReportDto,
} from '../../shared/types.js';

function verifyPermission(user: SessionUser, requiredPermission: string) {
  const hasWildcard = user.permissions.includes('*');
  const hasSpecific = user.permissions.includes(requiredPermission);
  if (!hasWildcard && !hasSpecific) {
    throw new Error(`FORBIDDEN: User lacks required permission '${requiredPermission}'.`);
  }
}

// RFC 4180 compliant CSV string generator with CSV Formula Injection protection
export function sanitizeAndFormatCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const sanitizeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    let str = String(cell).trim();

    // Defense against CSV Formula Injection: If string starts with =, +, -, @, prepend a single quote
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }

    // Escape double quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(',');
  const rowLines = rows.map((r) => r.map(sanitizeCell).join(','));

  return [headerLine, ...rowLines].join('\r\n');
}

export class ReportingService {
  static async getOccupancyReport(user: SessionUser, hostelId?: string): Promise<OccupancyReportDto> {
    verifyPermission(user, 'rooms:view');
    return ReportingRepository.getOccupancyReport(hostelId);
  }

  static async getFeeDefaultersReport(
    user: SessionUser,
    params: { minBalance?: number; billingCycle?: string } = {}
  ): Promise<FeeDefaultersReportDto> {
    verifyPermission(user, 'students:view');
    return ReportingRepository.getFeeDefaultersReport(params);
  }

  static async getAttendanceAnalytics(
    user: SessionUser,
    params: { startDate: string; endDate: string; hostelId?: string; minAbsences?: number }
  ): Promise<AttendanceAnalyticsReportDto> {
    verifyPermission(user, 'rooms:view');
    return ReportingRepository.getAttendanceAnalytics(params);
  }

  static async getGatePassRegister(
    user: SessionUser,
    params: { startDate?: number; endDate?: number; status?: string } = {}
  ): Promise<GatePassRegisterReportDto> {
    verifyPermission(user, 'students:view');
    return ReportingRepository.getGatePassRegister(params);
  }

  static async getMaintenanceAnalytics(
    user: SessionUser,
    params: { startDate?: number; endDate?: number } = {}
  ): Promise<MaintenanceAnalyticsReportDto> {
    verifyPermission(user, 'rooms:view');
    return ReportingRepository.getMaintenanceAnalytics(params);
  }

  static async getDemographicsReport(user: SessionUser): Promise<DemographicsReportDto> {
    verifyPermission(user, 'students:view');
    return ReportingRepository.getDemographicsReport();
  }

  // Generate CSV exports for standard reports
  static async exportReportCsv(
    user: SessionUser,
    reportType: 'occupancy' | 'defaulters' | 'absentees' | 'gatepasses' | 'maintenance',
    params: any = {}
  ): Promise<string> {
    if (reportType === 'occupancy') {
      const data = await this.getOccupancyReport(user, params.hostelId);
      const headers = [
        'Hostel Name',
        'Code',
        'Gender',
        'Blocks',
        'Rooms',
        'Total Capacity',
        'Occupied Beds',
        'Vacant Beds',
        'Occupancy Rate (%)',
      ];
      const rows = data.hostels.map((h) => [
        h.hostelName,
        h.hostelCode,
        h.genderType,
        h.totalBlocks,
        h.totalRooms,
        h.totalCapacity,
        h.occupiedBeds,
        h.vacantBeds,
        h.occupancyRate,
      ]);
      return sanitizeAndFormatCsv(headers, rows);
    }

    if (reportType === 'defaulters') {
      const data = await this.getFeeDefaultersReport(user, params);
      const headers = [
        'Student Name',
        'Enrollment Number',
        'Phone',
        'Total Billed (INR)',
        'Total Paid (INR)',
        'Outstanding Balance (INR)',
        'Earliest Overdue Cycle',
      ];
      const rows = data.defaulters.map((d) => [
        d.studentName,
        d.enrollmentNumber,
        d.phone,
        d.totalInvoiced,
        d.totalPaid,
        d.balanceDue,
        d.oldestOverdueCycle || 'N/A',
      ]);
      return sanitizeAndFormatCsv(headers, rows);
    }

    if (reportType === 'absentees') {
      const data = await this.getAttendanceAnalytics(user, {
        startDate: params.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        endDate: params.endDate || new Date().toISOString().split('T')[0],
        minAbsences: params.minAbsences || 3,
      });
      const headers = [
        'Student Name',
        'Enrollment Number',
        'Total Days Recorded',
        'Absent Days',
        'Absenteeism Rate (%)',
      ];
      const rows = data.chronicAbsentees.map((a) => [
        a.studentName,
        a.enrollmentNumber,
        a.totalDaysRecorded,
        a.absentDays,
        a.absentRate,
      ]);
      return sanitizeAndFormatCsv(headers, rows);
    }

    if (reportType === 'gatepasses') {
      const data = await this.getGatePassRegister(user, params);
      const headers = [
        'Pass ID',
        'Student Name',
        'Enrollment',
        'Type',
        'Destination',
        'Departure Time',
        'Expected Return',
        'Status',
        'Overdue',
      ];
      const rows = data.passes.map((p) => [
        p.id,
        p.studentName,
        p.enrollmentNumber,
        p.passType,
        p.destination,
        new Date(p.departureTime).toLocaleString(),
        new Date(p.expectedReturnTime).toLocaleString(),
        p.status,
        p.isOverdue ? 'YES' : 'NO',
      ]);
      return sanitizeAndFormatCsv(headers, rows);
    }

    if (reportType === 'maintenance') {
      const data = await this.getMaintenanceAnalytics(user, params);
      const headers = [
        'Category',
        'Total Tickets',
        'Open Tickets',
        'Resolved Tickets',
        'Avg Resolution (Hours)',
      ];
      const rows = data.categories.map((c) => [
        c.category,
        c.totalTickets,
        c.openTickets,
        c.resolvedTickets,
        c.avgResolutionHours,
      ]);
      return sanitizeAndFormatCsv(headers, rows);
    }

    throw new Error(`INVALID_REPORT_TYPE: Unknown report type '${reportType}'.`);
  }

  // 8. Live Dashboard Operational Metrics
  static async getDashboardKpis(user: SessionUser): Promise<any> {
    if (!user || !user.id) {
      throw new Error('UNAUTHENTICATED: User session required for dashboard metrics.');
    }
    return ReportingRepository.getDashboardKpis();
  }
}
