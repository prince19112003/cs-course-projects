import React, { useState } from 'react';
import { Building2, Lock, User, AlertCircle, ShieldAlert, GraduationCap } from 'lucide-react';
import { SessionUser } from '../../../shared/types';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: SessionUser) => void;
  onStudentPortalDemo: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onStudentPortalDemo,
}) => {
  const [identifier, setIdentifier] = useState('admin@nexus.edu');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forced password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [tempToken, setTempToken] = useState<string>('');
  const [tempUser, setTempUser] = useState<SessionUser | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (window.desktopApi?.auth) {
        const res = await window.desktopApi.auth.login({
          identifier: identifier.trim(),
          password,
        });

        if (res.success && res.data) {
          if (res.data.user.forcePasswordChange) {
            setTempToken(res.data.token);
            setTempUser(res.data.user);
            setMustChangePassword(true);
          } else {
            onLoginSuccess(res.data.token, res.data.user);
          }
        } else {
          setError(res.error?.message || 'Invalid credentials or account locked.');
        }
      } else {
        // Fallback for standalone browser preview if desktopApi is absent
        if (identifier === 'admin@nexus.edu' && password === 'admin') {
          onLoginSuccess('auth-session-token', {
            id: 'USR-0001',
            name: 'System Administrator',
            email: 'admin@nexus.edu',
            phone: '9876543210',
            role: 'super_admin',
            forcePasswordChange: false,
            permissions: ['*'],
          });
        } else {
          setError('Invalid credentials.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeComplete = () => {
    setMustChangePassword(false);
    if (tempToken && tempUser) {
      onLoginSuccess(tempToken, {
        ...tempUser,
        forcePasswordChange: false,
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-40px)] flex items-center justify-center p-6 bg-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm border border-border mb-3 text-primary">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-textMain tracking-tight">
            Nexus Enterprise Portal
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Offline Residential Institution Management System
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-2xl p-7 shadow-lg space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Address or Phone Number
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="admin@nexus.edu or 9876543210"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating Offline...' : 'Sign In to Administrative Console'}
          </button>

          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-[11px] text-textMuted">
              <span className="font-semibold text-slate-500">Resident Self-Service:</span>
            </div>
            <button
              type="button"
              onClick={onStudentPortalDemo}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-primary font-bold text-xs transition-all"
            >
              <GraduationCap className="w-4 h-4 text-primary" />
              <span>Access Resident Self-Service Portal</span>
            </button>
          </div>
        </form>
      </div>

      {mustChangePassword && (
        <ChangePasswordModal
          isOpen={mustChangePassword}
          token={tempToken}
          mustChange={true}
          onClose={() => setMustChangePassword(false)}
          onSuccess={handlePasswordChangeComplete}
        />
      )}
    </div>
  );
};
