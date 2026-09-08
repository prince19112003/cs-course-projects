import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  RotateCcw,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Trash2,
  Play,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  BackupMetadata,
  DatabaseDiagnosticsDto,
  MigrationStatusDto,
  SessionUser,
} from '../../../shared/types';

interface BackupRestoreViewProps {
  token: string;
  currentUser?: SessionUser | null;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'backups' | 'restore' | 'portability' | 'health'>('backups');
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [health, setHealth] = useState<DatabaseDiagnosticsDto | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Backup creation state
  const [manualNote, setManualNote] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Restore state
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<string>('');
  const [restoring, setRestoring] = useState(false);

  // Portability state
  const [exportStationName, setExportStationName] = useState('Central-Station-01');
  const [portableFilePath, setPortableFilePath] = useState('');
  const [portableStrategy, setPortableStrategy] = useState<'full_overwrite' | 'branch_merge'>('branch_merge');
  const [portingAction, setPortingAction] = useState(false);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 8000);
  };

  const loadBackups = async () => {
    try {
      if (!window.desktopApi?.backup) return;
      const res = await window.desktopApi.backup.list(token);
      if (res.success && res.data) {
        setBackups(res.data);
      }
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  };

  const loadHealthAndMigrations = async () => {
    try {
      if (!window.desktopApi?.backup) return;
      const [hRes, mRes] = await Promise.all([
        window.desktopApi.backup.getHealth(token),
        window.desktopApi.backup.getMigrationStatus(token),
      ]);
      if (hRes.success && hRes.data) setHealth(hRes.data);
      if (mRes.success && mRes.data) setMigrationStatus(mRes.data);
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    }
  };

  useEffect(() => {
    loadBackups();
    loadHealthAndMigrations();
  }, [token]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await window.desktopApi.backup.create(token, { note: manualNote || undefined });
      if (res.success && res.data) {
        showNotice('success', `Snapshot created successfully: ${res.data.filename} (${(res.data.sizeBytes / 1024).toFixed(1)} KB)`);
        setManualNote('');
        loadBackups();
      } else {
        showNotice('error', res.error?.message || 'Failed to create backup.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Error occurred while creating backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleValidateBackup = async (filePath: string) => {
    setLoading(true);
    try {
      const res = await window.desktopApi.backup.validate(token, filePath);
      if (res.success && res.data) {
        showNotice('success', 'Backup integrity check PASSED: Gzip checksum verified and SQLite test schema valid.');
      } else {
        showNotice('error', res.error?.message || 'Validation failed: archive is corrupted.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Validation error.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete backup file: ${filename}?`)) return;
    try {
      const res = await window.desktopApi.backup.delete(token, filename);
      if (res.success) {
        showNotice('success', `Backup ${filename} deleted.`);
        loadBackups();
      } else {
        showNotice('error', res.error?.message || 'Failed to delete backup.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Delete error.');
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedBackupForRestore) {
      showNotice('error', 'Please select a backup archive to restore.');
      return;
    }
    const confirmed = confirm(
      'MANDATORY SAFETY CONFIRMATION:\n\n' +
      '1. The system will first create a snapshot safety copy of your current database.\n' +
      '2. The selected backup will be verified in sandbox memory before replacement.\n' +
      '3. If any issue occurs, an atomic rollback will restore your existing state.\n\n' +
      'Proceed with restoring this backup?'
    );
    if (!confirmed) return;

    setRestoring(true);
    try {
      const res = await window.desktopApi.backup.restore(token, {
        backupFilePath: selectedBackupForRestore,
      });
      if (res.success && res.data) {
        showNotice(
          'success',
          `Safe Restore Complete! Restored to schema v${res.data.restoredSchemaVersion}. Safety snapshot saved as: ${res.data.safetyBackupFile}`
        );
        loadHealthAndMigrations();
        loadBackups();
      } else {
        showNotice('error', res.error?.message || 'Restore failed.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Critical restore error.');
    } finally {
      setRestoring(false);
    }
  };

  const handleExportPortable = async () => {
    setPortingAction(true);
    try {
      const res = await window.desktopApi.backup.exportPortable(token, {
        stationName: exportStationName,
        note: 'Cross-station export bundle',
      });
      if (res.success && res.data) {
        showNotice(
          'success',
          `Portable package exported successfully: ${res.data.packagePath} (${res.data.entityCounts.students} students, ${res.data.entityCounts.rooms} rooms)`
        );
      } else {
        showNotice('error', res.error?.message || 'Failed to export portable package.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Portable export error.');
    } finally {
      setPortingAction(false);
    }
  };

  const handleImportPortable = async () => {
    if (!portableFilePath.trim()) {
      showNotice('error', 'Please enter the absolute path to the .nexus package file.');
      return;
    }
    setPortingAction(true);
    try {
      const res = await window.desktopApi.backup.importPortable(token, {
        packageFilePath: portableFilePath.trim(),
        strategy: portableStrategy,
      });
      if (res.success && res.data) {
        showNotice(
          'success',
          `Package imported (${portableStrategy})! Merged: ${res.data.recordsMerged.students} students, ${res.data.recordsMerged.complaints} complaints. Skipped duplicates: ${res.data.recordsSkipped}`
        );
        loadHealthAndMigrations();
      } else {
        showNotice('error', res.error?.message || 'Failed to import portable package.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Portable import error.');
    } finally {
      setPortingAction(false);
    }
  };

  const handleVacuumDatabase = async () => {
    setLoading(true);
    try {
      const res = await window.desktopApi.backup.vacuum(token);
      if (res.success && res.data) {
        showNotice('success', `Database vacuum and defragmentation completed. Est. freed: ${(res.data.freedBytesEstimate / 1024).toFixed(1)} KB`);
        loadHealthAndMigrations();
      } else {
        showNotice('error', res.error?.message || 'Vacuum failed.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Vacuum error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunPendingMigrations = async () => {
    setLoading(true);
    try {
      const res = await window.desktopApi.backup.runMigrations(token);
      if (res.success && res.data) {
        showNotice('success', `Database migrations up to date! Applied: ${res.data.appliedCount} migration step(s).`);
        loadHealthAndMigrations();
      } else {
        showNotice('error', res.error?.message || 'Migration failed.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Migration error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-textMain">
              Backup, Restore & Data Portability
            </h1>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              Zero-Cloud Offline Hardened
            </span>
          </div>
          <p className="text-sm text-textMuted font-medium mt-1">
            Gzip-compressed snapshots, SHA-256 integrity validation, atomic rollback recovery, and cross-station portability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadBackups();
              loadHealthAndMigrations();
            }}
            disabled={loading}
            className="bg-surface border border-border hover:bg-slate-50 px-3.5 py-2 rounded-lg font-semibold text-xs text-textMain flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : 'text-slate-500'}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between animate-in fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex border-b border-border space-x-6">
        {[
          { id: 'backups', label: 'Local Snapshots', icon: Database },
          { id: 'restore', label: 'Safe Restore & Rollback', icon: RotateCcw },
          { id: 'portability', label: 'Cross-Station Portability (.nexus)', icon: HardDrive },
          { id: 'health', label: 'Database Health & Migrations', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LOCAL SNAPSHOTS */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          {/* Create Backup Card */}
          <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-textMain flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" /> Create On-Demand Database Snapshot
                </h3>
                <p className="text-xs text-textMuted mt-0.5">
                  Creates an atomic, Gzip-compressed snapshot (`.db.gz`) with SHA-256 integrity hash verification.
                </p>
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {creatingBackup ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{creatingBackup ? 'Creating Snapshot...' : 'Create Backup Now'}</span>
              </button>
            </div>

            <div className="max-w-md">
              <label className="text-xs font-semibold text-textMuted block mb-1">
                Optional Backup Note / Description
              </label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Prior to end-of-semester room reallocations"
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Backup Archives List */}
          <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-textMain">
                Local Backup Catalog ({backups.length} Available)
              </h3>
              <span className="text-[11px] text-textMuted font-medium">
                Rolling 14-day retention cycle enforced automatically.
              </span>
            </div>

            {backups.length === 0 ? (
              <div className="p-8 text-center text-textMuted">
                <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No local backups generated yet.</p>
                <p className="text-[11px] mt-1">Click &ldquo;Create Backup Now&rdquo; above to generate your first snapshot.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3">Created At</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Schema Ver</th>
                      <th className="py-2.5 px-3">SHA-256 Hash</th>
                      <th className="py-2.5 px-3">Note</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium text-textMain">
                    {backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono text-primary font-semibold">
                          {b.filename}
                        </td>
                        <td className="py-3 px-3 text-textMuted">
                          {new Date(b.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {(b.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-mono text-[10px] font-bold border border-blue-100">
                            v{b.schemaVersion}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-textMuted max-w-[140px] truncate" title={b.sha256}>
                          {b.sha256.substring(0, 12)}...
                        </td>
                        <td className="py-3 px-3 text-textMuted max-w-[160px] truncate">
                          {b.note || '—'}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            onClick={() => handleValidateBackup(b.filePath)}
                            title="Verify Checksum & SQLite Header"
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBackupForRestore(b.filePath);
                              setActiveTab('restore');
                            }}
                            title="Restore this backup"
                            className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(b.filename)}
                            title="Delete snapshot"
                            className="p-1 rounded text-red-600 hover:bg-red-50 inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SAFE RESTORE & ROLLBACK */}
      {activeTab === 'restore' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-border space-y-5">
            <div>
              <h3 className="text-base font-bold text-textMain flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-indigo-600" /> Atomic Safe Restore Console
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                Restores the database state from a validated compressed snapshot. Guaranteed zero data-loss workflow.
              </p>
            </div>

            {/* Safety Architecture Notice */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                Three-Tier Restore Safety Protection:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                <li>
                  <strong>Automatic Safety Snapshot:</strong> The system automatically captures `pre_restore_safety_TIMESTAMP.db.gz` before touching current database files.
                </li>
                <li>
                  <strong>Sandbox Integrity Verification:</strong> The target backup is decompressed to temporary memory and evaluated for SQLite page integrity, schema version, and foreign keys.
                </li>
                <li>
                  <strong>Instant Rollback:</strong> If SQLite re-initialization fails during file swap, the previous state is immediately restored from the safety copy.
                </li>
              </ul>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-semibold text-textMuted block mb-1">
                  Select Backup Archive File
                </label>
                <select
                  value={selectedBackupForRestore}
                  onChange={(e) => setSelectedBackupForRestore(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary font-mono"
                >
                  <option value="">-- Choose a local backup snapshot --</option>
                  {backups.map((b) => (
                    <option key={b.filename} value={b.filePath}>
                      {b.filename} — {new Date(b.createdAt).toLocaleDateString()} (v{b.schemaVersion})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-textMuted block mb-1">
                  Or Specify Custom Absolute Backup File Path
                </label>
                <input
                  type="text"
                  value={selectedBackupForRestore}
                  onChange={(e) => setSelectedBackupForRestore(e.target.value)}
                  placeholder="C:\backups\nexus_backup_2026-09-08.db.gz"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleExecuteRestore}
                  disabled={!selectedBackupForRestore || restoring}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {restoring ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                  <span>{restoring ? 'Executing Atomic Safe Restore...' : 'Run Safe Restore'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CROSS-STATION PORTABILITY (.nexus) */}
      {activeTab === 'portability' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Box */}
          <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div>
              <h3 className="text-base font-bold text-textMain flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" /> Export Portable Package (.nexus)
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                Packs station state into a self-contained `.nexus` portability package with machine manifest and entity tables.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-textMuted block mb-1">
                  Origin Station Identifier
                </label>
                <input
                  type="text"
                  value={exportStationName}
                  onChange={(e) => setExportStationName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={handleExportPortable}
                disabled={portingAction}
                className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {portingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                <span>Generate .nexus Package</span>
              </button>
            </div>
          </div>

          {/* Import Box */}
          <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div>
              <h3 className="text-base font-bold text-textMain flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" /> Import Portable Package (.nexus)
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                Load and reconcile a `.nexus` file from another administrator station.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-textMuted block mb-1">
                  Absolute Path to .nexus File
                </label>
                <input
                  type="text"
                  value={portableFilePath}
                  onChange={(e) => setPortableFilePath(e.target.value)}
                  placeholder="C:\imports\station_export_2026.nexus"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-textMain outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-textMuted block mb-1">
                  Reconciliation Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2 p-3 rounded-xl border text-xs cursor-pointer ${
                      portableStrategy === 'branch_merge'
                        ? 'border-primary bg-blue-50/50 font-bold text-primary'
                        : 'border-border bg-surface text-textMain'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      checked={portableStrategy === 'branch_merge'}
                      onChange={() => setPortableStrategy('branch_merge')}
                      className="mt-0.5"
                    />
                    <div>
                      <span>Branch Merge</span>
                      <p className="text-[10px] font-normal text-textMuted mt-0.5">
                        Non-destructive merge of students and complaints matching on natural keys.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-3 rounded-xl border text-xs cursor-pointer ${
                      portableStrategy === 'full_overwrite'
                        ? 'border-primary bg-blue-50/50 font-bold text-primary'
                        : 'border-border bg-surface text-textMain'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      checked={portableStrategy === 'full_overwrite'}
                      onChange={() => setPortableStrategy('full_overwrite')}
                      className="mt-0.5"
                    />
                    <div>
                      <span>Full Overwrite</span>
                      <p className="text-[10px] font-normal text-textMuted mt-0.5">
                        Complete station replacement (with pre-restore safety copy).
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={handleImportPortable}
                disabled={portingAction || !portableFilePath}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {portingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Import & Reconcile Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE HEALTH & MIGRATIONS */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-emerald-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase text-textMuted">
                  Integrity Status
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-textMain">
                {health?.quickCheckOk && health?.integrityCheckOk ? 'OPTIMAL' : 'ATTENTION'}
              </h3>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                Zero page corruption detected
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-primary shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase text-textMuted">
                  Active Schema Version
                </span>
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-textMain">
                v{migrationStatus?.currentVersion || 1}
              </h3>
              <p className="text-xs text-textMuted font-medium mt-1">
                Target version: v{migrationStatus?.targetVersion || 1}
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-indigo-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase text-textMuted">
                  Foreign Key Integrity
                </span>
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-textMain">
                {health?.foreignKeyViolationsCount === 0 ? '100% VALID' : `${health?.foreignKeyViolationsCount} VIOLATIONS`}
              </h3>
              <p className="text-xs text-indigo-600 font-semibold mt-1">
                Relational consistency verified
              </p>
            </div>
          </div>

          {/* Database Diagnostics Table */}
          <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-textMain">
                Database Diagnostics & Storage Metrics
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVacuumDatabase}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Defragment & Vacuum
                </button>
                <button
                  onClick={handleRunPendingMigrations}
                  disabled={loading || (migrationStatus?.pendingCount === 0)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-primary text-xs font-bold flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Apply Pending Migrations ({migrationStatus?.pendingCount || 0})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-border text-xs">
              <div>
                <span className="text-textMuted font-medium block">Database File Size:</span>
                <span className="font-bold text-textMain font-mono text-sm">
                  {health ? `${(health.databaseSizeBytes / 1024).toFixed(1)} KB` : '—'}
                </span>
              </div>
              <div>
                <span className="text-textMuted font-medium block">SQLite Page Size:</span>
                <span className="font-bold text-textMain font-mono text-sm">
                  {health ? `${health.pageSize} bytes` : '—'}
                </span>
              </div>
              <div>
                <span className="text-textMuted font-medium block">Page Count / Freelist:</span>
                <span className="font-bold text-textMain font-mono text-sm">
                  {health ? `${health.pageCount} / ${health.freelistCount}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-textMuted font-medium block">WAL Journal Mode:</span>
                <span className="font-bold text-emerald-700 font-mono text-sm">
                  {health?.journalMode?.toUpperCase() || 'WAL'}
                </span>
              </div>
            </div>

            {/* Table record counts */}
            {health?.tableCounts && (
              <div>
                <h4 className="text-xs font-bold text-textMain uppercase tracking-wider mb-2">
                  Database Table Metrics
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {Object.entries(health.tableCounts).map(([tbl, count]) => (
                    <div key={tbl} className="p-2 rounded-lg bg-surface border border-border text-center">
                      <span className="text-[10px] text-textMuted font-mono block truncate">{tbl}</span>
                      <span className="text-xs font-bold text-textMain font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
