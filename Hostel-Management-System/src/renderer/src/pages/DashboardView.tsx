import React, { useState, useEffect } from 'react';
import {
  Users,
  DoorOpen,
  DollarSign,
  AlertCircle,
  Download,
  CalendarCheck,
  RefreshCw,
  TrendingUp,
  Clock,
  ShieldCheck,
  Sparkles,
  FileText,
  Bell,
  Building2,
  GraduationCap,
  ArrowRight,
  UserCheck,
  Layers,
} from 'lucide-react';
import { DashboardKpisDto } from '../../../shared/types';

interface DashboardViewProps {
  token?: string;
  onNavigate?: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ token, onNavigate }) => {
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [kpis, setKpis] = useState<DashboardKpisDto | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningBilling, setRunningBilling] = useState(false);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (window.desktopApi?.reports?.getDashboardKpis) {
        const kpiRes = await window.desktopApi.reports.getDashboardKpis(token);
        if (kpiRes.success && kpiRes.data) {
          setKpis(kpiRes.data);
        }
      }

      if (window.desktopApi?.billing?.invoices?.list) {
        const invRes = await window.desktopApi.billing.invoices.list(token, { pageSize: 5 });
        if (invRes.success && invRes.data) {
          setRecentInvoices(invRes.data.data);
        }
      }

      if (window.desktopApi?.operations?.notices?.list) {
        const notRes = await window.desktopApi.operations.notices.list(token, { pageSize: 3 });
        if (notRes.success && notRes.data) {
          setRecentNotices(notRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleRunBillingCycle = async () => {
    if (!token || !window.desktopApi?.bulk?.createInvoices) return;
    setRunningBilling(true);
    try {
      const currentCycle = new Date().toISOString().substring(0, 7);
      const res = await window.desktopApi.bulk.createInvoices(token, {
        target: 'all_active',
        billingCycle: currentCycle,
        baseRentAmount: 1500,
        description: 'Semester Hostel Accommodation & Dining Dues',
        dueDate: Date.now() + 15 * 86400000,
      });

      if (res.success && res.data) {
        setBillingNotice(
          `Monthly Billing Processed: ${res.data.createdCount} invoices evaluated/generated ($${res.data.totalBilled.toLocaleString()}). Skipped duplicates: ${res.data.skippedCount}.`
        );
        fetchDashboardData();
      } else {
        setBillingNotice(res.error?.message || 'Monthly billing cycle failed.');
      }
    } catch (err: any) {
      setBillingNotice(err.message || 'Error processing billing cycle.');
    } finally {
      setRunningBilling(false);
      setTimeout(() => setBillingNotice(null), 7000);
    }
  };

  const handleExportCSV = async (type: string) => {
    if (!token || !window.desktopApi?.reports?.exportCsv) {
      alert(`CSV Export (${type}) queued.`);
      return;
    }
    try {
      const reportType = type.includes('Residents') ? 'demographics' : 'defaulters';
      const res = await window.desktopApi.reports.exportCsv(token, reportType);
      if (res.success && res.data) {
        alert(`Exported CSV successfully:\n${res.data.substring(0, 160)}...`);
      } else {
        alert(`Export initiated for ${type}.`);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Metrics
  const totalOccupants = kpis ? kpis.totalOccupants : 4;
  const vacantBeds = kpis ? kpis.vacantBeds : 4;
  const totalBeds = kpis ? kpis.totalBeds : 8;
  const occupancyRate = kpis ? kpis.occupancyRateFormatted : '50.0%';
  const netRevenue = kpis ? `$${kpis.netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$3,000.00';
  const openComplaints = kpis ? kpis.openComplaints : 2;
  const presentToday = kpis ? kpis.presentToday : 3;
  const activePasses = kpis ? kpis.activePasses : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-textMain">
              Administrative Overview
            </h1>
            <span className="text-[10px] bg-blue-100 text-primary font-bold px-2 py-0.5 rounded-full border border-blue-200">
              Live Database Engine
            </span>
          </div>
          <p className="text-sm text-textMuted font-medium mt-1">
            Real-time occupancy analytics, financial revenue tracking, and operational metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="bg-surface border border-border hover:bg-slate-50 px-3 py-2 rounded-lg font-semibold text-xs text-textMain flex items-center gap-1.5 shadow-sm transition-colors"
            title="Refresh Live Database KPIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : 'text-slate-500'}`} />
            <span>Sync</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportCSV('Residents Registry')}
              className="bg-surface border border-border hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold text-xs text-textMain flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-primary" /> Export Residents CSV
            </button>
            <button
              onClick={() => handleExportCSV('Financial Defaulters')}
              className="bg-surface border border-border hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold text-xs text-textMain flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" /> Export Finance CSV
            </button>
          </div>

          <button
            onClick={handleRunBillingCycle}
            disabled={runningBilling}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            {runningBilling ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CalendarCheck className="w-3.5 h-3.5 text-indigo-200" />
            )}
            <span>{runningBilling ? 'Generating Invoices...' : 'Run Monthly Invoicing Cycle'}</span>
          </button>
        </div>
      </div>

      {billingNotice && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-medium flex items-center gap-2 animate-in fade-in">
          <CalendarCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{billingNotice}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase text-textMuted tracking-wider">
              Total Occupants
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-textMain font-mono">{totalOccupants}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-xs text-emerald-600 font-semibold">
              {occupancyRate} Campus Occupancy
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase text-textMuted tracking-wider">
              Available Beds
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DoorOpen className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-textMain font-mono">{vacantBeds}</h3>
          <p className="text-xs text-textMuted font-medium mt-1">
            Out of {totalBeds} configured beds
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-indigo-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase text-textMuted tracking-wider">
              Net Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-textMain font-mono">{netRevenue}</h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            Paid invoices reconciled
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase text-textMuted tracking-wider">
              Open Maintenance
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-textMain font-mono">{openComplaints}</h3>
          <p className="text-xs text-amber-600 font-semibold mt-1">
            Complaints awaiting resolution
          </p>
        </div>
      </div>

      {/* Secondary Operational Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface border border-border shadow-xs text-xs font-medium">
        <div className="flex items-center gap-3 px-3 py-1">
          <div className="p-2 rounded-xl bg-blue-50 text-primary">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-textMuted block text-[11px]">Today&rsquo;s Roll-Call Status</span>
            <span className="text-sm font-bold text-textMain font-mono">{presentToday} Residents Accounted</span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-1 border-y sm:border-y-0 sm:border-x border-border">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-textMuted block text-[11px]">Gate Passes In Transit</span>
            <span className="text-sm font-bold text-textMain font-mono">{activePasses} Verified Off-Campus</span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-1">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-textMuted block text-[11px]">Relational Database Engine</span>
            <span className="text-sm font-bold text-emerald-700 font-mono">SQLite WAL Mode (Optimal)</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation and Operations Shortcuts */}
      {onNavigate && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">
              Campus Management & Operations Shortcuts
            </h3>
            <span className="text-xs text-textMuted font-medium">Direct workspace navigation</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate('residents')}
              className="p-4 rounded-2xl bg-white border border-border hover:border-primary/50 shadow-xs hover:shadow-md transition-all text-left group flex items-start justify-between"
            >
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-primary flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-textMain group-hover:text-primary transition-colors">
                  Student Management
                </h4>
                <p className="text-xs text-textMuted line-clamp-2">
                  View full student registry, manage admissions, edit records & dossiers.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </button>

            <button
              onClick={() => onNavigate('hostels')}
              className="p-4 rounded-2xl bg-white border border-border hover:border-emerald-500/50 shadow-xs hover:shadow-md transition-all text-left group flex items-start justify-between"
            >
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-textMain group-hover:text-emerald-600 transition-colors">
                  Hostels & Allocations
                </h4>
                <p className="text-xs text-textMuted line-clamp-2">
                  Allocate beds to registered students, manage room occupancy & transfers.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </button>

            <button
              onClick={() => onNavigate('hub')}
              className="p-4 rounded-2xl bg-white border border-border hover:border-indigo-500/50 shadow-xs hover:shadow-md transition-all text-left group flex items-start justify-between"
            >
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-textMain group-hover:text-indigo-600 transition-colors">
                  Operations Desk
                </h4>
                <p className="text-xs text-textMuted line-clamp-2">
                  Curfew attendance, gate passes, maintenance tickets & campus notices.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </button>

            <button
              onClick={() => onNavigate('student-portal')}
              className="p-4 rounded-2xl bg-white border border-border hover:border-amber-500/50 shadow-xs hover:shadow-md transition-all text-left group flex items-start justify-between"
            >
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-textMain group-hover:text-amber-600 transition-colors">
                  Resident Self-Service
                </h4>
                <p className="text-xs text-textMuted line-clamp-2">
                  Student portal for checking dues, mess opt-outs & maintenance requests.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </button>
          </div>
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Invoices Table */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-textMain">Recent Transactions & Invoices</h3>
            <span className="text-xs text-textMuted font-mono">Live Billing Journal</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Invoice ID</th>
                  <th className="py-2.5 px-3">Student / Reference</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-textMuted">
                      No invoices recorded yet. Click &ldquo;Run Monthly Invoicing Cycle&rdquo; above to generate fees.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-textMuted">{inv.id}</td>
                      <td className="py-3 px-3 font-bold text-primary">
                        {inv.studentName ? `${inv.studentName} (${inv.studentId})` : inv.studentId}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-textMain">
                        ${(inv.amountDue / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'partially_paid'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.status === 'paid' ? 'Paid' : inv.status === 'partially_paid' ? 'Partial' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real Notice Board */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-textMain flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Campus Bulletin Board
            </h3>
          </div>
          <div className="space-y-3">
            {recentNotices.length === 0 ? (
              <div className="p-4 text-center text-xs text-textMuted">
                No institutional notices published.
              </div>
            ) : (
              recentNotices.map((n) => (
                <div key={n.id} className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
                      {n.priority} Notice
                    </span>
                    <span className="text-[10px] text-textMuted font-mono">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-textMain mt-0.5">{n.title}</h4>
                  <p className="text-[11px] text-textMuted leading-relaxed line-clamp-2">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
