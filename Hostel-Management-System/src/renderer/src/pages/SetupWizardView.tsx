import React, { useState } from 'react';
import { Building2, ShieldCheck, User, Mail, Phone, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { SessionUser } from '../../../shared/types';

interface SetupWizardViewProps {
  onSetupSuccess: (token: string, user: SessionUser) => void;
}

export const SetupWizardView: React.FC<SetupWizardViewProps> = ({ onSetupSuccess }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Institution details
  const [institutionName, setInstitutionName] = useState('Nexus University Residential Campus');
  const [institutionCode, setInstitutionCode] = useState('NEXUS-01');
  const [address, setAddress] = useState('Main Academic & Residential Campus, Tech Enclave');

  // Super Admin details
  const [name, setName] = useState('Chief Administrator');
  const [email, setEmail] = useState('admin@nexus.edu');
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim() || !institutionCode.trim() || !address.trim()) {
      setError('Please fill in all institution details.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleFinishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please fill in all administrator fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (window.desktopApi?.auth) {
        const res = await window.desktopApi.auth.setup({
          institutionName,
          institutionCode,
          address,
          name,
          email,
          phone,
          password,
        });

        if (res.success && res.data) {
          onSetupSuccess(res.data.token, res.data.user);
        } else {
          setError(res.error?.message || 'Failed to complete setup.');
        }
      } else {
        setError('Desktop API not available.');
      }
    } catch (err: any) {
      setError(err.message || 'System error during setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-40px)] flex items-center justify-center p-6 bg-slate-100">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-border mb-3 text-primary">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-textMain tracking-tight">
            Nexus First-Time Setup Wizard
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Initialize your offline institutional database and create the primary Super Administrator account.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 1 ? 'text-primary' : 'text-emerald-600'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-primary text-white' : 'bg-emerald-100 text-emerald-700'}`}>
              {step > 1 ? '✓' : '1'}
            </span>
            <span>Institution Profile</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-300" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 2 ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'}`}>
              2
            </span>
            <span>Super Administrator</span>
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-7 shadow-lg">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Institution Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Nexus Institute of Technology"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Institution Code
                  </label>
                  <input
                    type="text"
                    required
                    value={institutionCode}
                    onChange={(e) => setInstitutionCode(e.target.value)}
                    className="w-full border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase font-mono"
                    placeholder="NIT-01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Operating Mode
                  </label>
                  <input
                    type="text"
                    disabled
                    value="100% Offline SQLite"
                    className="w-full border border-slate-200 bg-slate-50 text-slate-600 rounded-xl py-2.5 px-3 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Campus Address
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Street, City, Postal Code"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Continue to Administrator Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinishSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Full Administrator Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Dr. Alan Turing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Address (Login ID)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="admin@nexus.edu"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Master Password
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
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-700">Security Requirement:</p>
                <p>• Password must be at least 8 characters with letters, numbers, and special characters.</p>
                <p>• Offline Bcrypt hashing with cost factor 12 is automatically applied.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3 border border-border hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Initializing Database...' : 'Complete System Initialization'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
