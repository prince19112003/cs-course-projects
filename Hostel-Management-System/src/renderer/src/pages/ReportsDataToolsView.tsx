import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Building,
  DollarSign,
  UserCheck,
  Clock,
  Wrench,
  Users,
  Shield,
  FileText,
  Filter,
} from 'lucide-react';
import {
  SessionUser,
  OccupancyReportDto,
  FeeDefaultersReportDto,
  AttendanceAnalyticsReportDto,
  GatePassRegisterReportDto,
  MaintenanceAnalyticsReportDto,
  DemographicsReportDto,
  ImportPreviewResult,
  ImportPreviewRow,
  HostelDto,
  StudentDto,
  BedDto,
} from '../../shared/types';

interface ReportsDataToolsViewProps {
  token: string;
  currentUser: SessionUser;
}

type MainTab = 'reports' | 'bulk' | 'import-export';
type ReportSubTab = 'occupancy' | 'defaulters' | 'attendance' | 'gatepass' | 'maintenance' | 'demographics';

export const ReportsDataToolsView: React.FC<ReportsDataToolsViewProps> = ({ token, currentUser }) => {
  const [mainTab, setMainTab] = useState<MainTab>('reports');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('occupancy');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Common reference data
  const [hostels, setHostels] = useState<HostelDto[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<StudentDto[]>([]);
  const [vacantBeds, setVacantBeds] = useState<BedDto[]>([]);

  // Report States
  const [occupancyData, setOccupancyData] = useState<OccupancyReportDto | null>(null);
  const [defaultersData, setDefaultersData] = useState<FeeDefaultersReportDto | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceAnalyticsReportDto | null>(null);
  const [gatePassData, setGatePassData] = useState<GatePassRegisterReportDto | null>(null);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceAnalyticsReportDto | null>(null);
  const [demographicsData, setDemographicsData] = useState<DemographicsReportDto | null>(null);

  // Filters
  const [defaulterMinBalance, setDefaulterMinBalance] = useState<number>(0);
  const [attStartDate, setAttStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [attEndDate, setAttEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [attMinAbsences, setAttMinAbsences] = useState<number>(3);

  // Bulk Operations State
  const [bulkInvCycle, setBulkInvCycle] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [bulkInvDesc, setBulkInvDesc] = useState<string>('Standard Monthly Hostel Maintenance & Utility Fee');
  const [bulkInvAmount, setBulkInvAmount] = useState<number>(5000);
  const [bulkInvTarget, setBulkInvTarget] = useState<'all' | 'hostel'>('all');
  const [bulkInvHostelId, setBulkInvHostelId] = useState<string>('');

  // Bulk Bed Allocation
  const [allocAssignments, setAllocAssignments] = useState<Array<{ studentId: string; bedId: string }>>([
    { studentId: '', bedId: '' },
  ]);

  // Bulk Attendance
  const [bulkAttDate, setBulkAttDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [bulkAttHostelId, setBulkAttHostelId] = useState<string>('all');
  const [bulkAttStatus, setBulkAttStatus] = useState<'present' | 'absent'>('present');

  // CSV Import State
  const [csvContent, setCsvContent] = useState<string>('');
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  const loadReferenceData = useCallback(async () => {
    if (!window.desktopApi) return;
    try {
      const hRes = await window.desktopApi.hostels.getAll(token);
      if (hRes.success && hRes.data) {
        setHostels(hRes.data);
      }
      const sRes = await window.desktopApi.students.search(token, { status: 'active', pageSize: 500 });
      if (sRes.success && sRes.data) {
        setUnassignedStudents(sRes.data.filter((s: StudentDto) => !s.assignedBedId));
      }
      const bRes = await window.desktopApi.beds.getAll(token);
      if (bRes.success && bRes.data) {
        setVacantBeds(bRes.data.filter((b: BedDto) => b.status === 'vacant'));
      }
    } catch (err) {
      console.error('Error loading reference data:', err);
    }
  }, [token]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Load Reports
  const loadReport = useCallback(async () => {
    if (!window.desktopApi?.reports) return;
    setLoading(true);
    try {
      if (reportSubTab === 'occupancy') {
        const res = await window.desktopApi.reports.getOccupancy(token);
        if (res.success && res.data) setOccupancyData(res.data);
      } else if (reportSubTab === 'defaulters') {
        const res = await window.desktopApi.reports.getDefaulters(token, { minBalance: defaulterMinBalance });
        if (res.success && res.data) setDefaultersData(res.data);
      } else if (reportSubTab === 'attendance') {
        const res = await window.desktopApi.reports.getAttendanceAnalytics(token, {
          startDate: attStartDate,
          endDate: attEndDate,
          minAbsences: attMinAbsences,
        });
        if (res.success && res.data) setAttendanceData(res.data);
      } else if (reportSubTab === 'gatepass') {
        const res = await window.desktopApi.reports.getGatePassRegister(token);
        if (res.success && res.data) setGatePassData(res.data);
      } else if (reportSubTab === 'maintenance') {
        const res = await window.desktopApi.reports.getMaintenanceAnalytics(token);
        if (res.success && res.data) setMaintenanceData(res.data);
      } else if (reportSubTab === 'demographics') {
        const res = await window.desktopApi.reports.getDemographics(token);
        if (res.success && res.data) setDemographicsData(res.data);
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to generate institutional report');
    } finally {
      setLoading(false);
    }
  }, [token, reportSubTab, defaulterMinBalance, attStartDate, attEndDate, attMinAbsences]);

  useEffect(() => {
    if (mainTab === 'reports') {
      loadReport();
    }
  }, [mainTab, reportSubTab, loadReport]);

  const handleExportCsv = async (reportType: string) => {
    if (!window.desktopApi?.reports) return;
    try {
      const res = await window.desktopApi.reports.exportCsv(token, reportType, {
        minBalance: defaulterMinBalance,
        startDate: attStartDate,
        endDate: attEndDate,
        minAbsences: attMinAbsences,
      });
      if (res.success && res.data) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showFeedback('success', `Exported ${reportType} report to CSV successfully`);
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to export CSV');
    }
  };

  // Bulk Operations Handlers
  const handleRunBulkInvoicing = async () => {
    if (!window.desktopApi?.bulk) return;
    setLoading(true);
    try {
      const res = await window.desktopApi.bulk.createInvoices(token, {
        billingCycle: bulkInvCycle,
        description: bulkInvDesc,
        amountDue: Number(bulkInvAmount),
        target: bulkInvTarget,
        hostelId: bulkInvTarget === 'hostel' ? bulkInvHostelId : undefined,
      });
      if (res.success) {
        showFeedback(
          'success',
          `Bulk Invoicing Complete: Generated ${res.data.generatedCount} invoices (₹${res.data.totalAmountInvoiced.toLocaleString('en-IN')}), Skipped ${res.data.skippedCount} existing.`
        );
      } else {
        showFeedback('error', res.error.message || 'Bulk invoicing failed');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Bulk invoicing error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBulkAllocations = async () => {
    if (!window.desktopApi?.bulk) return;
    const validAssignments = allocAssignments.filter((a) => a.studentId && a.bedId);
    if (validAssignments.length === 0) {
      showFeedback('error', 'Please select at least one student and bed pair.');
      return;
    }
    setLoading(true);
    try {
      const res = await window.desktopApi.bulk.allocateBeds(token, { assignments: validAssignments });
      if (res.success) {
        if (res.data.failureCount > 0) {
          showFeedback('error', `Allocated ${res.data.successCount} beds. ${res.data.failureCount} failed.`);
        } else {
          showFeedback('success', `Successfully allocated all ${res.data.successCount} beds atomically!`);
          setAllocAssignments([{ studentId: '', bedId: '' }]);
          loadReferenceData();
        }
      } else {
        showFeedback('error', res.error.message || 'Bulk allocation failed');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Bulk allocation error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBulkAttendance = async () => {
    if (!window.desktopApi?.bulk) return;
    setLoading(true);
    try {
      const res = await window.desktopApi.bulk.markAttendance(token, {
        date: bulkAttDate,
        hostelId: bulkAttHostelId,
        defaultStatus: bulkAttStatus,
        markAllPresent: bulkAttStatus === 'present',
      });
      if (res.success) {
        showFeedback('success', `Bulk Attendance Recorded: ${res.data.markedCount} students marked for ${bulkAttDate}.`);
      } else {
        showFeedback('error', res.error.message || 'Bulk attendance recording error');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Bulk attendance recording error');
    } finally {
      setLoading(false);
    }
  };

  // CSV Import Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      handlePreviewCsv(text);
    };
    reader.readAsText(file);
  };

  const handlePreviewCsv = async (contentToPreview?: string) => {
    const content = contentToPreview || csvContent;
    if (!content.trim() || !window.desktopApi?.importExport) {
      showFeedback('error', 'Please paste or upload CSV content first.');
      return;
    }
    setLoading(true);
    try {
      const res = await window.desktopApi.importExport.previewStudentCsv(token, content);
      if (res.success) {
        setImportPreview(res.data);
        if (res.data.hasCollisions) {
          showFeedback('error', `Preview identified collisions or errors in ${res.data.invalidRowCount} rows.`);
        } else {
          showFeedback('success', `Pre-validation passed! All ${res.data.validRowCount} rows are ready for import.`);
        }
      } else {
        showFeedback('error', res.error.message || 'CSV validation failed');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'CSV preview error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview || !window.desktopApi?.importExport) return;
    const validRows = importPreview.previewRows.filter((r: ImportPreviewRow) => r.isValid);
    if (validRows.length === 0) {
      showFeedback('error', 'No valid rows available to import.');
      return;
    }
    setLoading(true);
    try {
      const res = await window.desktopApi.importExport.executeStudentImport(token, validRows);
      if (res.success) {
        showFeedback('success', `Import Complete: Successfully imported ${res.data.importedCount} student records!`);
        setImportPreview(null);
        setCsvContent('');
        loadReferenceData();
      } else {
        showFeedback('error', res.error.message || 'Batch import failed');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Batch import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportStudents = async () => {
    if (!window.desktopApi?.importExport) return;
    try {
      const res = await window.desktopApi.importExport.exportStudentsCsv(token, {});
      if (res.success) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showFeedback('success', 'Exported student directory with formula injection defense.');
      } else {
        showFeedback('error', res.error.message || 'Failed to export students');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to export students');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="px-8 py-5 bg-surface border-b border-border flex items-center justify-between shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Executive Intelligence & Data Operations</span>
          </div>
          <h1 className="text-xl font-bold text-textMain tracking-tight">
            Reports Hub, Bulk Automation & Data Tools
          </h1>
          <p className="text-xs text-textMuted">
            Offline institutional reporting, transactional bulk operations, and RFC 4180 CSV portability with formula sanitization.
          </p>
        </div>

        {/* Global Action Feedback */}
        {statusMessage && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </header>

      {/* Primary Navigation Tabs */}
      <div className="px-8 pt-4 bg-surface border-b border-border flex items-center gap-6 shrink-0">
        <button
          onClick={() => setMainTab('reports')}
          className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 ${
            mainTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-textMuted hover:text-textMain'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Institutional Reports</span>
        </button>

        <button
          onClick={() => setMainTab('bulk')}
          className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 ${
            mainTab === 'bulk'
              ? 'border-primary text-primary'
              : 'border-transparent text-textMuted hover:text-textMain'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bulk Operations Engine</span>
        </button>

        <button
          onClick={() => setMainTab('import-export')}
          className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 ${
            mainTab === 'import-export'
              ? 'border-primary text-primary'
              : 'border-transparent text-textMuted hover:text-textMain'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>CSV Data Tools & Portability</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* TAB 1: REPORTS */}
        {mainTab === 'reports' && (
          <div className="space-y-6">
            {/* Sub Tabs */}
            <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1 overflow-x-auto">
                {[
                  { id: 'occupancy', label: 'Occupancy & Capacity', icon: Building },
                  { id: 'defaulters', label: 'Fee Defaulters', icon: DollarSign },
                  { id: 'attendance', label: 'Attendance & Absenteeism', icon: UserCheck },
                  { id: 'gatepass', label: 'Gate Pass Register', icon: Clock },
                  { id: 'maintenance', label: 'Maintenance SLA', icon: Wrench },
                  { id: 'demographics', label: 'Resident Demographics', icon: Users },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = reportSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setReportSubTab(tab.id as ReportSubTab)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pr-2">
                <button
                  onClick={loadReport}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => handleExportCsv(reportSubTab)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* OCCUPANCY REPORT */}
            {reportSubTab === 'occupancy' && occupancyData && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Campus Total Capacity</p>
                    <h3 className="text-2xl font-black text-slate-800">{occupancyData.campusTotalCapacity} Beds</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Across all registered hostels</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Occupied Beds</p>
                    <h3 className="text-2xl font-black text-emerald-700">{occupancyData.campusOccupiedBeds} Beds</h3>
                    <p className="text-[11px] text-emerald-600/80 mt-1">Active resident allocations</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Vacant Beds</p>
                    <h3 className="text-2xl font-black text-blue-700">{occupancyData.campusVacantBeds} Beds</h3>
                    <p className="text-[11px] text-blue-600/80 mt-1">Ready for fresh allocation</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Campus Occupancy Rate</p>
                    <h3 className="text-2xl font-black text-purple-700">{occupancyData.campusOccupancyRate}%</h3>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${occupancyData.campusOccupancyRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Hostel Details Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">Hostel-by-Hostel Occupancy Matrix</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">Hostel Name</th>
                          <th className="px-6 py-3">Code</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3">Blocks</th>
                          <th className="px-6 py-3">Rooms</th>
                          <th className="px-6 py-3">Total Beds</th>
                          <th className="px-6 py-3">Occupied</th>
                          <th className="px-6 py-3">Vacant</th>
                          <th className="px-6 py-3">Occupancy Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {occupancyData.hostels.map((h: any) => (
                          <tr key={h.hostelId} className="hover:bg-slate-50/75 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-slate-900">{h.hostelName}</td>
                            <td className="px-6 py-3.5 font-mono text-slate-600">{h.hostelCode}</td>
                            <td className="px-6 py-3.5 uppercase font-semibold text-slate-600">{h.genderType}</td>
                            <td className="px-6 py-3.5">{h.totalBlocks}</td>
                            <td className="px-6 py-3.5">{h.totalRooms}</td>
                            <td className="px-6 py-3.5 font-semibold">{h.totalCapacity}</td>
                            <td className="px-6 py-3.5 text-emerald-600 font-bold">{h.occupiedBeds}</td>
                            <td className="px-6 py-3.5 text-blue-600 font-bold">{h.vacantBeds}</td>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700">{h.occupancyRate}%</span>
                                <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-blue-600 h-1.5 rounded-full"
                                    style={{ width: `${h.occupancyRate}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* FEE DEFAULTERS REPORT */}
            {reportSubTab === 'defaulters' && (
              <div className="space-y-6">
                {/* Filter Toolbar */}
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">Minimum Balance Due:</span>
                    <input
                      type="number"
                      value={defaulterMinBalance}
                      onChange={(e) => setDefaulterMinBalance(Number(e.target.value))}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-blue-500"
                      placeholder="e.g. 1000"
                    />
                  </div>
                  <button
                    onClick={loadReport}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-xl"
                  >
                    Apply Filter
                  </button>
                  {defaultersData && (
                    <div className="ml-auto text-xs font-medium text-slate-500">
                      Total Outstanding Institutional Dues:{' '}
                      <span className="font-black text-rose-600 text-sm">
                        ₹{defaultersData.totalOutstandingAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Defaulters Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">
                      Unsettled Resident Fee Balances ({defaultersData?.totalDefaulters || 0} residents)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">Student Name</th>
                          <th className="px-6 py-3">Enrollment</th>
                          <th className="px-6 py-3">Phone</th>
                          <th className="px-6 py-3">Hostel / Room</th>
                          <th className="px-6 py-3">Invoiced</th>
                          <th className="px-6 py-3">Paid</th>
                          <th className="px-6 py-3">Balance Due</th>
                          <th className="px-6 py-3">Oldest Cycle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {defaultersData?.defaulters.map((d: any) => (
                          <tr key={d.studentId} className="hover:bg-slate-50/75 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-slate-900">{d.studentName}</td>
                            <td className="px-6 py-3.5 font-mono text-slate-600">{d.enrollmentNumber}</td>
                            <td className="px-6 py-3.5 font-mono text-slate-600">{d.phone}</td>
                            <td className="px-6 py-3.5 text-slate-600">
                              {d.hostelName ? `${d.hostelName} (${d.roomNumber || '—'})` : 'Unassigned'}
                            </td>
                            <td className="px-6 py-3.5 text-slate-700">₹{d.totalInvoiced.toLocaleString('en-IN')}</td>
                            <td className="px-6 py-3.5 text-emerald-600 font-semibold">
                              ₹{d.totalPaid.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-3.5 text-rose-600 font-black">
                              ₹{d.balanceDue.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-3.5 font-mono text-slate-500">{d.oldestOverdueCycle || '—'}</td>
                          </tr>
                        ))}
                        {(!defaultersData || defaultersData.defaulters.length === 0) && (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                              No fee defaulters matching this criteria. Institutional records are up to date!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ATTENDANCE ANALYTICS REPORT */}
            {reportSubTab === 'attendance' && (
              <div className="space-y-6">
                {/* Date and Absences Filter */}
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">From:</span>
                    <input
                      type="date"
                      value={attStartDate}
                      onChange={(e) => setAttStartDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">To:</span>
                    <input
                      type="date"
                      value={attEndDate}
                      onChange={(e) => setAttEndDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">Min Absences:</span>
                    <input
                      type="number"
                      value={attMinAbsences}
                      onChange={(e) => setAttMinAbsences(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>
                  <button
                    onClick={loadReport}
                    className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-xl"
                  >
                    Analyze
                  </button>
                </div>

                {attendanceData && (
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Marks Recorded</p>
                        <h3 className="text-2xl font-black text-slate-800">{attendanceData.totalDaysRecorded}</h3>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200">
                        <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Present Marks</p>
                        <h3 className="text-2xl font-black text-emerald-700">{attendanceData.totalPresentMarks}</h3>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200">
                        <p className="text-xs font-bold text-rose-600 uppercase mb-1">Absent Marks</p>
                        <h3 className="text-2xl font-black text-rose-700">{attendanceData.totalAbsentMarks}</h3>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200">
                        <p className="text-xs font-bold text-amber-600 uppercase mb-1">Overall Present %</p>
                        <h3 className="text-2xl font-black text-amber-700">{attendanceData.campusPresentRate}%</h3>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Chronic Absenteeism Register ({attendanceData.chronicAbsentees.length} flagged)
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-3">Student Name</th>
                              <th className="px-6 py-3">Enrollment</th>
                              <th className="px-6 py-3">Hostel</th>
                              <th className="px-6 py-3">Room</th>
                              <th className="px-6 py-3">Total Days</th>
                              <th className="px-6 py-3">Days Absent</th>
                              <th className="px-6 py-3">Absenteeism Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {attendanceData.chronicAbsentees.map((c: any) => (
                              <tr key={c.studentId} className="hover:bg-rose-50/40 transition-colors">
                                <td className="px-6 py-3.5 font-bold text-slate-900">{c.studentName}</td>
                                <td className="px-6 py-3.5 font-mono text-slate-600">{c.enrollmentNumber}</td>
                                <td className="px-6 py-3.5 text-slate-600">{c.hostelName || '—'}</td>
                                <td className="px-6 py-3.5 text-slate-600">{c.roomNumber || '—'}</td>
                                <td className="px-6 py-3.5">{c.totalDaysRecorded}</td>
                                <td className="px-6 py-3.5 font-bold text-rose-600">{c.absentDays} days</td>
                                <td className="px-6 py-3.5">
                                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-100 text-rose-800">
                                    {c.absentRate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {attendanceData.chronicAbsentees.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-slate-400 font-medium">
                                  No chronic absentees identified for this range.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* GATE PASS REGISTER */}
            {reportSubTab === 'gatepass' && gatePassData && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Passes</p>
                    <h3 className="text-2xl font-black text-slate-800">{gatePassData.totalPasses}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Active Outside Campus</p>
                    <h3 className="text-2xl font-black text-blue-700">{gatePassData.activeOutCount}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Safely Returned</p>
                    <h3 className="text-2xl font-black text-emerald-700">{gatePassData.returnedCount}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-rose-600 uppercase mb-1">Overdue Returns</p>
                    <h3 className="text-2xl font-black text-rose-700">{gatePassData.overdueCount}</h3>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">Movement Register & Curfew Monitor</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">Pass ID</th>
                          <th className="px-6 py-3">Student Name</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3">Destination</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Curfew Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gatePassData.passes.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                            <td className="px-6 py-3.5 font-mono text-slate-600">{p.id}</td>
                            <td className="px-6 py-3.5 font-bold text-slate-900">{p.studentName}</td>
                            <td className="px-6 py-3.5 uppercase font-semibold text-slate-600">{p.passType}</td>
                            <td className="px-6 py-3.5 text-slate-600">{p.destination}</td>
                            <td className="px-6 py-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  p.status === 'returned'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'active_out'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              {p.isOverdue ? (
                                <span className="px-2 py-0.5 rounded-full font-black text-[10px] bg-rose-100 text-rose-700 animate-pulse">
                                  OVERDUE RETURN
                                </span>
                              ) : (
                                <span className="text-slate-400">Within window</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MAINTENANCE SLA REPORT */}
            {reportSubTab === 'maintenance' && maintenanceData && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Maintenance Tickets</p>
                    <h3 className="text-2xl font-black text-slate-800">{maintenanceData.totalTickets}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Resolved Tickets</p>
                    <h3 className="text-2xl font-black text-emerald-700">{maintenanceData.resolvedTickets}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">Open / In-Progress Tickets</p>
                    <h3 className="text-2xl font-black text-amber-700">{maintenanceData.openTickets}</h3>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">Category Turnaround Time & SLA Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">Category</th>
                          <th className="px-6 py-3">Tickets Raised</th>
                          <th className="px-6 py-3">Resolved</th>
                          <th className="px-6 py-3">Open</th>
                          <th className="px-6 py-3">Average Turnaround Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {maintenanceData.categories.map((c: any) => (
                          <tr key={c.category} className="hover:bg-slate-50/75 transition-colors">
                            <td className="px-6 py-3.5 font-bold uppercase text-slate-900">{c.category}</td>
                            <td className="px-6 py-3.5">{c.count}</td>
                            <td className="px-6 py-3.5 text-emerald-600 font-semibold">{c.resolved}</td>
                            <td className="px-6 py-3.5 text-amber-600 font-semibold">{c.open}</td>
                            <td className="px-6 py-3.5 font-bold text-blue-600">
                              {c.avgResolutionHours > 0 ? `${c.avgResolutionHours} hrs` : 'Immediate / N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* DEMOGRAPHICS REPORT */}
            {reportSubTab === 'demographics' && demographicsData && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Total Resident Cohort: {demographicsData.totalResidents}</h3>
                  <div className="grid grid-cols-3 gap-6">
                    {/* By Gender */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">By Gender</h4>
                      <div className="space-y-2">
                        {Object.entries(demographicsData.byGender).map(([g, count]) => (
                          <div key={g} className="flex justify-between text-xs font-medium">
                            <span className="capitalize text-slate-700">{g}</span>
                            <span className="font-bold text-slate-900">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* By Course */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">By Course</h4>
                      <div className="space-y-2">
                        {Object.entries(demographicsData.byCourse).map(([c, count]) => (
                          <div key={c} className="flex justify-between text-xs font-medium">
                            <span className="text-slate-700">{c}</span>
                            <span className="font-bold text-slate-900">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* By Department */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">By Department</h4>
                      <div className="space-y-2">
                        {Object.entries(demographicsData.byDepartment).map(([d, count]) => (
                          <div key={d} className="flex justify-between text-xs font-medium">
                            <span className="text-slate-700">{d}</span>
                            <span className="font-bold text-slate-900">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BULK OPERATIONS */}
        {mainTab === 'bulk' && (
          <div className="grid grid-cols-3 gap-8">
            {/* 1. Bulk Fee Invoicing */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Batch Fee Invoicing</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Monthly Billing Run</h3>
                <p className="text-xs text-slate-500 mb-5">
                  Generate invoices in a single atomic transaction. Automatically skips students who already have an invoice for this cycle.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Billing Cycle (YYYY-MM)</label>
                    <input
                      type="text"
                      value={bulkInvCycle}
                      onChange={(e) => setBulkInvCycle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-semibold"
                      placeholder="2026-11"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Fee Description</label>
                    <input
                      type="text"
                      value={bulkInvDesc}
                      onChange={(e) => setBulkInvDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Amount Due per Resident (₹)</label>
                    <input
                      type="number"
                      value={bulkInvAmount}
                      onChange={(e) => setBulkInvAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Group</label>
                    <select
                      value={bulkInvTarget}
                      onChange={(e) => setBulkInvTarget(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    >
                      <option value="all">All Active Residents</option>
                      <option value="hostel">Specific Hostel Residents</option>
                    </select>
                  </div>

                  {bulkInvTarget === 'hostel' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Select Hostel</label>
                      <select
                        value={bulkInvHostelId}
                        onChange={(e) => setBulkInvHostelId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                      >
                        <option value="">Choose Hostel...</option>
                        {hostels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleRunBulkInvoicing}
                disabled={loading}
                className="w-full mt-6 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-sm transition-all"
              >
                Execute Billing Run
              </button>
            </div>

            {/* 2. Bulk Bed Allocation */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase mb-2">
                  <Building className="w-4 h-4" />
                  <span>Batch Bed Allocations</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Multi-Resident Bed Assign</h3>
                <p className="text-xs text-slate-500 mb-5">
                  Pair admitted unassigned students with vacant beds. Atomic execution with conflict checks.
                </p>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {allocAssignments.map((assign, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Resident</label>
                        <select
                          value={assign.studentId}
                          onChange={(e) => {
                            const copy = [...allocAssignments];
                            copy[index].studentId = e.target.value;
                            setAllocAssignments(copy);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                        >
                          <option value="">Select Resident...</option>
                          {unassignedStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName} ({s.enrollmentNumber})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Vacant Bed</label>
                        <select
                          value={assign.bedId}
                          onChange={(e) => {
                            const copy = [...allocAssignments];
                            copy[index].bedId = e.target.value;
                            setAllocAssignments(copy);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                        >
                          <option value="">Select Bed...</option>
                          {vacantBeds.map((b) => (
                            <option key={b.id} value={b.id}>
                              Bed {b.bedLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setAllocAssignments([...allocAssignments, { studentId: '', bedId: '' }])}
                  className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  + Add Another Assignment Row
                </button>
              </div>

              <button
                onClick={handleRunBulkAllocations}
                disabled={loading}
                className="w-full mt-6 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-sm transition-all"
              >
                Execute Bulk Bed Allocation
              </button>
            </div>

            {/* 3. Bulk Attendance Register */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase mb-2">
                  <UserCheck className="w-4 h-4" />
                  <span>Bulk Roll Call</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Hostel Attendance Fast-Track</h3>
                <p className="text-xs text-slate-500 mb-5">
                  Record daily roll call for an entire hostel or campus in a single action.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Attendance Date</label>
                    <input
                      type="date"
                      value={bulkAttDate}
                      onChange={(e) => setBulkAttDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hostel</label>
                    <select
                      value={bulkAttHostelId}
                      onChange={(e) => setBulkAttHostelId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    >
                      <option value="all">All Hostels (Campus-wide)</option>
                      {hostels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Default Status for Allocated Residents</label>
                    <select
                      value={bulkAttStatus}
                      onChange={(e) => setBulkAttStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    >
                      <option value="present">Present (Mark All Present)</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRunBulkAttendance}
                disabled={loading}
                className="w-full mt-6 py-2.5 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700 shadow-sm transition-all"
              >
                Record Bulk Attendance
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: CSV IMPORT & EXPORT */}
        {mainTab === 'import-export' && (
          <div className="space-y-8">
            {/* Quick Export Panel */}
            <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Record Portability</h3>
                <p className="text-xs text-slate-500">
                  Export institutional resident records to clean RFC 4180 CSV with automatic spreadsheet formula injection protection.
                </p>
              </div>
              <button
                onClick={handleExportStudents}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export All Students to CSV</span>
              </button>
            </div>

            {/* CSV Import Studio */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase mb-1">
                  <Upload className="w-4 h-4" />
                  <span>Batch Student Onboarding</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">Upload or Paste Student CSV</h3>
                <p className="text-xs text-slate-500">
                  Required columns: <code className="font-bold text-slate-700">Enrollment Number</code>,{' '}
                  <code className="font-bold text-slate-700">First Name</code>,{' '}
                  <code className="font-bold text-slate-700">Last Name</code>,{' '}
                  <code className="font-bold text-slate-700">Email</code>,{' '}
                  <code className="font-bold text-slate-700">Phone</code>.
                </p>
              </div>

              <div className="flex gap-4">
                <label className="flex-1 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-700 block">Click to select .csv file</span>
                  <span className="text-[11px] text-slate-400">RFC 4180 standard compliant</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>

                <div className="flex-1 flex flex-col">
                  <textarea
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder="Or paste raw CSV text here..."
                    className="w-full h-32 p-3 text-xs font-mono border border-slate-200 rounded-xl focus:outline-blue-500 resize-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => handlePreviewCsv()}
                      disabled={loading || !csvContent.trim()}
                      className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                    >
                      Pre-Validate CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Pre-Validation Table */}
              {importPreview && (
                <div className="mt-6 space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Pre-Import Collision & Schema Validation</h4>
                      <p className="text-xs text-slate-500">
                        {importPreview.validRowCount} valid of {importPreview.totalRows} rows.
                        {importPreview.hasCollisions && ' Duplicate collisions detected!'}
                      </p>
                    </div>

                    <button
                      onClick={handleExecuteImport}
                      disabled={importPreview.validRowCount === 0 || loading}
                      className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                    >
                      Commit Import ({importPreview.validRowCount} Records)
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Row #</th>
                          <th className="px-4 py-2.5">Enrollment</th>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Email</th>
                          <th className="px-4 py-2.5">Phone</th>
                          <th className="px-4 py-2.5">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.previewRows.map((r: ImportPreviewRow) => (
                          <tr
                            key={r.rowNumber}
                            className={r.isValid ? 'bg-white' : 'bg-rose-50/50'}
                          >
                            <td className="px-4 py-2 font-mono text-slate-500">{r.rowNumber}</td>
                            <td className="px-4 py-2 font-mono font-bold text-slate-800">{r.enrollmentNumber}</td>
                            <td className="px-4 py-2 font-medium">
                              {r.firstName} {r.lastName}
                            </td>
                            <td className="px-4 py-2 font-mono text-slate-600">{r.email}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{r.phone}</td>
                            <td className="px-4 py-2">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                                </span>
                              ) : (
                                <div className="text-rose-700 font-semibold text-[11px]">
                                  {r.errors.join('; ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
