import React, { useEffect, useState } from 'react';
import { Minus, Square, X, ShieldCheck, Building2, Search } from 'lucide-react';
import { AppInfo } from '../../../shared/types';

interface TitleBarProps {
  onOpenSearch?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenSearch }) => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (window.desktopApi?.app?.getInfo) {
      window.desktopApi.app.getInfo().then((res) => {
        if (res.success) setAppInfo(res.data);
      });
    }
  }, []);

  const handleMinimize = () => window.desktopApi?.app?.minimize();
  const handleMaximize = () => window.desktopApi?.app?.maximize();
  const handleClose = () => window.desktopApi?.app?.close();

  return (
    <header className="h-10 bg-slate-900 text-slate-200 flex items-center justify-between px-3 select-none titlebar-drag-region border-b border-slate-800 shrink-0 z-50">
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold tracking-wider text-slate-100">
          NEXUS ENTERPRISE
        </span>
        <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
          v{appInfo?.version || '1.0.0'}
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-[10px] font-medium ml-2">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>100% Offline Database Ready</span>
        </div>
      </div>

      {/* Global Search Spotlight Trigger */}
      {onOpenSearch && (
        <div className="titlebar-no-drag hidden sm:flex items-center">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-xs transition-colors shadow-xs"
            title="Global Search across 11 database entities (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium text-[11px]">Search Database...</span>
            <kbd className="text-[9px] bg-slate-900/90 border border-slate-700 px-1 py-0.5 rounded text-slate-400 font-mono font-bold">
              Ctrl+K
            </kbd>
          </button>
        </div>
      )}

      <div className="flex items-center titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
