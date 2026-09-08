import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertCircle, Save } from 'lucide-react';
import { RoleDto, PermissionDto, SessionUser } from '../../../shared/types';

interface RolesPermissionsViewProps {
  token: string;
  currentUser: SessionUser;
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({ token, currentUser }) => {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role_admin');
  const [activePerms, setActivePerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (window.desktopApi?.roles) {
        const res = await window.desktopApi.roles.list(token);
        if (res.success && res.data) {
          setRoles(res.data.roles);
          setPermissions(res.data.permissions);
          if (res.data.roles.length > 0) {
            const initialRole = res.data.roles.find((r) => r.id === selectedRoleId) || res.data.roles[0];
            setSelectedRoleId(initialRole.id);
            setActivePerms(new Set(initialRole.permissions));
          }
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load roles.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectRole = (role: RoleDto) => {
    setSelectedRoleId(role.id);
    setActivePerms(new Set(role.permissions));
  };

  const handleTogglePermission = (permKey: string) => {
    const selectedRole = roles.find((r) => r.id === selectedRoleId);
    if (selectedRole?.name === 'super_admin') return; // Super admin always has *

    const next = new Set(activePerms);
    if (next.has(permKey)) {
      next.delete(permKey);
    } else {
      next.add(permKey);
    }
    setActivePerms(next);
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      if (window.desktopApi?.roles) {
        const res = await window.desktopApi.roles.updatePermissions(
          token,
          selectedRoleId,
          Array.from(activePerms)
        );

        if (res.success) {
          setNotification({ type: 'success', message: 'Role permissions saved successfully.' });
          fetchData();
        } else {
          setNotification({ type: 'error', message: res.error?.message || 'Save failed.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const groupedPermissions: Record<string, PermissionDto[]> = {};
  permissions.forEach((p) => {
    const mod = p.module || 'general';
    if (!groupedPermissions[mod]) {
      groupedPermissions[mod] = [];
    }
    groupedPermissions[mod].push(p);
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Roles & Permission Matrix
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Configure role definitions and adjust granular access rights across institutional subsystems.
          </p>
        </div>

        {selectedRole && selectedRole.name !== 'super_admin' && (
          <button
            onClick={handleSavePermissions}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Role Permissions'}</span>
          </button>
        )}
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Role List */}
        <div className="md:col-span-1 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-textMuted px-2">
            System Roles
          </p>
          {roles.map((r) => {
            const isSelected = r.id === selectedRoleId;
            return (
              <button
                key={r.id}
                onClick={() => handleSelectRole(r)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-sm font-bold'
                    : 'bg-white border-border hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs">{r.name.toUpperCase()}</div>
                <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {r.description || 'Institutional Role'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Permission Groups */}
        <div className="md:col-span-3 space-y-6">
          {selectedRole?.name === 'super_admin' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 text-xs">
              <h4 className="font-bold text-sm mb-1">Super Administrator Wildcard Bypass (*)</h4>
              <p>
                The Super Administrator role inherently bypasses all granular permission checks and retains full system privileges across every subsystem.
              </p>
            </div>
          ) : null}

          {Object.entries(groupedPermissions).map(([mod, perms]) => (
            <div key={mod} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-border">
                {mod.toUpperCase()} Permissions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {perms.map((p) => {
                  const hasPerm =
                    selectedRole?.name === 'super_admin' ||
                    activePerms.has(p.name) ||
                    activePerms.has('*');
                  const isSuperAdmin = selectedRole?.name === 'super_admin';

                  return (
                    <div
                      key={p.name}
                      onClick={() => !isSuperAdmin && handleTogglePermission(p.name)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        hasPerm
                          ? 'bg-blue-50/50 border-blue-200 text-slate-900'
                          : 'bg-slate-50/50 border-border text-slate-400'
                      } ${isSuperAdmin ? 'cursor-not-allowed opacity-80' : 'hover:border-primary'}`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center text-white ${
                          hasPerm ? 'bg-primary' : 'bg-slate-300'
                        }`}
                      >
                        {hasPerm && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">{p.name}</div>
                        <div className="text-[11px] text-slate-500">{p.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
