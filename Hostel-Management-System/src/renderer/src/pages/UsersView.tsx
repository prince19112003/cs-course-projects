import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Shield,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { UserDto, SessionUser } from '../../../shared/types';

interface UsersViewProps {
  token: string;
  currentUser: SessionUser;
}

export const UsersView: React.FC<UsersViewProps> = ({ token, currentUser }) => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);

  // Form states - Create
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<'super_admin' | 'admin' | 'warden' | 'accountant' | 'staff' | 'data_entry' | 'viewer'>('staff');
  const [formPassword, setFormPassword] = useState('ChangeMe@123');
  const [formForceChange, setFormForceChange] = useState(true);

  // Form states - Edit
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'super_admin' | 'admin' | 'warden' | 'accountant' | 'staff' | 'data_entry' | 'viewer'>('staff');

  // Form states - Reset
  const [resetNewPassword, setResetNewPassword] = useState('TempPass@123');
  const [adminConfirmationPassword, setAdminConfirmationPassword] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (window.desktopApi?.users) {
        const res = await window.desktopApi.users.getPaginated(token, {
          page,
          pageSize: 10,
          search: search.trim() || undefined,
          role: roleFilter || undefined,
          isActive: statusFilter === '' ? undefined : statusFilter === 'true',
        });
        if (res.success && res.data) {
          setUsers(res.data.data);
          setTotal(res.data.total);
        } else {
          setNotification({ type: 'error', message: res.error?.message || 'Failed to fetch users.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error fetching users.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.desktopApi?.users) {
        const res = await window.desktopApi.users.create(token, {
          name: formName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          role: formRole,
          password: formPassword,
          forcePasswordChange: formForceChange,
        });

        if (res.success) {
          setNotification({ type: 'success', message: `User ${formName} created successfully.` });
          setIsCreateOpen(false);
          setFormName('');
          setFormEmail('');
          setFormPhone('');
          fetchUsers();
        } else {
          setNotification({ type: 'error', message: res.error?.message || 'User creation failed.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'User creation failed.' });
    }
  };

  const handleOpenEdit = (user: UserDto) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditRole(user.role as any);
    setIsEditOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      if (window.desktopApi?.users) {
        const res = await window.desktopApi.users.update(token, selectedUser.id, {
          name: editName.trim(),
          phone: editPhone.trim(),
          role: editRole,
        });

        if (res.success) {
          setNotification({ type: 'success', message: 'User details updated successfully.' });
          setIsEditOpen(false);
          fetchUsers();
        } else {
          setNotification({ type: 'error', message: res.error?.message || 'Update failed.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Update failed.' });
    }
  };

  const handleToggleStatus = async (user: UserDto) => {
    const confirm = window.confirm(
      `Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} user ${user.name}?`
    );
    if (!confirm) return;

    try {
      if (window.desktopApi?.users) {
        const res = await window.desktopApi.users.toggleStatus(token, user.id, !user.isActive);
        if (res.success) {
          setNotification({
            type: 'success',
            message: `User status changed to ${!user.isActive ? 'Active' : 'Inactive'}.`,
          });
          fetchUsers();
        } else {
          setNotification({ type: 'error', message: res.error?.message || 'Status change failed.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Status change failed.' });
    }
  };

  const handleOpenReset = (user: UserDto) => {
    setSelectedUser(user);
    setResetNewPassword('TempPass@123');
    setAdminConfirmationPassword('');
    setIsResetOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      if (window.desktopApi?.users) {
        const res = await window.desktopApi.users.resetPassword(token, {
          targetUserId: selectedUser.id,
          newPassword: resetNewPassword,
          adminConfirmationPassword,
        });

        if (res.success) {
          setNotification({
            type: 'success',
            message: `Password for ${selectedUser.name} reset. User will be prompted to change password on next sign in.`,
          });
          setIsResetOpen(false);
        } else {
          setNotification({ type: 'error', message: res.error?.message || 'Password reset failed.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Password reset failed.' });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            User & Access Administration
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Manage administrative staff accounts, assign granular roles, toggle account statuses, and reset credentials.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create New User</span>
        </button>
      </div>

      {/* Alert Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
            className="w-full border border-border rounded-xl py-2 pl-10 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </form>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="border border-border rounded-xl py-2 px-3 text-xs outline-none bg-white text-slate-700"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Administrator</option>
            <option value="admin">Administrator</option>
            <option value="warden">Hostel Warden</option>
            <option value="staff">Staff Member</option>
            <option value="data_entry">Data Entry Clerk</option>
            <option value="viewer">Viewer (Read-Only)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-border rounded-xl py-2 px-3 text-xs outline-none bg-white text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User ID / Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Loading accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-textMain">{user.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{user.id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700">{user.email}</div>
                      <div className="text-[11px] text-slate-500">{user.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        <Shield className="w-3 h-3 text-blue-600" />
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {user.isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-600" /> Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="p-1.5 rounded-lg border border-border hover:bg-slate-100 text-slate-600"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenReset(user)}
                        className="p-1.5 rounded-lg border border-border hover:bg-amber-50 text-amber-700 hover:border-amber-200"
                        title="Reset Password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={user.id === currentUser.id}
                        className={`p-1.5 rounded-lg border text-xs font-bold ${
                          user.isActive
                            ? 'border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={user.isActive ? 'Deactivate Account' : 'Activate Account'}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-textMuted bg-slate-50/50">
          <div>
            Showing {users.length} of {total} users
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-white disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-bold text-textMain">Page {page}</span>
            <button
              disabled={page * 10 >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Create Institutional Account
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary"
                  placeholder="e.g. Robert Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email (Login ID)</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary"
                    placeholder="rsmith@nexus.edu"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary bg-white"
                  >
                    {currentUser.role === 'super_admin' && (
                      <option value="super_admin">Super Administrator</option>
                    )}
                    <option value="admin">Administrator</option>
                    <option value="warden">Hostel Warden</option>
                    <option value="staff">Staff</option>
                    <option value="data_entry">Data Entry</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="forceChange"
                  checked={formForceChange}
                  onChange={(e) => setFormForceChange(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <label htmlFor="forceChange" className="text-xs text-slate-700 font-medium">
                  Require password change upon first sign-in
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" /> Edit Account ({selectedUser.id})
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Assignment</label>
                <select
                  value={editRole}
                  disabled={selectedUser.id === currentUser.id}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary bg-white disabled:bg-slate-100"
                >
                  {currentUser.role === 'super_admin' && (
                    <option value="super_admin">Super Administrator</option>
                  )}
                  <option value="admin">Administrator</option>
                  <option value="warden">Hostel Warden</option>
                  <option value="staff">Staff</option>
                  <option value="data_entry">Data Entry</option>
                  <option value="viewer">Viewer</option>
                </select>
                {selectedUser.id === currentUser.id && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    You cannot modify your own administrative role.
                  </p>
                )}
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                >
                  Update Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-amber-50/60">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-700" /> Reset Password for {selectedUser.name}
              </h3>
              <button onClick={() => setIsResetOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium rounded-xl">
                Resetting will immediately terminate any active sessions for this user and require them to choose a new password upon login.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Temporary Password
                </label>
                <input
                  type="text"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 text-xs outline-none focus:border-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Administrator Password (Required Confirmation)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={adminConfirmationPassword}
                    onChange={(e) => setAdminConfirmationPassword(e.target.value)}
                    className="w-full border border-border rounded-xl py-2 pl-10 pr-3 text-xs outline-none focus:border-primary"
                    placeholder="Enter your current password"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl"
                >
                  Confirm Password Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
