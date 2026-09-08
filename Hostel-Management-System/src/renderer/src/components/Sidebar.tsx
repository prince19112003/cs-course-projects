import React from 'react';
import {
  LayoutDashboard,
  Users,
  DoorClosed,
  Layers,
  GraduationCap,
  LogOut,
  UserCheck,
  Shield,
  ShieldAlert,
  KeyRound,
  Building2,
  BarChart3,
  Database,
} from 'lucide-react';
import { SessionUser } from '../../../shared/types';

export type ActiveTab =
  | 'dashboard'
  | 'hostels'
  | 'residents'
  | 'rooms'
  | 'hub'
  | 'reports'
  | 'backup'
  | 'users'
  | 'roles'
  | 'audit'
  | 'student-portal';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser?: SessionUser | null;
  onLogout?: () => void;
  onChangePassword?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onChangePassword,
}) => {
  const coreNavItems = [
    { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'residents', label: 'Student Management', icon: Users },
    { id: 'hostels', label: 'Hostels & Allocations', icon: Building2 },
    { id: 'rooms', label: 'Room Matrix', icon: DoorClosed },
    { id: 'hub', label: 'Campus Operations Hub', icon: Layers },
    { id: 'reports', label: 'Reports & Bulk Tools', icon: BarChart3 },
  ];

  const adminNavItems = [
    { id: 'backup', label: 'Backup & Recovery', icon: Database },
    { id: 'users', label: 'Users & Access', icon: UserCheck },
    { id: 'roles', label: 'Roles & RBAC', icon: Shield },
    { id: 'audit', label: 'Audit Trail', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-border h-full flex flex-col pt-5 shrink-0 z-20">
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-primary font-bold">
            NX
          </div>
          <div>
            <h2 className="text-base font-bold text-textMain tracking-wide">
              NEXUS
            </h2>
            <p className="text-[11px] text-textMuted font-medium">
              Hostel Administration
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-textMuted mb-2">
          Core Operations
        </p>
        {coreNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-blue-50 text-primary font-bold border border-blue-100 shadow-sm'
                  : 'text-textMuted hover:text-textMain hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-primary' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-4">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-textMuted mb-2">
            Administration & Security
          </p>
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-blue-50 text-primary font-bold border border-blue-100 shadow-sm'
                    : 'text-textMuted hover:text-textMain hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-primary' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-4">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Resident Services
          </p>
          <button
            onClick={() => setActiveTab('student-portal')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'student-portal'
                ? 'bg-blue-50 text-primary font-bold border border-blue-200'
                : 'text-slate-600 hover:text-textMain hover:bg-slate-50'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="flex-1 text-left">Resident Portal</span>
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              ONLINE
            </span>
          </button>
        </div>
      </nav>

      {/* Logged in user profile & actions */}
      <div className="p-4 border-t border-border mt-auto bg-slate-50/50">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            {currentUser ? currentUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-textMain truncate">
              {currentUser?.name || 'Administrator'}
            </h4>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-textMuted truncate">
                {currentUser?.email || 'admin@nexus.edu'}
              </span>
              <span className="text-[9px] font-bold uppercase text-blue-700 bg-blue-100 px-1 rounded">
                {currentUser?.role || 'ADMIN'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onChangePassword && (
            <button
              onClick={onChangePassword}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 text-[11px] font-bold border border-slate-200 transition-colors"
              title="Change Password"
            >
              <KeyRound className="w-3 h-3 text-slate-500" />
              <span>Password</span>
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-[11px] font-bold border border-red-100 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
