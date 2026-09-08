import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Filter, Search } from 'lucide-react';
import { AuditLogDto } from '../../../shared/types';

interface AuditLogViewProps {
  token: string;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ token }) => {
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (window.desktopApi?.audit) {
        const res = await window.desktopApi.audit.list(token, 100);
        if (res.success && res.data) {
          setLogs(res.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction ? log.action.toLowerCase().includes(filterAction.toLowerCase()) : true;
    const matchesSearch = search
      ? log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.entityType.toLowerCase().includes(search.toLowerCase()) ||
        (log.userId && log.userId.toLowerCase().includes(search.toLowerCase())) ||
        (log.details && log.details.toLowerCase().includes(search.toLowerCase()))
      : true;
    return matchesAction && matchesSearch;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Security & Operational Audit Log
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Immutable, offline audit trail capturing administrative modifications, authentication attempts, and privilege adjustments.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, entity, details..."
            className="w-full border border-border rounded-xl py-2 pl-10 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="border border-border rounded-xl py-2 px-3 text-xs outline-none bg-white text-slate-700 w-full md:w-auto"
        >
          <option value="">All Actions</option>
          <option value="LOGIN">Sign In Actions</option>
          <option value="SETUP">System Setup</option>
          <option value="USER">User Operations</option>
          <option value="ROLE">Role & Permission Changes</option>
          <option value="PASSWORD">Password Changes</option>
        </select>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 font-sans text-xs">
                    Retrieving audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 font-sans text-xs">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-blue-700 font-semibold">{log.entityType}</span>
                      {log.entityId && (
                        <span className="text-slate-400 block text-[10px]">{log.entityId}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-bold">{log.userId || 'SYSTEM'}</div>
                      {log.userRole && (
                        <div className="text-slate-400 text-[10px]">{log.userRole}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-md break-all font-sans text-[11px] text-slate-600">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
