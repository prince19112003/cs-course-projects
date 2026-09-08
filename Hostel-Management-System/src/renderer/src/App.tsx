import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { ResidentsView } from './pages/ResidentsView';
import { RoomMatrixView } from './pages/RoomMatrixView';
import { ManagementHubView } from './pages/ManagementHubView';
import { StudentPortalView } from './pages/StudentPortalView';
import { LoginView } from './pages/LoginView';
import { SetupWizardView } from './pages/SetupWizardView';
import { UsersView } from './pages/UsersView';
import { RolesPermissionsView } from './pages/RolesPermissionsView';
import { AuditLogView } from './pages/AuditLogView';
import { HostelManagementView } from './pages/HostelManagementView';
import { ReportsDataToolsView } from './pages/ReportsDataToolsView';
import { BackupRestoreView } from './pages/BackupRestoreView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { SessionUser } from '../../shared/types';

export const App: React.FC = () => {
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isStudentDemo, setIsStudentDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Check setup on boot
  useEffect(() => {
    const checkInit = async () => {
      try {
        if (window.desktopApi?.auth) {
          const res = await window.desktopApi.auth.checkSetup();
          if (res.success && res.data) {
            setSetupNeeded(res.data.setupNeeded);
          } else {
            setSetupNeeded(false);
          }
        } else {
          setSetupNeeded(false);
        }
      } catch (err) {
        console.error('Setup check error:', err);
        setSetupNeeded(false);
      }
    };
    checkInit();
  }, []);

  const handleSetupSuccess = (authToken: string, user: SessionUser) => {
    setSetupNeeded(false);
    setToken(authToken);
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLoginSuccess = (authToken: string, user: SessionUser) => {
    setToken(authToken);
    setCurrentUser(user);
    setIsStudentDemo(false);
    setActiveTab('dashboard');
  };

  const handleStudentPortalDemo = () => {
    setIsStudentDemo(true);
    setActiveTab('student-portal');
  };

  const handleLogout = async () => {
    if (token && window.desktopApi?.auth) {
      try {
        await window.desktopApi.auth.logout(token);
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setToken(null);
    setCurrentUser(null);
    setIsStudentDemo(false);
  };

  if (setupNeeded === null) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 items-center justify-center font-sans">
        <TitleBar />
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-textMuted font-medium">Initializing Institutional Security Environment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background font-sans">
      {/* Windows Frameless TitleBar */}
      <TitleBar onOpenSearch={currentUser ? () => setIsSearchModalOpen(true) : undefined} />

      {setupNeeded ? (
        <SetupWizardView onSetupSuccess={handleSetupSuccess} />
      ) : isStudentDemo ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeTab="student-portal"
            setActiveTab={(tab) => {
              if (tab !== 'student-portal') {
                setIsStudentDemo(false);
              }
              setActiveTab(tab);
            }}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-y-auto bg-background">
            <StudentPortalView token={token} />
          </main>
        </div>
      ) : !currentUser ? (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onStudentPortalDemo={handleStudentPortalDemo}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            onLogout={handleLogout}
            onChangePassword={() => setIsPasswordModalOpen(true)}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto bg-background">
            {activeTab === 'dashboard' && <DashboardView token={token || undefined} onNavigate={setActiveTab} />}
            {activeTab === 'hostels' && token && (
              <HostelManagementView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'residents' && token && (
              <ResidentsView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'rooms' && <RoomMatrixView />}
            {activeTab === 'hub' && token && (
              <ManagementHubView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'reports' && token && (
              <ReportsDataToolsView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'backup' && token && (
              <BackupRestoreView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'users' && token && (
              <UsersView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'roles' && token && (
              <RolesPermissionsView token={token} currentUser={currentUser} />
            )}
            {activeTab === 'audit' && token && <AuditLogView token={token} />}
            {activeTab === 'student-portal' && <StudentPortalView token={token} />}
          </main>
        </div>
      )}

      {/* Global Search Spotlight Modal (Ctrl+K) */}
      {currentUser && (
        <GlobalSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          token={token}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setIsSearchModalOpen(false);
          }}
        />
      )}

      {/* Password Change Modal for logged in user */}
      {isPasswordModalOpen && token && (
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          token={token}
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={() => setIsPasswordModalOpen(false)}
        />
      )}
    </div>
  );
};
