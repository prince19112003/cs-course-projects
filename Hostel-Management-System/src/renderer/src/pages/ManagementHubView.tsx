import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Ticket,
  DollarSign,
  Wrench,
  Bell,
  UserCheck,
  Shield,
  Package,
  Utensils,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  SessionUser,
  AttendanceDto,
  AttendanceSummaryDto,
  GatePassDto,
  InvoiceDto,
  PaymentDto,
  ComplaintDto,
  NoticeDto,
  VisitorDto,
  StaffDto,
  RoomAssetDto,
  MessOptOutDto,
  HostelDto,
  StudentDto,
  RoomDto,
} from '../../shared/types';

interface ManagementHubViewProps {
  token: string;
  currentUser: SessionUser;
}

type HubTab =
  | 'attendance'
  | 'gatepasses'
  | 'billing'
  | 'complaints'
  | 'notices'
  | 'visitors'
  | 'staff'
  | 'assets'
  | 'mess';

export const ManagementHubView: React.FC<ManagementHubViewProps> = ({ token, currentUser }) => {
  const [activeTab, setActiveTab] = useState<HubTab>('attendance');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Common reference data
  const [hostels, setHostels] = useState<HostelDto[]>([]);
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);

  // 1. Attendance State
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceHostelId, setAttendanceHostelId] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceDto[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryDto | null>(null);
  const [attendanceEdits, setAttendanceEdits] = useState<Record<string, 'present' | 'absent' | 'late' | 'approved_leave'>>({});

  // 2. Gate Passes State
  const [gatePasses, setGatePasses] = useState<GatePassDto[]>([]);
  const [gatePassFilter, setGatePassFilter] = useState<string>('all');
  const [showCreateGatePass, setShowCreateGatePass] = useState(false);
  const [gpStudentId, setGpStudentId] = useState('');
  const [gpType, setGpType] = useState<'day_out' | 'night_out' | 'vacation' | 'emergency'>('day_out');
  const [gpReason, setGpReason] = useState('');
  const [gpDestination, setGpDestination] = useState('');
  const [gpDepartureTime, setGpDepartureTime] = useState('');
  const [gpReturnTime, setGpReturnTime] = useState('');

  // 3. Billing & Invoices State
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);
  const [invStudentId, setInvStudentId] = useState('');
  const [invBillingCycle, setInvBillingCycle] = useState(() => new Date().toISOString().slice(0, 7));
  const [invDescription, setInvDescription] = useState('Hostel Accommodation & Maintenance Fee');
  const [invAmountDue, setInvAmountDue] = useState(15000);
  const [invDueDate, setInvDueDate] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<'cash' | 'bank_transfer' | 'cheque' | 'pos_card'>('cash');
  const [payRef, setPayRef] = useState('');
  const [latestReceipt, setLatestReceipt] = useState<PaymentDto | null>(null);

  // 4. Complaints State
  const [complaints, setComplaints] = useState<ComplaintDto[]>([]);
  const [showCreateComplaint, setShowCreateComplaint] = useState(false);
  const [cmpStudentId, setCmpStudentId] = useState('');
  const [cmpRoomId, setCmpRoomId] = useState('');
  const [cmpCategory, setCmpCategory] = useState<'electrical' | 'plumbing' | 'carpentry' | 'masonry' | 'cleaning' | 'other'>('electrical');
  const [cmpSubject, setCmpSubject] = useState('');
  const [cmpDescription, setCmpDescription] = useState('');
  const [cmpPriority, setCmpPriority] = useState<'low' | 'medium' | 'urgent'>('medium');

  // 5. Notices State
  const [notices, setNotices] = useState<NoticeDto[]>([]);
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<'all' | 'boys_only' | 'girls_only' | 'block_specific'>('all');
  const [noticePriority, setNoticePriority] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [noticePinned, setNoticePinned] = useState(false);

  // 6. Visitors State
  const [visitors, setVisitors] = useState<VisitorDto[]>([]);
  const [showRegisterVisitor, setShowRegisterVisitor] = useState(false);
  const [visName, setVisName] = useState('');
  const [visPhone, setVisPhone] = useState('');
  const [visRelation, setVisRelation] = useState('');
  const [visStudentId, setVisStudentId] = useState('');
  const [visIdProof, setVisIdProof] = useState('');
  const [visPurpose, setVisPurpose] = useState('');

  // 7. Staff State
  const [staffList, setStaffList] = useState<StaffDto[]>([]);
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDesignation, setStaffDesignation] = useState<'chief_warden' | 'warden' | 'security' | 'maintenance' | 'caretaker'>('warden');

  // 8. Assets State
  const [assets, setAssets] = useState<RoomAssetDto[]>([]);
  const [assetRoomId, setAssetRoomId] = useState<string>('');
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [newAssetRoomId, setNewAssetRoomId] = useState('');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetSerial, setNewAssetSerial] = useState('');
  const [newAssetCondition, setNewAssetCondition] = useState<'new' | 'good' | 'damaged' | 'condemned'>('good');

  // 9. Mess State
  const [messWeekendDate, setMessWeekendDate] = useState(() => {
    const d = new Date();
    // Default to coming Saturday
    const day = d.getDay();
    const diff = d.getDate() + (6 - day + 7) % 7;
    const sat = new Date(d.setDate(diff));
    return sat.toISOString().split('T')[0];
  });
  const [messOptOuts, setMessOptOuts] = useState<MessOptOutDto[]>([]);
  const [messStudentId, setMessStudentId] = useState('');

  // Load Reference Data (hostels, active students, rooms)
  useEffect(() => {
    const loadRefs = async () => {
      try {
        if (!window.desktopApi) return;
        const [hRes, sRes, rRes] = await Promise.all([
          window.desktopApi.hostels.list(token, false),
          window.desktopApi.students.list(token, { pageSize: 200, status: 'active' }),
          window.desktopApi.rooms.list(token, { limit: 100 }),
        ]);
        if (hRes.success && hRes.data) setHostels(hRes.data);
        if (sRes.success && sRes.data) setStudents(sRes.data.data);
        if (rRes.success && rRes.data) setRooms(rRes.data.data);
      } catch (err) {
        console.error('Failed to load references:', err);
      }
    };
    loadRefs();
  }, [token]);

  // Load Tab Data
  const loadTabData = useCallback(async () => {
    if (!window.desktopApi) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'attendance') {
        const [listRes, sumRes] = await Promise.all([
          window.desktopApi.operations.attendance.getByDate(token, {
            date: attendanceDate,
            hostelId: attendanceHostelId || undefined,
          }),
          window.desktopApi.operations.attendance.getSummary(
            token,
            attendanceDate,
            attendanceHostelId || undefined
          ),
        ]);
        if (listRes.success && listRes.data) {
          setAttendanceRecords(listRes.data);
          const initialEdits: Record<string, 'present' | 'absent' | 'late' | 'approved_leave'> = {};
          listRes.data.forEach((r) => {
            initialEdits[r.studentId] = r.status;
          });
          setAttendanceEdits(initialEdits);
        }
        if (sumRes.success && sumRes.data) setAttendanceSummary(sumRes.data);
      } else if (activeTab === 'gatepasses') {
        const res = await window.desktopApi.operations.gatePasses.list(token, {
          status: gatePassFilter !== 'all' ? gatePassFilter : undefined,
          pageSize: 50,
        });
        if (res.success && res.data) setGatePasses(res.data.data);
      } else if (activeTab === 'billing') {
        const [invRes, payRes] = await Promise.all([
          window.desktopApi.billing.invoices.list(token, { pageSize: 50 }),
          window.desktopApi.billing.payments.list(token),
        ]);
        if (invRes.success && invRes.data) setInvoices(invRes.data.data);
        if (payRes.success && payRes.data) setPayments(payRes.data);
      } else if (activeTab === 'complaints') {
        const res = await window.desktopApi.operations.complaints.list(token, { pageSize: 50 });
        if (res.success && res.data) setComplaints(res.data.data);
      } else if (activeTab === 'notices') {
        const res = await window.desktopApi.operations.notices.list(token, { pageSize: 50 });
        if (res.success && res.data) setNotices(res.data.data);
      } else if (activeTab === 'visitors') {
        const res = await window.desktopApi.operations.visitors.list(token, { pageSize: 50 });
        if (res.success && res.data) setVisitors(res.data.data);
      } else if (activeTab === 'staff') {
        const res = await window.desktopApi.operations.staff.list(token, {});
        if (res.success && res.data) setStaffList(res.data.data);
      } else if (activeTab === 'assets') {
        const res = await window.desktopApi.operations.assets.list(
          token,
          assetRoomId || undefined
        );
        if (res.success && res.data) setAssets(res.data);
      } else if (activeTab === 'mess') {
        const res = await window.desktopApi.operations.mess.getOptOuts(token, messWeekendDate);
        if (res.success && res.data) setMessOptOuts(res.data);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    attendanceDate,
    attendanceHostelId,
    gatePassFilter,
    assetRoomId,
    messWeekendDate,
    token,
  ]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Flash message helper
  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // --- Handlers ---
  // Attendance
  const handleSaveAttendance = async () => {
    if (!window.desktopApi) return;
    setLoading(true);
    try {
      const items = Object.entries(attendanceEdits).map(([studentId, status]) => ({
        studentId,
        status,
      }));
      const res = await window.desktopApi.operations.attendance.mark(token, attendanceDate, items);
      if (res.success) {
        notifySuccess(`Recorded attendance for ${res.data?.markedCount ?? items.length} students.`);
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to record attendance');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, 'present' | 'absent' | 'late' | 'approved_leave'> = {};
    attendanceRecords.forEach((r) => {
      // Retain approved_leave if already on leave
      updated[r.studentId] = r.status === 'approved_leave' ? 'approved_leave' : 'present';
    });
    setAttendanceEdits(updated);
  };

  // Gate Passes
  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const depEpoch = new Date(gpDepartureTime).getTime();
      const retEpoch = new Date(gpReturnTime).getTime();
      const res = await window.desktopApi.operations.gatePasses.create(token, {
        studentId: gpStudentId,
        passType: gpType,
        reason: gpReason,
        destination: gpDestination,
        departureTime: depEpoch,
        expectedReturnTime: retEpoch,
      });
      if (res.success) {
        setShowCreateGatePass(false);
        setGpReason('');
        setGpDestination('');
        notifySuccess('Gate Pass submitted for review.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Creation failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleReviewGatePass = async (id: string, status: 'approved' | 'rejected') => {
    if (!window.desktopApi) return;
    const notes = prompt(`Enter optional review notes for ${status}:`) ?? undefined;
    try {
      const res = await window.desktopApi.operations.gatePasses.review(token, id, status, notes);
      if (res.success) {
        notifySuccess(`Gate pass marked ${status}.`);
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Review failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleGatePassMovement = async (id: string, movement: 'exit' | 'return') => {
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.gatePasses.logMovement(token, id, movement);
      if (res.success) {
        notifySuccess(`Security movement logged: ${movement.toUpperCase()}`);
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Movement logging failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Billing
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const dueEpoch = invDueDate ? new Date(invDueDate).getTime() : Date.now() + 15 * 86400000;
      const res = await window.desktopApi.billing.invoices.create(token, {
        studentId: invStudentId,
        billingCycle: invBillingCycle,
        description: invDescription,
        amountDue: Number(invAmountDue),
        dueDate: dueEpoch,
      });
      if (res.success) {
        setShowCreateInvoice(false);
        notifySuccess('Fee invoice raised successfully.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Invoice creation failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi || !selectedInvoice) return;
    try {
      const res = await window.desktopApi.billing.payments.record(token, {
        invoiceId: selectedInvoice.id,
        amount: Number(payAmount),
        paymentMode: payMode,
        referenceNumber: payRef || undefined,
      });
      if (res.success && res.data) {
        setLatestReceipt(res.data);
        setShowRecordPayment(false);
        notifySuccess(`Payment collected! Receipt: ${res.data.receiptNumber}`);
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Payment recording failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleWaiveInvoice = async (invoiceId: string) => {
    if (!window.desktopApi) return;
    const reason = prompt('Enter official waiver rationale:');
    if (!reason) return;
    try {
      const res = await window.desktopApi.billing.invoices.waive(token, invoiceId, reason);
      if (res.success) {
        notifySuccess('Invoice waived/cancelled.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Waiver failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Complaints
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.complaints.create(token, {
        studentId: cmpStudentId,
        roomId: cmpRoomId,
        category: cmpCategory,
        subject: cmpSubject,
        description: cmpDescription,
        priority: cmpPriority,
      });
      if (res.success) {
        setShowCreateComplaint(false);
        setCmpSubject('');
        setCmpDescription('');
        notifySuccess('Complaint ticket logged.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to log complaint');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleResolveComplaint = async (id: string, status: 'in_progress' | 'resolved' | 'rejected') => {
    if (!window.desktopApi) return;
    const notes = prompt(`Resolution notes for status "${status}":`) || undefined;
    try {
      const res = await window.desktopApi.operations.complaints.resolve(token, id, status, undefined, notes);
      if (res.success) {
        notifySuccess(`Complaint status updated to ${status}.`);
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Update failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Notices
  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.notices.create(token, {
        title: noticeTitle,
        content: noticeContent,
        targetAudience: noticeAudience,
        priority: noticePriority,
        isPinned: noticePinned,
      });
      if (res.success) {
        setShowCreateNotice(false);
        setNoticeTitle('');
        setNoticeContent('');
        notifySuccess('Notice posted to institutional bulletin.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to post notice');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Are you sure you want to remove this announcement?')) return;
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.notices.delete(token, id);
      if (res.success) {
        notifySuccess('Notice removed.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Delete failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Visitors
  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.visitors.register(token, {
        visitorName: visName,
        phone: visPhone,
        relationship: visRelation,
        studentId: visStudentId,
        idProofDetails: visIdProof,
        purpose: visPurpose,
      });
      if (res.success) {
        setShowRegisterVisitor(false);
        setVisName('');
        setVisPhone('');
        setVisIdProof('');
        setVisPurpose('');
        notifySuccess('Visitor logged and permitted on campus.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Visitor registration failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleCheckOutVisitor = async (id: string) => {
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.visitors.checkOut(token, id);
      if (res.success) {
        notifySuccess('Visitor check-out logged.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Check out failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.staff.create(token, {
        name: staffName,
        phone: staffPhone,
        email: staffEmail || undefined,
        designation: staffDesignation,
      });
      if (res.success) {
        setShowCreateStaff(false);
        setStaffName('');
        setStaffPhone('');
        setStaffEmail('');
        notifySuccess('Staff personnel added to official roster.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to add staff');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleToggleStaffStatus = async (id: string, current: number) => {
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.staff.toggleStatus(token, id, current !== 1);
      if (res.success) {
        notifySuccess('Staff active status updated.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to toggle staff status');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Room Assets
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.assets.create(token, {
        roomId: newAssetRoomId,
        assetName: newAssetName,
        serialNumber: newAssetSerial || undefined,
        condition: newAssetCondition,
      });
      if (res.success) {
        setShowCreateAsset(false);
        setNewAssetName('');
        setNewAssetSerial('');
        notifySuccess('Asset cataloged to room inventory.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Asset creation failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Condemn and remove this room asset?')) return;
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.assets.delete(token, id);
      if (res.success) {
        notifySuccess('Asset removed from inventory.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Asset deletion failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Mess Opt-Outs
  const handleRecordMessOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.desktopApi || !messStudentId) return;
    try {
      const res = await window.desktopApi.operations.mess.recordOptOut(token, messStudentId, messWeekendDate);
      if (res.success) {
        setMessStudentId('');
        notifySuccess('Weekend dining opt-out recorded.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Opt-out recording failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleCancelMessOptOut = async (studentId: string) => {
    if (!window.desktopApi) return;
    try {
      const res = await window.desktopApi.operations.mess.cancelOptOut(token, studentId, messWeekendDate);
      if (res.success) {
        notifySuccess('Dining opt-out cancelled; student restored to meal count.');
        loadTabData();
      } else {
        setErrorMsg(res.error?.message || 'Cancellation failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-20 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 tracking-wide uppercase">
              Campus Operations Desk
            </span>
            <span className="text-xs text-textMuted font-mono">Operator: {currentUser.username}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain mt-1">
            Hostel Operations & Management Hub
          </h1>
          <p className="text-sm text-textMuted">
            Roll call, digital gate passes, ledger fees, tickets, bulletins, visitors, staff roster, assets & mess opt-outs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadTabData()}
            className="px-3 py-1.5 rounded-lg border border-border bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto font-bold text-red-500 hover:text-red-800">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
        {[
          { id: 'attendance', label: 'Roll Call Attendance', icon: CheckSquare },
          { id: 'gatepasses', label: 'Gate Passes / Leaves', icon: Ticket },
          { id: 'billing', label: 'Fees & Invoicing Ledger', icon: DollarSign },
          { id: 'complaints', label: 'Maintenance Tickets', icon: Wrench },
          { id: 'notices', label: 'Notice Bulletin', icon: Bell },
          { id: 'visitors', label: 'Visitor Logbook', icon: UserCheck },
          { id: 'staff', label: 'Staff & Wardens', icon: Shield },
          { id: 'assets', label: 'Room Assets', icon: Package },
          { id: 'mess', label: 'Dining Opt-Outs', icon: Utensils },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as HubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-textMuted hover:text-textMain hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Controls & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-border space-y-2">
              <label className="text-xs font-bold text-textMain flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Attendance Date
              </label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-white"
              />
            </div>
            <div className="glass-panel p-4 rounded-xl border border-border space-y-2">
              <label className="text-xs font-bold text-textMain flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Filter Hostel
              </label>
              <select
                value={attendanceHostelId}
                onChange={(e) => setAttendanceHostelId(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-white"
              >
                <option value="">All Hostels</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-border md:col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-textMuted font-bold">Curfew Attendance Overview</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Present: {attendanceSummary?.present ?? 0}
                  </span>
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    Absent: {attendanceSummary?.absent ?? 0}
                  </span>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Leave: {attendanceSummary?.approvedLeave ?? 0}
                  </span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Late: {attendanceSummary?.late ?? 0}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllPresent}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100"
                >
                  Mark All Present
                </button>
                <button
                  onClick={handleSaveAttendance}
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-sm"
                >
                  Save Roll Call
                </button>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-sm">
            <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center">
              <span className="text-xs font-bold text-textMain">Resident Roll Call Roster ({attendanceRecords.length} Students)</span>
              <span className="text-[11px] text-textMuted">Changes are staged until clicking 'Save Roll Call'</span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 uppercase text-slate-500 bg-slate-100/90 border-b border-border z-10">
                  <tr>
                    <th className="py-2.5 px-4">Resident</th>
                    <th className="py-2.5 px-3">Enrollment</th>
                    <th className="py-2.5 px-3">Hostel & Room</th>
                    <th className="py-2.5 px-3">Current Status</th>
                    <th className="py-2.5 px-4 text-right">Quick Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-textMuted">
                        No residents found for selected criteria.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((r) => {
                      const cur = attendanceEdits[r.studentId] || r.status;
                      return (
                        <tr key={r.studentId} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-4 font-bold text-textMain">{r.studentName || 'Student'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{r.enrollmentNumber || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.hostelName ? `${r.hostelName} - ` : ''}{r.roomNumber ? `Rm ${r.roomNumber}` : 'Unallocated'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                cur === 'present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : cur === 'absent'
                                  ? 'bg-red-100 text-red-800'
                                  : cur === 'approved_leave'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {cur.toUpperCase().replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex gap-1">
                              {(['present', 'absent', 'late', 'approved_leave'] as const).map((st) => (
                                <button
                                  key={st}
                                  onClick={() => setAttendanceEdits((prev) => ({ ...prev, [r.studentId]: st }))}
                                  className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                                    cur === st
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-700 border-border hover:bg-slate-100'
                                  }`}
                                >
                                  {st === 'approved_leave' ? 'Leave' : st.slice(0, 1).toUpperCase() + st.slice(1)}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GATE PASSES */}
      {activeTab === 'gatepasses' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-textMain">Filter Status:</span>
              {(['all', 'pending', 'approved', 'active_out', 'closed', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setGatePassFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    gatePassFilter === f
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateGatePass(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Issue Gate Pass
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gatePasses.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-textMuted text-xs glass-panel rounded-2xl">
                No gate passes match the current filter.
              </div>
            ) : (
              gatePasses.map((gp) => (
                <div key={gp.id} className="glass-panel p-4 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-primary">{gp.id}</span>
                        <span className="font-bold text-sm text-textMain">{gp.studentName || gp.studentId}</span>
                        <span className="text-[10px] text-textMuted font-mono">({gp.enrollmentNumber || 'ID'})</span>
                      </div>
                      <span className="text-xs text-textMuted font-medium mt-0.5 block">
                        Destination: <strong className="text-slate-800">{gp.destination}</strong>
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        gp.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : gp.status === 'active_out'
                          ? 'bg-purple-100 text-purple-800'
                          : gp.status === 'closed'
                          ? 'bg-slate-100 text-slate-700'
                          : gp.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {gp.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-border text-xs space-y-1">
                    <p className="text-textMain"><strong className="text-slate-600">Reason:</strong> {gp.reason}</p>
                    <div className="flex items-center justify-between text-[11px] text-textMuted pt-1 border-t border-slate-200">
                      <span>Depart: {new Date(gp.departureTime).toLocaleDateString()}</span>
                      <span>Return: {new Date(gp.expectedReturnTime).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[11px] text-textMuted">
                      Type: <strong className="capitalize">{gp.passType.replace('_', ' ')}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {gp.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleReviewGatePass(gp.id, 'approved')}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewGatePass(gp.id, 'rejected')}
                            className="px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {gp.status === 'approved' && (
                        <button
                          onClick={() => handleGatePassMovement(gp.id, 'exit')}
                          className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold hover:bg-purple-100"
                        >
                          Log Gate Exit
                        </button>
                      )}
                      {gp.status === 'active_out' && (
                        <button
                          onClick={() => handleGatePassMovement(gp.id, 'return')}
                          className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100"
                        >
                          Log Safe Return
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BILLING & FEES LEDGER */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textMain">Institutional Fees & Invoicing Ledger</h3>
              <p className="text-xs text-textMuted">100% Offline cash & bank payment recording with atomic receipts.</p>
            </div>
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Raise Fee Invoice
            </button>
          </div>

          {latestReceipt && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-900">Latest Issued Receipt</span>
                <button onClick={() => setLatestReceipt(null)} className="text-emerald-700 hover:underline">Dismiss</button>
              </div>
              <p className="font-mono text-emerald-800 font-bold">Receipt No: {latestReceipt.receiptNumber}</p>
              <p className="text-emerald-700">Amount Collected: ₹{latestReceipt.amount.toLocaleString()} ({latestReceipt.paymentMode})</p>
            </div>
          )}

          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-sm">
            <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center">
              <span className="text-xs font-bold text-textMain">Active Invoices ({invoices.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-slate-500 bg-slate-100/90 border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4">Invoice ID</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Cycle & Description</th>
                    <th className="py-2.5 px-3">Due / Paid</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-textMuted">
                        No fee invoices recorded yet.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-primary">{inv.id}</td>
                        <td className="py-2.5 px-3 font-bold text-textMain">
                          {inv.studentName || inv.studentId}
                          <span className="block text-[10px] text-textMuted font-mono">{inv.enrollmentNumber}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-700">{inv.description}</span>
                          <span className="block text-[10px] text-textMuted">Cycle: {inv.billingCycle}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-slate-800">₹{inv.amountDue.toLocaleString()}</span>
                          <span className="block text-[10px] text-emerald-700">Paid: ₹{inv.amountPaid.toLocaleString()}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.status === 'partially_paid'
                                ? 'bg-amber-100 text-amber-800'
                                : inv.status === 'cancelled'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {inv.status.toUpperCase().replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex gap-1.5">
                            {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedInvoice(inv);
                                    setPayAmount(inv.amountDue - inv.amountPaid);
                                    setShowRecordPayment(true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold hover:bg-emerald-100"
                                >
                                  Collect Fee
                                </button>
                                <button
                                  onClick={() => handleWaiveInvoice(inv.id)}
                                  className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold hover:bg-slate-200"
                                >
                                  Waive
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPLAINTS */}
      {activeTab === 'complaints' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textMain">Maintenance & Facility Complaints</h3>
              <p className="text-xs text-textMuted">Track electrical, plumbing, carpentry and sanitation work orders.</p>
            </div>
            <button
              onClick={() => setShowCreateComplaint(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Log Complaint
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complaints.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-textMuted text-xs glass-panel rounded-2xl">
                No active complaints reported.
              </div>
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="glass-panel p-4 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-amber-700">{c.id}</span>
                        <span className="font-bold text-sm text-textMain">{c.subject}</span>
                      </div>
                      <span className="text-xs text-textMuted font-medium mt-0.5 block">
                        Category: <strong className="capitalize text-slate-800">{c.category}</strong> • Room: <strong>{c.roomNumber || 'Assigned'}</strong>
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.priority === 'urgent'
                          ? 'bg-red-100 text-red-800'
                          : c.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.priority.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-border">
                    {c.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[11px] text-textMuted">
                      Status: <strong className="capitalize">{c.status.replace('_', ' ')}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {c.status !== 'resolved' && (
                        <>
                          {c.status !== 'in_progress' && (
                            <button
                              onClick={() => handleResolveComplaint(c.id, 'in_progress')}
                              className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold hover:bg-amber-100"
                            >
                              Mark In-Progress
                            </button>
                          )}
                          <button
                            onClick={() => handleResolveComplaint(c.id, 'resolved')}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100"
                          >
                            Mark Resolved
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: NOTICES */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textMain">Institutional Bulletin Board</h3>
              <p className="text-xs text-textMuted">Official announcements broadcasted to resident and staff screens.</p>
            </div>
            <button
              onClick={() => setShowCreateNotice(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Post Notice
            </button>
          </div>

          <div className="space-y-4">
            {notices.length === 0 ? (
              <div className="text-center py-12 text-textMuted text-xs glass-panel rounded-2xl">
                No active announcements on the bulletin board.
              </div>
            ) : (
              notices.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border ${
                    n.isPinned ? 'border-primary/40 bg-indigo-50/40' : 'border-border bg-white'
                  } space-y-2`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {n.isPinned === 1 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-white uppercase">
                          Pinned
                        </span>
                      )}
                      <h4 className="font-bold text-sm text-textMain">{n.title}</h4>
                      <span className="text-[10px] text-textMuted font-mono">({new Date(n.createdAt).toLocaleDateString()})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {n.targetAudience.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleDeleteNotice(n.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: VISITORS */}
      {activeTab === 'visitors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textMain">Campus Security Visitor Logbook</h3>
              <p className="text-xs text-textMuted">Guest registration with host student link and check-in/out timestamps.</p>
            </div>
            <button
              onClick={() => setShowRegisterVisitor(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Check-In Visitor
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-slate-500 bg-slate-100/90 border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4">Visitor</th>
                    <th className="py-2.5 px-3">Contact & ID Proof</th>
                    <th className="py-2.5 px-3">Host Student</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Check-In / Out</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-textMuted">
                        No visitors registered today.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 font-bold text-textMain">
                          {v.visitorName}
                          <span className="block text-[10px] text-textMuted">Rel: {v.relationship}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-800">{v.phone}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">ID: {v.idProofDetails}</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {v.studentName || v.studentId}
                          <span className="block text-[10px] text-textMuted font-mono">{v.enrollmentNumber}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{v.purpose}</td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <span>In: {new Date(v.checkInTime).toLocaleTimeString()}</span>
                          {v.checkOutTime ? (
                            <span className="block text-slate-500">Out: {new Date(v.checkOutTime).toLocaleTimeString()}</span>
                          ) : (
                            <span className="block font-bold text-emerald-700">Currently On Campus</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {!v.checkOutTime && (
                            <button
                              onClick={() => handleCheckOutVisitor(v.id)}
                              className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100"
                            >
                              Check-Out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: STAFF */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textMain">Hostel Staff & Wardens Roster</h3>
              <p className="text-xs text-textMuted">Operating personnel, maintenance crew, caretakers, and wardens.</p>
            </div>
            <button
              onClick={() => setShowCreateStaff(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Staff Member
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {staffList.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-textMuted text-xs glass-panel rounded-2xl">
                No staff personnel cataloged.
              </div>
            ) : (
              staffList.map((s) => (
                <div key={s.id} className="glass-panel p-4 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-textMain">{s.name}</h4>
                      <span className="text-xs text-textMuted font-mono">{s.phone}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.isActive === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.isActive === 1 ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {s.designation.replace('_', ' ')}
                    </span>
                    {s.email && <p className="text-slate-500 text-[11px] mt-1.5">{s.email}</p>}
                  </div>
                  <div className="pt-2 border-t border-border flex justify-end">
                    <button
                      onClick={() => handleToggleStaffStatus(s.id, s.isActive)}
                      className="px-2.5 py-1 rounded text-[10px] font-bold border border-border hover:bg-slate-100 text-slate-700"
                    >
                      {s.isActive === 1 ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 8: ASSETS */}
      {activeTab === 'assets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-textMain">Room Assets & Inventory</h3>
              <select
                value={assetRoomId}
                onChange={(e) => setAssetRoomId(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-white"
              >
                <option value="">All Rooms</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowCreateAsset(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-slate-500 bg-slate-100/90 border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4">Asset ID</th>
                    <th className="py-2.5 px-3">Room</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Serial / Barcode</th>
                    <th className="py-2.5 px-3">Condition</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-textMuted">
                        No assets registered for this selection.
                      </td>
                    </tr>
                  ) : (
                    assets.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-primary">{a.id}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{a.roomNumber || a.roomId}</td>
                        <td className="py-2.5 px-3 font-semibold text-textMain">{a.assetName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{a.serialNumber || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              a.condition === 'new'
                                ? 'bg-blue-100 text-blue-800'
                                : a.condition === 'good'
                                ? 'bg-emerald-100 text-emerald-800'
                                : a.condition === 'damaged'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {a.condition.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAsset(a.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                            title="Condemn / Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: DINING OPT-OUTS */}
      {activeTab === 'mess' && (
        <div className="space-y-6">
          <div className="glass-panel p-4 rounded-xl border border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-textMain">Weekend Cafeteria Food Wastage Prevention</h3>
              <p className="text-xs text-textMuted">Students visiting home on weekends opt-out to adjust kitchen headcount.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Weekend Starting:</label>
              <input
                type="date"
                value={messWeekendDate}
                onChange={(e) => setMessWeekendDate(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-white"
              />
            </div>
          </div>

          <form onSubmit={handleRecordMessOptOut} className="glass-panel p-4 rounded-xl border border-border flex gap-3 items-center">
            <select
              value={messStudentId}
              onChange={(e) => setMessStudentId(e.target.value)}
              required
              className="text-xs px-3 py-2 rounded-lg border border-border bg-white flex-1"
            >
              <option value="">Select Resident Student to Opt-Out...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.enrollmentNumber})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm"
            >
              Record Opt-Out
            </button>
          </form>

          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-sm">
            <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center">
              <span className="text-xs font-bold text-textMain">
                Opted-Out Students for {messWeekendDate} ({messOptOuts.length})
              </span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Headcount Reduction: {messOptOuts.length} Meals
              </span>
            </div>
            <div className="p-4 space-y-2">
              {messOptOuts.length === 0 ? (
                <p className="text-xs text-textMuted text-center py-6">No students opted out for this weekend.</p>
              ) : (
                messOptOuts.map((o) => (
                  <div key={o.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-border text-xs">
                    <div>
                      <span className="font-bold text-textMain">{o.studentName || o.studentId}</span>
                      <span className="text-slate-500 text-[11px] font-mono ml-2">({o.enrollmentNumber})</span>
                    </div>
                    <button
                      onClick={() => handleCancelMessOptOut(o.studentId)}
                      className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100"
                    >
                      Cancel Opt-Out
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {/* 1. Create Gate Pass Modal */}
      {showCreateGatePass && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Issue Resident Gate Pass</h3>
            <form onSubmit={handleCreateGatePass} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-textMain mb-1">Student Resident</label>
                <select
                  value={gpStudentId}
                  onChange={(e) => setGpStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                >
                  <option value="">Select Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.enrollmentNumber})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Pass Type</label>
                  <select
                    value={gpType}
                    onChange={(e) => setGpType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="day_out">Day Out</option>
                    <option value="night_out">Night Out</option>
                    <option value="vacation">Vacation</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Destination</label>
                  <input
                    type="text"
                    value={gpDestination}
                    onChange={(e) => setGpDestination(e.target.value)}
                    required
                    placeholder="Home, City Center, etc."
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Departure Time</label>
                  <input
                    type="datetime-local"
                    value={gpDepartureTime}
                    onChange={(e) => setGpDepartureTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Return Time</label>
                  <input
                    type="datetime-local"
                    value={gpReturnTime}
                    onChange={(e) => setGpReturnTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Reason / Purpose</label>
                <textarea
                  value={gpReason}
                  onChange={(e) => setGpReason(e.target.value)}
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border"
                  placeholder="Explain the purpose of leave..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateGatePass(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Submit Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Invoice Modal */}
      {showCreateInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Raise Fee Invoice</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-textMain mb-1">Resident Student</label>
                <select
                  value={invStudentId}
                  onChange={(e) => setInvStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                >
                  <option value="">Select Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.enrollmentNumber})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Billing Cycle</label>
                  <input
                    type="month"
                    value={invBillingCycle}
                    onChange={(e) => setInvBillingCycle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Amount Due (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={invAmountDue}
                    onChange={(e) => setInvAmountDue(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Fee Description</label>
                <input
                  type="text"
                  value={invDescription}
                  onChange={(e) => setInvDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Due Date</label>
                <input
                  type="date"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateInvoice(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Record Payment Modal */}
      {showRecordPayment && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Record Offline Fee Collection</h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-border text-xs">
              <p className="font-bold text-slate-800">Invoice: {selectedInvoice.id} ({selectedInvoice.billingCycle})</p>
              <p className="text-slate-600">Student: {selectedInvoice.studentName || selectedInvoice.studentId}</p>
              <p className="text-slate-600">
                Outstanding Balance: <strong className="text-red-700">₹{(selectedInvoice.amountDue - selectedInvoice.amountPaid).toLocaleString()}</strong>
              </p>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="cash">Cash (Counter)</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="pos_card">POS Terminal / Debit Card</option>
                    <option value="cheque">Cheque / Demand Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Amount Collected (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedInvoice.amountDue - selectedInvoice.amountPaid}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Transaction / Cheque / Slip Ref</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Optional bank ref / transaction code"
                  className="w-full px-3 py-2 rounded-lg border border-border font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRecordPayment(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Issue Receipt & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Complaint Modal */}
      {showCreateComplaint && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Log Maintenance Ticket</h3>
            <form onSubmit={handleCreateComplaint} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Student Resident</label>
                  <select
                    value={cmpStudentId}
                    onChange={(e) => setCmpStudentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="">Select Student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Target Room</label>
                  <select
                    value={cmpRoomId}
                    onChange={(e) => setCmpRoomId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="">Select Room...</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Category</label>
                  <select
                    value={cmpCategory}
                    onChange={(e) => setCmpCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="electrical">Electrical</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="carpentry">Carpentry</option>
                    <option value="masonry">Masonry / Painting</option>
                    <option value="cleaning">Cleaning / Hygiene</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Priority</label>
                  <select
                    value={cmpPriority}
                    onChange={(e) => setCmpPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Subject / Issue Summary</label>
                <input
                  type="text"
                  value={cmpSubject}
                  onChange={(e) => setCmpSubject(e.target.value)}
                  required
                  placeholder="e.g., Tube-light blinking, Tap leaking"
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Description</label>
                <textarea
                  value={cmpDescription}
                  onChange={(e) => setCmpDescription(e.target.value)}
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateComplaint(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Create Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Create Notice Modal */}
      {showCreateNotice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Post Notice Announcement</h3>
            <form onSubmit={handleCreateNotice} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-textMain mb-1">Notice Title</label>
                <input
                  type="text"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  required
                  placeholder="e.g., Water Maintenance Schedule"
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Target Audience</label>
                  <select
                    value={noticeAudience}
                    onChange={(e) => setNoticeAudience(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="all">All Campus Residents</option>
                    <option value="boys_only">Boys Hostel Only</option>
                    <option value="girls_only">Girls Hostel Only</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Priority</label>
                  <select
                    value={noticePriority}
                    onChange={(e) => setNoticePriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Bulletin Content</label>
                <textarea
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-border"
                  placeholder="Draft the announcement details..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="noticePinned"
                  checked={noticePinned}
                  onChange={(e) => setNoticePinned(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <label htmlFor="noticePinned" className="font-bold text-slate-700">Pin notice to top of board</label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateNotice(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Register Visitor Modal */}
      {showRegisterVisitor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Register Campus Visitor</h3>
            <form onSubmit={handleRegisterVisitor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Visitor Full Name</label>
                  <input
                    type="text"
                    value={visName}
                    onChange={(e) => setVisName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Phone Contact</label>
                  <input
                    type="tel"
                    value={visPhone}
                    onChange={(e) => setVisPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Relationship</label>
                  <input
                    type="text"
                    value={visRelation}
                    onChange={(e) => setVisRelation(e.target.value)}
                    required
                    placeholder="Parent, Sibling, Friend"
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">ID Proof (Aadhaar / DL)</label>
                  <input
                    type="text"
                    value={visIdProof}
                    onChange={(e) => setVisIdProof(e.target.value)}
                    required
                    placeholder="e.g. DL-XXXX99"
                    className="w-full px-3 py-2 rounded-lg border border-border font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Host Resident Student</label>
                <select
                  value={visStudentId}
                  onChange={(e) => setVisStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                >
                  <option value="">Select Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.enrollmentNumber})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Visit Purpose</label>
                <input
                  type="text"
                  value={visPurpose}
                  onChange={(e) => setVisPurpose(e.target.value)}
                  required
                  placeholder="e.g., Delivering essentials"
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRegisterVisitor(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Permit Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Create Staff Modal */}
      {showCreateStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Add Hostel Staff Member</h3>
            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-textMain mb-1">Staff Name</label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Phone</label>
                  <input
                    type="tel"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Designation</label>
                  <select
                    value={staffDesignation}
                    onChange={(e) => setStaffDesignation(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="warden">Hostel Warden</option>
                    <option value="chief_warden">Chief Warden</option>
                    <option value="security">Security Guard</option>
                    <option value="maintenance">Maintenance Engineer</option>
                    <option value="caretaker">Caretaker / Housekeeping</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateStaff(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Save Personnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Create Asset Modal */}
      {showCreateAsset && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-textMain">Catalog Room Asset</h3>
            <form onSubmit={handleCreateAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-textMain mb-1">Hostel Room</label>
                <select
                  value={newAssetRoomId}
                  onChange={(e) => setNewAssetRoomId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                >
                  <option value="">Select Room...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-textMain mb-1">Asset Item Name</label>
                <input
                  type="text"
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  required
                  placeholder="e.g., Study Desk, Wooden Chair, Ceiling Fan"
                  className="w-full px-3 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-textMain mb-1">Serial / Barcode</label>
                  <input
                    type="text"
                    value={newAssetSerial}
                    onChange={(e) => setNewAssetSerial(e.target.value)}
                    placeholder="Optional S/N"
                    className="w-full px-3 py-2 rounded-lg border border-border font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-textMain mb-1">Condition</label>
                  <select
                    value={newAssetCondition}
                    onChange={(e) => setNewAssetCondition(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="damaged">Damaged</option>
                    <option value="condemned">Condemned</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateAsset(false)}
                  className="px-4 py-2 rounded-lg border border-border text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                >
                  Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
