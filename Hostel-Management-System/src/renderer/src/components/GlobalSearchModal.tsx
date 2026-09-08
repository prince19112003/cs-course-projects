import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  GraduationCap,
  Building2,
  DoorClosed,
  UserCheck,
  AlertCircle,
  Clock,
  DollarSign,
  Bell,
  Package,
  ArrowRight,
  Loader2,
  Layers,
} from 'lucide-react';
import { GlobalSearchResultItem } from '../../../shared/types';
import { ActiveTab } from './Sidebar';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  onNavigate?: (tab: ActiveTab, targetId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  token,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResultItem[]>([]);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setTookMs(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle Ctrl+K shortcut globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced live search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTookMs(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (!token && !window.desktopApi?.search) return;
      setLoading(true);
      try {
        const res = await window.desktopApi.search.global(token || 'guest', query.trim());
        if (res.success && res.data) {
          setResults(res.data.items);
          setTookMs(res.data.tookMs);
          setSelectedIndex(0);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Global search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, token]);

  const handleSelect = (item: GlobalSearchResultItem) => {
    if (!onNavigate) return;
    switch (item.entityType) {
      case 'student':
        onNavigate('residents', item.id);
        break;
      case 'hostel':
      case 'block':
      case 'floor':
      case 'bed':
        onNavigate('hostels', item.id);
        break;
      case 'room':
        onNavigate('rooms', item.id);
        break;
      case 'complaint':
      case 'visitor':
      case 'staff':
      case 'notice':
      case 'asset':
        onNavigate('hub', item.id);
        break;
      case 'fee':
        onNavigate('hub', item.id);
        break;
      default:
        onNavigate('dashboard');
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case 'hostel':
      case 'block':
        return <Building2 className="w-4 h-4 text-indigo-600" />;
      case 'room':
      case 'bed':
        return <DoorClosed className="w-4 h-4 text-emerald-600" />;
      case 'staff':
        return <UserCheck className="w-4 h-4 text-violet-600" />;
      case 'complaint':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'visitor':
        return <Clock className="w-4 h-4 text-teal-600" />;
      case 'fee':
        return <DollarSign className="w-4 h-4 text-green-600" />;
      case 'notice':
        return <Bell className="w-4 h-4 text-red-600" />;
      case 'asset':
        return <Package className="w-4 h-4 text-orange-600" />;
      default:
        return <Layers className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEntityBadgeColor = (type: string) => {
    switch (type) {
      case 'student':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'hostel':
      case 'block':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'room':
      case 'bed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'staff':
        return 'bg-violet-100 text-violet-800 border-violet-200';
      case 'complaint':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'visitor':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'fee':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'notice':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'asset':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-border bg-slate-50/70">
          <Search className="w-5 h-5 text-textMuted mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search students, rooms, hostels, complaints, staff, fees, notices..."
            className="flex-1 bg-transparent border-0 outline-none text-sm text-textMain placeholder:text-textMuted font-medium"
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin mr-2" />}
          {tookMs !== null && (
            <span className="text-[11px] font-mono text-textMuted px-2 py-0.5 rounded bg-slate-200/70 mr-2">
              {tookMs}ms
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-textMuted hover:text-textMain transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border/40">
          {query.trim().length === 0 ? (
            <div className="p-8 text-center text-textMuted space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mx-auto border border-blue-100">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-textMain">Instant Parameterized Search</p>
              <p className="text-xs max-w-md mx-auto">
                Type any keyword, student name, roll number, room code, complaint title, or staff role. Search runs across 11 indexed database entities in sub-15ms.
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-textMuted">
              <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1">Try a different name, room code, enrollment number, or keyword.</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.entityType}-${item.id}-${idx}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/80 border border-blue-200/80 text-primary'
                      : 'hover:bg-slate-50 text-textMain'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-surface border border-border shadow-xs shrink-0">
                      {getEntityIcon(item.entityType)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs tracking-tight text-textMain truncate">
                          {item.title}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${getEntityBadgeColor(
                            item.entityType
                          )}`}
                        >
                          {item.entityType}
                        </span>
                        {item.status && (
                          <span className="text-[9px] font-medium bg-slate-100 text-slate-700 px-1 rounded">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-textMuted truncate mt-0.5 font-medium">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    <span className="text-[10px] text-textMuted font-mono hidden sm:inline">
                      Jump
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-border flex items-center justify-between text-[11px] text-textMuted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-slate-700 font-mono text-[10px]">
                ↑
              </kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-slate-700 font-mono text-[10px]">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-slate-700 font-mono text-[10px]">
                Enter
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-slate-700 font-mono text-[10px]">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
          <span className="font-mono text-[10px]">Indexed SQLite Engine</span>
        </div>
      </div>
    </div>
  );
};
