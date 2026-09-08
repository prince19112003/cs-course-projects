import React, { useState, useEffect } from 'react';
import {
  QrCode,
  DoorOpen,
  DollarSign,
  Utensils,
  Wrench,
  CalendarCheck,
  Send,
  User,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Building2,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { StudentDto, StudentDetailedDto, InvoiceDto } from '../../../shared/types';

interface StudentPortalViewProps {
  token?: string | null;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({ token }) => {
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentDetails, setStudentDetails] = useState<StudentDetailedDto | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Cafeteria Opt-out
  const [optOut, setOptOut] = useState(false);
  const [optOutMessage, setOptOutMessage] = useState<string | null>(null);

  // Fee payment modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);
  const [paymentMode, setPaymentMode] = useState<'bank_transfer' | 'cash' | 'pos_card'>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  // Maintenance ticket form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketCategory, setTicketCategory] = useState<'electrical' | 'plumbing' | 'carpentry' | 'appliances' | 'other'>('electrical');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Load real student roster from SQLite
  useEffect(() => {
    const loadRoster = async () => {
      if (!window.desktopApi?.students) return;
      try {
        const res = await window.desktopApi.students.list(token || 'guest', { pageSize: 50 });
        if (res.success && res.data && res.data.data.length > 0) {
          setStudents(res.data.data);
          // Default to first active student or first allocated student
          const firstAlloc = res.data.data.find((s) => s.assignedBedId) || res.data.data[0];
          setSelectedStudentId(firstAlloc.id);
        }
      } catch (err) {
        console.error('Failed to load resident roster:', err);
      }
    };
    loadRoster();
  }, [token]);

  // Load detailed profile & invoices when selected student changes
  const loadStudentProfile = async (id: string) => {
    if (!id || !window.desktopApi?.students) return;
    setLoading(true);
    try {
      const [detailRes, invRes] = await Promise.all([
        window.desktopApi.students.getById(token || 'guest', id),
        window.desktopApi.billing?.invoices?.list
          ? window.desktopApi.billing.invoices.list(token || 'guest', { studentId: id })
          : Promise.resolve({ success: false, data: { data: [], total: 0 } }),
      ]);

      if (detailRes.success && detailRes.data) {
        setStudentDetails(detailRes.data);
      }
      if (invRes.success && invRes.data) {
        setInvoices(invRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load student details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentProfile(selectedStudentId);
    }
  }, [selectedStudentId, token]);

  // Handle Real Payment Recording
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !studentDetails || !token || !window.desktopApi?.billing?.payments?.record) return;

    setIsProcessingPay(true);
    try {
      const remainingAmount = selectedInvoice.amountDue - selectedInvoice.amountPaid;
      const res = await window.desktopApi.billing.payments.record(token, {
        invoiceId: selectedInvoice.id,
        studentId: studentDetails.id,
        amount: remainingAmount,
        paymentMode,
        referenceNumber: referenceNumber.trim() || `PORTAL-TXN-${Date.now().toString().slice(-6)}`,
      });

      if (res.success) {
        setIsPayModalOpen(false);
        setReferenceNumber('');
        loadStudentProfile(studentDetails.id);
      } else {
        alert(res.error?.message || 'Payment recording failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Payment processing error.');
    } finally {
      setIsProcessingPay(false);
    }
  };

  // Handle Real Maintenance Fault Ticket Logging
  const handleLogTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentDetails || !token || !window.desktopApi?.operations?.complaints?.create) return;

    if (!studentDetails.assignedBedId) {
      setTicketMessage('You must be assigned to an active room to log a room maintenance ticket.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await window.desktopApi.operations.complaints.create(token, {
        studentId: studentDetails.id,
        roomId: studentDetails.activeAllocation?.bedId ? (studentDetails as any).roomId || 'RM-0001' : 'RM-0001',
        category: ticketCategory,
        subject: ticketSubject.trim(),
        description: ticketDescription.trim() || ticketSubject.trim(),
        priority: ticketPriority,
      });

      if (res.success) {
        setTicketMessage('✓ Maintenance ticket registered successfully in Warden Operations Desk.');
        setTicketSubject('');
        setTicketDescription('');
        setTimeout(() => setTicketMessage(null), 5000);
      } else {
        setTicketMessage(res.error?.message || 'Failed to register maintenance ticket.');
      }
    } catch (err: any) {
      setTicketMessage(err.message || 'Error submitting ticket.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Handle Cafeteria Weekend Opt-Out Toggle
  const handleToggleOptOut = async () => {
    if (!studentDetails || !token || !window.desktopApi?.operations?.mess) return;
    const nextFriday = new Date();
    nextFriday.setDate(nextFriday.getDate() + ((5 + 7 - nextFriday.getDay()) % 7));
    const weekendDateStr = nextFriday.toISOString().split('T')[0];

    try {
      if (!optOut) {
        const res = await window.desktopApi.operations.mess.recordOptOut(token, studentDetails.id, weekendDateStr);
        if (res.success) {
          setOptOut(true);
          setOptOutMessage(`✓ Meal opt-out registered for weekend starting ${weekendDateStr}.`);
        }
      } else {
        const res = await window.desktopApi.operations.mess.cancelOptOut(token, studentDetails.id, weekendDateStr);
        if (res.success) {
          setOptOut(false);
          setOptOutMessage(`Meal opt-out cancelled for weekend starting ${weekendDateStr}.`);
        }
      }
      setTimeout(() => setOptOutMessage(null), 4000);
    } catch (err: any) {
      console.error('Opt-out toggle error:', err);
    }
  };

  const activeStudent = studentDetails || (students.find((s) => s.id === selectedStudentId) as any);
  const pendingInvoices = invoices.filter((i) => i.status !== 'paid');
  const totalBalanceDue = pendingInvoices.reduce((acc, i) => acc + (i.amountDue - i.amountPaid), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top Selector & Portal Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-textMain">
              Resident Self-Service Portal
            </h1>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              Active Resident Gateway
            </span>
          </div>
          <p className="text-xs text-textMuted font-medium mt-1">
            Personal digital resident dashboard, room berth details, institutional dues, and maintenance tickets.
          </p>
        </div>

        {/* Real Student Account Switcher */}
        {students.length > 0 && (
          <div className="flex items-center gap-2 bg-surface p-2 rounded-xl border border-border shadow-xs">
            <User className="w-4 h-4 text-primary ml-1" />
            <span className="text-xs font-semibold text-textMuted">Account:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="text-xs font-bold text-textMain bg-slate-50 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.enrollmentNumber})
                </option>
              ))}
            </select>
            <button
              onClick={() => loadStudentProfile(selectedStudentId)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Refresh profile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Resident Hero Profile & Digital ID */}
      <div className="glass-panel p-6 md:p-8 rounded-2xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-100 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Verified Residential Profile
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-textMain mt-1">
            Welcome back,{' '}
            <span className="text-primary">
              {activeStudent ? `${activeStudent.firstName} ${activeStudent.lastName}` : 'Resident Student'}
            </span>
          </h2>
          <p className="text-xs md:text-sm text-textMuted mt-1 max-w-lg">
            Department of {activeStudent?.department || 'Engineering'} • {activeStudent?.course || 'Degree Program'}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-textMuted font-medium">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {activeStudent?.phone || '—'}
            </span>
            <span>•</span>
            <span className="font-mono text-slate-600">{activeStudent?.email || '—'}</span>
          </div>
        </div>

        {/* Digital ID Card */}
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4 shrink-0">
          <div className="w-20 h-20 rounded-lg bg-slate-50 border border-border flex flex-col items-center justify-center text-slate-500 p-2">
            <QrCode className="w-12 h-12 text-slate-800" />
            <span className="text-[8px] font-mono font-bold mt-0.5">{activeStudent?.enrollmentNumber || 'NX-STU-001'}</span>
          </div>
          <div className="text-xs space-y-0.5">
            <span className="text-[10px] text-textMuted uppercase font-bold tracking-wider block">
              Digital Resident Pass
            </span>
            <h4 className="font-bold text-sm text-textMain">
              {activeStudent ? `${activeStudent.firstName} ${activeStudent.lastName}` : 'Student Name'}
            </h4>
            <p className="font-mono text-primary font-bold text-xs">{activeStudent?.enrollmentNumber || 'ENR-0000'}</p>
            <div className="pt-1 flex items-center gap-1.5">
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Active Resident
              </span>
              {activeStudent?.bloodGroup && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                  {activeStudent.bloodGroup}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real Allocation & Financial Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Allocated Living Berth Card */}
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-sky-500 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-textMuted uppercase tracking-wider">
              Allocated Living Berth
            </span>
            <h3 className="text-lg font-bold text-textMain mt-0.5">
              {activeStudent?.roomNumber
                ? `Room ${activeStudent.roomNumber} (${activeStudent.blockName || 'Residential Wing'})`
                : activeStudent?.assignedBedId
                ? 'Allocated Bed Berth'
                : 'Awaiting Room Allocation'}
            </h3>
            <p className="text-xs text-textMuted mt-0.5">
              {activeStudent?.bedLabel
                ? `Berth Identifier: Bed ${activeStudent.bedLabel} • ${activeStudent.hostelName || 'Main Campus Complex'}`
                : activeStudent?.assignedBedId
                ? 'Berth assigned in campus roster'
                : 'Contact Warden Office for room allocation'}
            </p>
          </div>
        </div>

        {/* Monthly Fee Standing Card */}
        <div
          className={`glass-panel p-5 rounded-2xl border-t-4 flex justify-between items-center shadow-sm ${
            totalBalanceDue === 0 ? 'border-t-emerald-500' : 'border-t-amber-500'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                totalBalanceDue === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-textMuted uppercase tracking-wider">
                Institutional Fee Standing
              </span>
              <h3 className="text-lg font-bold text-textMain mt-0.5">
                {totalBalanceDue === 0 ? '$0.00 Outstanding' : `$${(totalBalanceDue / 100).toFixed(2)} Dues Pending`}
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                {invoices.length > 0 ? `${invoices.length} billing statement(s) on file` : 'Semester accommodation dues'}
              </p>
            </div>
          </div>
          {pendingInvoices.length > 0 && (
            <button
              onClick={() => {
                setSelectedInvoice(pendingInvoices[0]);
                setIsPayModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              Settle Dues
            </button>
          )}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cafeteria Weekend Opt-Out */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-textMain">
            <Utensils className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm">Cafeteria Weekend Meal Opt-Out</h3>
          </div>
          <p className="text-xs text-textMuted leading-relaxed">
            Traveling home or out of town for the weekend? Register your meal opt-out in advance to streamline dining preparation:
          </p>
          {optOutMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              {optOutMessage}
            </div>
          )}
          <button
            onClick={handleToggleOptOut}
            className={`w-full py-2.5 rounded-xl font-bold text-xs border transition-all ${
              optOut
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-border hover:bg-slate-200'
            }`}
          >
            {optOut ? '✓ Registered: Opted Out of Weekend Meals' : 'Register Weekend Meal Opt-Out'}
          </button>
        </div>

        {/* Room Maintenance Fault Ticket */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-textMain">
            <Wrench className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm">Log Room Maintenance Request</h3>
          </div>
          {ticketMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold border ${
                ticketMessage.startsWith('✓')
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {ticketMessage}
            </div>
          )}
          <form onSubmit={handleLogTicket} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as any)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary"
              >
                <option value="electrical">Electrical Issue</option>
                <option value="plumbing">Plumbing / Water</option>
                <option value="carpentry">Carpentry / Furniture</option>
                <option value="appliances">Appliance / Fan / AC</option>
                <option value="other">General Maintenance</option>
              </select>

              <select
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as any)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="urgent">Urgent Attention</option>
              </select>
            </div>

            <input
              type="text"
              required
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Fault summary (e.g. Study desk light flickering)"
              className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-surface text-textMain"
            />

            <textarea
              rows={2}
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              placeholder="Detailed description of room fault or damage..."
              className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-surface text-textMain resize-none"
            />

            <button
              type="submit"
              disabled={isSubmittingTicket}
              className="w-full py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingTicket ? 'Submitting to Operations...' : 'Submit Maintenance Ticket'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Payment Modal */}
      {isPayModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-textMain">Settle Accommodation Dues</h3>
              <p className="text-xs text-textMuted mt-0.5 font-medium">{selectedInvoice.description}</p>
              <p className="text-lg font-bold text-primary font-mono mt-1">
                ${((selectedInvoice.amountDue - selectedInvoice.amountPaid) / 100).toFixed(2)}
              </p>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-left">
              <div>
                <label className="text-[11px] font-semibold text-textMuted block mb-1">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary"
                >
                  <option value="bank_transfer">Direct Bank Transfer</option>
                  <option value="pos_card">Campus POS / Card Terminal</option>
                  <option value="cash">Bursar Office Cash Deposit</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-textMuted block mb-1">
                  Transaction / Deposit Reference
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UTR-9821839120"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingPay}
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPay}
                  className="flex-1 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                >
                  {isProcessingPay ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
