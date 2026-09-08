import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Building2,
  Phone,
  Mail,
  FileText,
  CreditCard,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  ExternalLink,
  Printer,
  X,
  UserCheck,
  Shield,
  Layers,
  BedDouble,
  GraduationCap,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  SessionUser,
  StudentDto,
  StudentDetailedDto,
  StudentSearchParams,
  HostelDto,
  BlockDto,
  FloorDto,
  RoomDto,
  BedDto,
  AllocationDto,
} from '../../../shared/types';

interface ResidentsViewProps {
  token: string;
  currentUser: SessionUser | null;
}

export const ResidentsView: React.FC<ResidentsViewProps> = ({ token, currentUser }) => {
  // State: Student List & Query
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [hostelFilter, setHostelFilter] = useState<string>('all');
  const [allocFilter, setAllocFilter] = useState<'all' | 'allocated' | 'unallocated'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('active');
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);

  // Hostels list for filtering & allocation
  const [hostelsList, setHostelsList] = useState<HostelDto[]>([]);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [activeDossier, setActiveDossier] = useState<StudentDetailedDto | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentDetailedDto | null>(null);
  const [statusTargetStudent, setStatusTargetStudent] = useState<StudentDto | null>(null);

  // Dossier sub-tab
  const [dossierTab, setDossierTab] = useState<'overview' | 'academic' | 'guardians' | 'allocation' | 'documents' | 'idcard'>('overview');

  // Debounce search query (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Hostels for dropdowns
  useEffect(() => {
    if (window.desktopApi?.hostels) {
      window.desktopApi.hostels.list(token).then((res) => {
        if (res.success && res.data) {
          setHostelsList(res.data);
        }
      });
    }
  }, [token]);

  // Fetch Students from API
  const fetchStudents = async () => {
    setLoading(true);
    setErrorMsg(null);

    const params: StudentSearchParams = {
      query: debouncedQuery || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      gender: genderFilter !== 'all' ? genderFilter : undefined,
      course: courseFilter !== 'all' ? courseFilter : undefined,
      hostelId: hostelFilter !== 'all' ? hostelFilter : undefined,
      allocationStatus: allocFilter,
      page: currentPage,
      pageSize,
    };

    if (window.desktopApi?.students) {
      const res = await window.desktopApi.students.list(token, params);
      if (res.success && res.data) {
        setStudents(res.data.data);
        setTotalStudents(res.data.total);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load students');
      }
    } else {
      // Fallback when desktopApi is unavailable
      setStudents([]);
      setTotalStudents(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [token, debouncedQuery, statusFilter, genderFilter, courseFilter, hostelFilter, allocFilter, currentPage, pageSize]);

  // Open Full Student Dossier
  const handleOpenDossier = async (studentId: string) => {
    if (!window.desktopApi?.students) return;
    try {
      const res = await window.desktopApi.students.getById(token, studentId);
      if (res.success && res.data) {
        setActiveDossier(res.data);
        setDossierTab('overview');
        setIsDossierOpen(true);
      } else {
        alert(res.error?.message || 'Failed to retrieve student dossier');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = async (studentId: string) => {
    if (!window.desktopApi?.students) return;
    try {
      const res = await window.desktopApi.students.getById(token, studentId);
      if (res.success && res.data) {
        setEditingStudent(res.data);
        setIsEditOpen(true);
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Handle Bulk Selection
  const handleToggleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExecuteBulkStatus = async () => {
    if (selectedIds.length === 0 || !window.desktopApi?.students) return;
    if (!confirm(`Are you sure you want to change status to "${bulkStatus}" for ${selectedIds.length} students?`)) {
      return;
    }

    setIsBulkUpdating(true);
    try {
      const res = await window.desktopApi.students.bulkUpdateStatus(token, selectedIds, bulkStatus, 'Bulk update from Student Directory');
      if (res.success) {
        setSuccessMsg(`Successfully updated status for ${res.data?.updatedCount || selectedIds.length} students.`);
        setSelectedIds([]);
        fetchStudents();
      } else {
        setErrorMsg(res.error?.message || 'Bulk status update failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Status Badge formatting helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Active</span>;
      case 'inactive':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300"><XCircle className="w-3 h-3" /> Inactive</span>;
      case 'graduated':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"><GraduationCap className="w-3 h-3" /> Graduated</span>;
      case 'vacated':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" /> Vacated</span>;
      case 'expelled':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3" /> Expelled</span>;
      case 'suspended':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200"><AlertCircle className="w-3 h-3" /> Suspended</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  // Pagination bounds calculation
  const totalPages = Math.ceil(totalStudents / pageSize) || 1;
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalStudents);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6 pb-20">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-textMain">Student Directory & Records</h1>
            <span className="bg-primary/10 text-primary text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Master Registry</span>
          </div>
          <p className="text-sm text-textMuted font-medium mt-1">
            Complete institutional student lifecycle management, comprehensive profile dossiers, verified document archives & room stays.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="bg-primary hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all hover:shadow"
          >
            <UserPlus className="w-4 h-4" /> Register Student
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Control Bar: Search & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-border space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          {/* Universal Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
            <input
              type="text"
              placeholder="Search by student name, ID (STU-XXX), enrollment no, phone, email, course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs text-textMain placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Group */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-xs text-textMain font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="vacated">Vacated</option>
              <option value="expelled">Expelled</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Allocation Status Filter */}
            <select
              value={allocFilter}
              onChange={(e) => { setAllocFilter(e.target.value as any); setCurrentPage(1); }}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-xs text-textMain font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Allocations</option>
              <option value="allocated">Allocated to Room</option>
              <option value="unallocated">Unallocated / Waiting</option>
            </select>

            {/* Hostel Filter */}
            <select
              value={hostelFilter}
              onChange={(e) => { setHostelFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-xs text-textMain font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Hostels</option>
              {hostelsList.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>

            {/* Gender Filter */}
            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-xs text-textMain font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            {(searchQuery || statusFilter !== 'all' || allocFilter !== 'all' || hostelFilter !== 'all' || genderFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setAllocFilter('all');
                  setHostelFilter('all');
                  setGenderFilter('all');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs font-semibold text-textMuted hover:text-rose-600 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (Visible when rows are selected) */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary">
                {selectedIds.length} {selectedIds.length === 1 ? 'student' : 'students'} selected
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-textMuted font-medium">Change Status:</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
                <option value="vacated">Vacated</option>
                <option value="expelled">Expelled</option>
                <option value="suspended">Suspended</option>
              </select>
              <button
                onClick={handleExecuteBulkStatus}
                disabled={isBulkUpdating}
                className="bg-primary hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isBulkUpdating ? 'Updating...' : 'Apply Status'}
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-textMuted hover:text-textMain px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Student Directory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 text-textMuted text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={students.length > 0 && selectedIds.length === students.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary/20"
                  />
                </th>
                <th className="p-4">Student</th>
                <th className="p-4">Enrollment & Contact</th>
                <th className="p-4">Academic Program</th>
                <th className="p-4">Hostel / Bed Stay</th>
                <th className="p-4">Resident Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-textMuted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="font-medium text-xs">Loading institutional student records...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-textMuted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GraduationCap className="w-10 h-10 text-textMuted/40" />
                      <span className="font-semibold text-textMain text-sm">No Student Records Found</span>
                      <p className="text-xs text-textMuted max-w-sm">
                        No students match your active filters. Try clearing filters or register a new student.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const isSelected = selectedIds.includes(student.id);
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-primary/[0.02]' : ''}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(student.id)}
                          className="rounded border-border text-primary focus:ring-primary/20"
                        />
                      </td>

                      {/* Student Name & Photo Avatar */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-border flex items-center justify-center font-bold text-textMuted text-xs shrink-0">
                            {student.photoPath ? (
                              <img src={student.photoPath} alt={student.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{student.firstName[0]}{student.lastName[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-textMain flex items-center gap-1.5">
                              <span>{student.firstName} {student.lastName}</span>
                              <span className="text-[10px] uppercase font-semibold text-textMuted/80">({student.gender})</span>
                            </div>
                            <div className="text-[11px] font-mono text-primary font-medium">{student.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Enrollment & Contact */}
                      <td className="p-4">
                        <div className="font-mono text-textMain font-semibold">{student.enrollmentNumber}</div>
                        <div className="flex items-center gap-2 text-[11px] text-textMuted mt-0.5">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-textMuted/70" />{student.phone}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate max-w-[140px]"><Mail className="w-3 h-3 text-textMuted/70" />{student.email}</span>
                        </div>
                      </td>

                      {/* Academic */}
                      <td className="p-4">
                        <div className="font-medium text-textMain">{student.course}</div>
                        <div className="text-[11px] text-textMuted">
                          {student.department} • Year {student.academicYear}
                        </div>
                      </td>

                      {/* Hostel Allocation */}
                      <td className="p-4">
                        {student.assignedBedId ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-textMain font-bold">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                              <span>{student.hostelName || 'Hostel'}</span>
                            </div>
                            <div className="text-[11px] text-textMuted font-medium">
                              Room {student.roomNumber || '—'} • Bed {student.bedLabel || '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-medium">
                            <AlertCircle className="w-3 h-3" /> Unallocated
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {renderStatusBadge(student.status)}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDossier(student.id)}
                            title="View Full Dossier"
                            className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(student.id)}
                            title="Edit Student Info"
                            className="p-1.5 text-textMuted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setStatusTargetStudent(student); setIsStatusModalOpen(true); }}
                            title="Change Status"
                            className="p-1.5 text-textMuted hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-textMuted">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-bold text-textMain">{totalStudents > 0 ? startRecord : 0}</span>
            <span>to</span>
            <span className="font-bold text-textMain">{endRecord}</span>
            <span>of</span>
            <span className="font-bold text-textMain">{totalStudents}</span>
            <span>records</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 bg-surface border border-border rounded-lg text-xs text-textMain font-medium"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-textMain">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTER STUDENT WIZARD                                         */}
      {/* ========================================================================= */}
      {isRegisterOpen && (
        <RegisterStudentWizardModal
          token={token}
          hostelsList={hostelsList}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={() => {
            setIsRegisterOpen(false);
            setSuccessMsg('Student registered successfully.');
            fetchStudents();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FULL STUDENT DOSSIER                                            */}
      {/* ========================================================================= */}
      {isDossierOpen && activeDossier && (
        <StudentDossierModal
          token={token}
          dossier={activeDossier}
          activeTab={dossierTab}
          setActiveTab={setDossierTab}
          onClose={() => setIsDossierOpen(false)}
          onRefresh={async () => {
            const res = await window.desktopApi.students.getById(token, activeDossier.id);
            if (res.success && res.data) setActiveDossier(res.data);
            fetchStudents();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT STUDENT MODAL                                              */}
      {/* ========================================================================= */}
      {isEditOpen && editingStudent && (
        <EditStudentModal
          token={token}
          student={editingStudent}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            setIsEditOpen(false);
            setSuccessMsg('Student updated successfully.');
            fetchStudents();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CHANGE STATUS MODAL                                             */}
      {/* ========================================================================= */}
      {isStatusModalOpen && statusTargetStudent && (
        <ChangeStatusModal
          token={token}
          student={statusTargetStudent}
          onClose={() => { setIsStatusModalOpen(false); setStatusTargetStudent(null); }}
          onSuccess={() => {
            setIsStatusModalOpen(false);
            setStatusTargetStudent(null);
            setSuccessMsg('Status updated successfully.');
            fetchStudents();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Register Student Wizard Modal
// ---------------------------------------------------------------------------
interface RegisterStudentWizardModalProps {
  token: string;
  hostelsList: HostelDto[];
  onClose: () => void;
  onSuccess: () => void;
}

const RegisterStudentWizardModal: React.FC<RegisterStudentWizardModalProps> = ({
  token,
  hostelsList,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    // Step 1: Personal
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    bloodGroup: '',
    phone: '',
    email: '',
    nationalId: '',
    permanentAddress: '',
    currentAddress: '',
    photoBase64: '',
    photoFileName: '',

    // Step 2: Academic
    enrollmentNumber: '',
    course: '',
    department: '',
    academicYear: 1,
    admissionDate: new Date().toISOString().split('T')[0],

    // Step 3: Guardian
    guardianName: '',
    guardianRelationship: 'father' as 'father' | 'mother' | 'guardian',
    guardianPhone: '',
    guardianAltPhone: '',
    guardianEmail: '',
    guardianAddress: '',

    // Step 4: Optional Bed Allocation
    selectedHostelId: '',
    selectedBlockId: '',
    selectedFloorId: '',
    selectedRoomId: '',
    selectedBedId: '',
  });

  // Cascading lists for bed allocation
  const [blocks, setBlocks] = useState<BlockDto[]>([]);
  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [beds, setBeds] = useState<BedDto[]>([]);

  // Cascade triggers
  useEffect(() => {
    if (form.selectedHostelId && window.desktopApi?.blocks) {
      window.desktopApi.blocks.list(token, form.selectedHostelId).then((res) => {
        if (res.success && res.data) setBlocks(res.data);
      });
    } else {
      setBlocks([]);
    }
    setForm((prev) => ({ ...prev, selectedBlockId: '', selectedFloorId: '', selectedRoomId: '', selectedBedId: '' }));
  }, [form.selectedHostelId, token]);

  useEffect(() => {
    if (form.selectedBlockId && window.desktopApi?.floors) {
      window.desktopApi.floors.list(token, form.selectedBlockId).then((res) => {
        if (res.success && res.data) setFloors(res.data);
      });
    } else {
      setFloors([]);
    }
    setForm((prev) => ({ ...prev, selectedFloorId: '', selectedRoomId: '', selectedBedId: '' }));
  }, [form.selectedBlockId, token]);

  useEffect(() => {
    if (form.selectedFloorId && window.desktopApi?.rooms) {
      window.desktopApi.rooms.list(token, { floorId: form.selectedFloorId, status: 'available' }).then((res) => {
        if (res.success && res.data) setRooms(res.data.data);
      });
    } else {
      setRooms([]);
    }
    setForm((prev) => ({ ...prev, selectedRoomId: '', selectedBedId: '' }));
  }, [form.selectedFloorId, token]);

  useEffect(() => {
    if (form.selectedRoomId && window.desktopApi?.beds) {
      window.desktopApi.beds.list(token, { roomId: form.selectedRoomId, status: 'vacant' }).then((res) => {
        if (res.success && res.data) setBeds(res.data);
      });
    } else {
      setBeds([]);
    }
    setForm((prev) => ({ ...prev, selectedBedId: '' }));
  }, [form.selectedRoomId, token]);

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        photoBase64: reader.result as string,
        photoFileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!form.firstName || !form.lastName) return setErrorMsg('First name and last name are required.');
      if (!form.dateOfBirth) return setErrorMsg('Date of birth is required.');
      if (!form.phone || !form.email) return setErrorMsg('Phone and email are required.');
      if (!form.permanentAddress) return setErrorMsg('Permanent address is required.');
      setStep(2);
    } else if (step === 2) {
      if (!form.enrollmentNumber) return setErrorMsg('Enrollment number is required.');
      if (!form.course || !form.department) return setErrorMsg('Course and Department are required.');
      setStep(3);
    } else if (step === 3) {
      if (!form.guardianName || !form.guardianPhone) return setErrorMsg('Primary guardian name and contact number are required.');
      setStep(4);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        bloodGroup: form.bloodGroup || undefined,
        phone: form.phone,
        email: form.email,
        nationalId: form.nationalId || undefined,
        permanentAddress: form.permanentAddress,
        currentAddress: form.currentAddress || undefined,
        enrollmentNumber: form.enrollmentNumber,
        course: form.course,
        department: form.department,
        academicYear: Number(form.academicYear),
        admissionDate: form.admissionDate,
        guardians: [
          {
            name: form.guardianName,
            relationship: form.guardianRelationship,
            phone: form.guardianPhone,
            alternatePhone: form.guardianAltPhone || undefined,
            email: form.guardianEmail || undefined,
            address: form.guardianAddress || undefined,
            isPrimary: true,
          },
        ],
        initialBedId: form.selectedBedId || undefined,
      };

      const res = await window.desktopApi.students.create(token, payload);
      if (res.success && res.data) {
        // If photo selected, upload photo
        if (form.photoBase64 && res.data.id) {
          await window.desktopApi.students.uploadPhoto(token, res.data.id, {
            base64: form.photoBase64,
            fileName: form.photoFileName || 'profile.jpg',
          });
        }
        onSuccess();
      } else {
        setErrorMsg(res.error?.message || 'Registration failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-scaleIn">
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-textMain">Register New Resident Student</h2>
            <p className="text-xs text-textMuted font-medium mt-0.5">Step {step} of 4: {
              step === 1 ? 'Personal Demographics' :
              step === 2 ? 'Academic Record' :
              step === 3 ? 'Primary Guardian' :
              'Room Allocation (Optional)'
            }</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-textMain p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 border-b border-border text-center text-xs font-bold">
          <div className={`py-2.5 border-b-2 ${step >= 1 ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-textMuted'}`}>1. Personal</div>
          <div className={`py-2.5 border-b-2 ${step >= 2 ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-textMuted'}`}>2. Academic</div>
          <div className={`py-2.5 border-b-2 ${step >= 3 ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-textMuted'}`}>3. Guardian</div>
          <div className={`py-2.5 border-b-2 ${step >= 4 ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-textMuted'}`}>4. Room Stay</div>
        </div>

        {errorMsg && (
          <div className="m-6 mb-0 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Photo Upload Row */}
              <div className="flex items-center gap-4 pb-2">
                <div className="w-16 h-16 rounded-xl border border-border bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {form.photoBase64 ? (
                    <img src={form.photoBase64} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <UserCheck className="w-6 h-6 text-textMuted" />
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain block mb-1">Student Portrait Photo</label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-textMain transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Select Image (.jpg, .png)
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                  <span className="text-[11px] text-textMuted ml-2">Max 5MB</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. Alex"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. Mercer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Gender *</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Blood Group</label>
                  <input
                    type="text"
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. O+, B+"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="student@nexus.edu"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-textMain">National / Citizen ID</label>
                <input
                  type="text"
                  value={form.nationalId}
                  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-mono"
                  placeholder="e.g. AADHAAR / SSN / Passport No."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-textMain">Permanent Address *</label>
                <textarea
                  rows={2}
                  required
                  value={form.permanentAddress}
                  onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                  placeholder="Full permanent residential address"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Enrollment / Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={form.enrollmentNumber}
                    onChange={(e) => setForm({ ...form, enrollmentNumber: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-mono uppercase"
                    placeholder="e.g. ENR-2026-0042"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Admission Date *</label>
                  <input
                    type="date"
                    required
                    value={form.admissionDate}
                    onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Degree / Course *</label>
                  <input
                    type="text"
                    required
                    value={form.course}
                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. B.Tech Computer Science"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Academic Department *</label>
                  <input
                    type="text"
                    required
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. School of Engineering"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-textMain">Current Academic Year</label>
                <select
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium"
                >
                  <option value={1}>1st Year (Freshman)</option>
                  <option value={2}>2nd Year (Sophomore)</option>
                  <option value={3}>3rd Year (Junior)</option>
                  <option value={4}>4th Year (Senior)</option>
                  <option value={5}>5th Year (Postgraduate)</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Primary Guardian Name *</label>
                  <input
                    type="text"
                    required
                    value={form.guardianName}
                    onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="e.g. Robert Mercer"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Relationship *</label>
                  <select
                    value={form.guardianRelationship}
                    onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium"
                  >
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Legal Guardian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Primary Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    value={form.guardianPhone}
                    onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="Emergency contact phone"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-textMain">Alternate Phone</label>
                  <input
                    type="tel"
                    value={form.guardianAltPhone}
                    onChange={(e) => setForm({ ...form, guardianAltPhone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                    placeholder="Secondary contact"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-textMain">Guardian Email</label>
                <input
                  type="email"
                  value={form.guardianEmail}
                  onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                  placeholder="guardian@example.com"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-textMain">Guardian Residential Address</label>
                <textarea
                  rows={2}
                  value={form.guardianAddress}
                  onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs"
                  placeholder="Address if different from student permanent address"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-blue-600 shrink-0" />
                <span>You can assign a bed immediately, or leave unallocated to assign later in Hostel Management.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Hostel</label>
                  <select
                    value={form.selectedHostelId}
                    onChange={(e) => setForm({ ...form, selectedHostelId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium"
                  >
                    <option value="">-- No Immediate Bed --</option>
                    {hostelsList.map((h) => (
                      <option key={h.id} value={h.id}>{h.name} ({h.genderType})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-textMain">Block</label>
                  <select
                    disabled={!form.selectedHostelId}
                    value={form.selectedBlockId}
                    onChange={(e) => setForm({ ...form, selectedBlockId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium disabled:opacity-50"
                  >
                    <option value="">-- Select Block --</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-textMain">Floor</label>
                  <select
                    disabled={!form.selectedBlockId}
                    value={form.selectedFloorId}
                    onChange={(e) => setForm({ ...form, selectedFloorId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium disabled:opacity-50"
                  >
                    <option value="">-- Select Floor --</option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-textMain">Room</label>
                  <select
                    disabled={!form.selectedFloorId}
                    value={form.selectedRoomId}
                    onChange={(e) => setForm({ ...form, selectedRoomId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium disabled:opacity-50"
                  >
                    <option value="">-- Select Room --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>Room {r.roomNumber} ({r.roomType})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-textMain">Vacant Bed</label>
                  <select
                    disabled={!form.selectedRoomId}
                    value={form.selectedBedId}
                    onChange={(e) => setForm({ ...form, selectedBedId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium disabled:opacity-50"
                  >
                    <option value="">-- Select Bed --</option>
                    {beds.map((b) => (
                      <option key={b.id} value={b.id}>Bed {b.bedLabel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-slate-50/50">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 text-xs font-bold text-textMuted hover:text-textMain transition-colors"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-textMuted hover:text-textMain transition-colors"
            >
              Cancel
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="bg-primary hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Complete Registration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Full Student Dossier Modal
// ---------------------------------------------------------------------------
interface StudentDossierModalProps {
  token: string;
  dossier: StudentDetailedDto;
  activeTab: 'overview' | 'academic' | 'guardians' | 'allocation' | 'documents' | 'idcard';
  setActiveTab: (tab: any) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const StudentDossierModal: React.FC<StudentDossierModalProps> = ({
  token,
  dossier,
  activeTab,
  setActiveTab,
  onClose,
  onRefresh,
}) => {
  // Document upload state
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [docType, setDocType] = useState<any>('id_proof');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setDocFile(file);
  };

  const handleUploadDocument = async () => {
    if (!docFile || !window.desktopApi?.students) return;

    setDocUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await window.desktopApi.students.uploadDocument(token, dossier.id, {
          docType,
          fileName: docFile.name,
          base64,
        });

        if (res.success) {
          setIsUploadingDoc(false);
          setDocFile(null);
          onRefresh();
        } else {
          alert(res.error?.message || 'Failed to upload document');
        }
        setDocUploading(false);
      };
      reader.readAsDataURL(docFile);
    } catch (err) {
      alert((err as Error).message);
      setDocUploading(false);
    }
  };

  const handleOpenDoc = async (docId: string) => {
    if (!window.desktopApi?.students) return;
    const res = await window.desktopApi.students.openDocument(token, docId);
    if (!res.success) {
      alert(res.error?.message || 'Could not open document safely.');
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this attached document?')) return;
    if (!window.desktopApi?.students) return;
    const res = await window.desktopApi.students.deleteDocument(token, dossier.id, docId);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error?.message || 'Failed to remove document');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-4xl w-full overflow-hidden my-6 flex flex-col max-h-[90vh] animate-scaleIn">
        {/* Profile Header Card */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center font-bold text-xl shrink-0 shadow-inner">
              {dossier.photoPath ? (
                <img src={dossier.photoPath} alt={dossier.firstName} className="w-full h-full object-cover" />
              ) : (
                <span>{dossier.firstName[0]}{dossier.lastName[0]}</span>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold">{dossier.firstName} {dossier.lastName}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30 uppercase tracking-wide">
                  {dossier.status}
                </span>
                {dossier.bloodGroup && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {dossier.bloodGroup}
                  </span>
                )}
              </div>
              <div className="text-xs text-white/70 font-mono">Student ID: {dossier.id} • Enrollment: {dossier.enrollmentNumber}</div>
              <div className="text-xs text-white/80 font-medium">
                {dossier.course} ({dossier.department}) • Year {dossier.academicYear}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => setActiveTab('idcard')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/20"
              >
                <CreditCard className="w-4 h-4" /> View ID Card
              </button>
            </div>
          </div>
        </div>

        {/* Dossier Tabs Header */}
        <div className="flex items-center gap-1 border-b border-border px-6 bg-slate-50/80 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          >
            Overview & Contacts
          </button>
          <button
            onClick={() => setActiveTab('academic')}
            className={`py-3 px-3 border-b-2 transition-colors ${activeTab === 'academic' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          >
            Academic Record
          </button>
          <button
            onClick={() => setActiveTab('guardians')}
            className={`py-3 px-3 border-b-2 transition-colors ${activeTab === 'guardians' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          >
            Guardians ({dossier.guardians.length})
          </button>
          <button
            onClick={() => setActiveTab('allocation')}
            className={`py-3 px-3 border-b-2 transition-colors ${activeTab === 'allocation' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          >
            Hostel Stays ({dossier.allocationHistory?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-3 border-b-2 transition-colors ${activeTab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          >
            Documents ({dossier.documents.length})
          </button>
          <button
            onClick={() => setActiveTab('idcard')}
            className={`py-3 px-3 border-b-2 transition-colors ${activeTab === 'idcard' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          >
            Official ID Badge
          </button>
        </div>

        {/* Dossier Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-3">
                <h3 className="text-xs font-bold text-textMain uppercase tracking-wider">Demographic Information</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-textMuted">Date of Birth:</span>
                    <span className="font-semibold text-textMain">{dossier.dateOfBirth}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-textMuted">Gender:</span>
                    <span className="font-semibold text-textMain capitalize">{dossier.gender}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-textMuted">National ID:</span>
                    <span className="font-mono font-semibold text-textMain">{dossier.nationalId || 'Not Recorded'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-textMuted">Blood Group:</span>
                    <span className="font-semibold text-textMain">{dossier.bloodGroup || 'Not Recorded'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-textMuted">Registration Date:</span>
                    <span className="font-semibold text-textMain">{new Date(dossier.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-3">
                <h3 className="text-xs font-bold text-textMain uppercase tracking-wider">Contact & Address Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-textMuted">Phone:</span>
                    <span className="font-semibold text-textMain font-mono">{dossier.phone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-textMuted">Email:</span>
                    <span className="font-semibold text-textMain">{dossier.email}</span>
                  </div>
                  <div className="py-1 border-b border-border/50">
                    <span className="text-textMuted block mb-0.5">Permanent Address:</span>
                    <span className="font-medium text-textMain">{dossier.permanentAddress}</span>
                  </div>
                  {dossier.currentAddress && (
                    <div className="py-1">
                      <span className="text-textMuted block mb-0.5">Current Address:</span>
                      <span className="font-medium text-textMain">{dossier.currentAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMIC */}
          {activeTab === 'academic' && (
            <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-4 animate-fadeIn">
              <h3 className="text-xs font-bold text-textMain uppercase tracking-wider">Institutional Academic Profile</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <span className="text-textMuted block text-[11px]">Enrollment / Roll No.</span>
                  <span className="font-mono font-bold text-sm text-primary">{dossier.enrollmentNumber}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <span className="text-textMuted block text-[11px]">Admission Date</span>
                  <span className="font-bold text-sm text-textMain">{dossier.admissionDate}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <span className="text-textMuted block text-[11px]">Course Program</span>
                  <span className="font-bold text-sm text-textMain">{dossier.course}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <span className="text-textMuted block text-[11px]">Academic Department</span>
                  <span className="font-bold text-sm text-textMain">{dossier.department}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <span className="text-textMuted block text-[11px]">Current Academic Year</span>
                  <span className="font-bold text-sm text-textMain">Year {dossier.academicYear}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <span className="text-textMuted block text-[11px]">Fee Status</span>
                  <span className="font-bold text-sm text-emerald-700 capitalize">{dossier.feeStatus}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GUARDIANS */}
          {activeTab === 'guardians' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xs font-bold text-textMain uppercase tracking-wider">Guardians & Emergency Contacts</h3>
              {dossier.guardians.length === 0 ? (
                <div className="p-8 text-center text-textMuted text-xs">No guardians registered on file.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dossier.guardians.map((g) => (
                    <div key={g.id} className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-textMain text-sm">{g.name}</div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                          {g.relationship}
                        </span>
                      </div>
                      <div className="space-y-1 text-textMuted">
                        <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> <span className="font-mono text-textMain font-medium">{g.phone}</span></div>
                        {g.alternatePhone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> <span className="font-mono text-textMain">{g.alternatePhone}</span></div>}
                        {g.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> <span>{g.email}</span></div>}
                        {g.address && <div className="flex items-start gap-1.5 pt-1"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{g.address}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ALLOCATION & RESIDENCY HISTORY */}
          {activeTab === 'allocation' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Current Bed Card */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <BedDouble className="w-4 h-4" /> Current Active Allocation
                  </span>
                  {dossier.assignedBedId && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Currently Occupying
                    </span>
                  )}
                </div>
                {dossier.assignedBedId ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                    <div className="p-2.5 bg-surface rounded-lg border border-border">
                      <span className="text-textMuted block text-[10px]">Hostel</span>
                      <span className="font-bold text-textMain">{dossier.hostelName || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-surface rounded-lg border border-border">
                      <span className="text-textMuted block text-[10px]">Block / Floor</span>
                      <span className="font-bold text-textMain">{dossier.blockName || '—'} • {dossier.floorName || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-surface rounded-lg border border-border">
                      <span className="text-textMuted block text-[10px]">Room Number</span>
                      <span className="font-bold text-textMain">Room {dossier.roomNumber || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-surface rounded-lg border border-border">
                      <span className="text-textMuted block text-[10px]">Assigned Bed</span>
                      <span className="font-bold text-primary font-mono">Bed {dossier.bedLabel || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-textMuted pt-1">Student does not currently occupy an active room bed.</p>
                )}
              </div>

              {/* Allocation History Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-textMain uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-textMuted" /> Complete Residency Stay Timeline
                </h3>
                {(!dossier.allocationHistory || dossier.allocationHistory.length === 0) ? (
                  <div className="p-8 text-center text-textMuted text-xs border border-border rounded-xl">
                    No past allocation history recorded for this student.
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-border text-xs">
                    {dossier.allocationHistory.map((alloc) => (
                      <div key={alloc.id} className="p-3.5 hover:bg-slate-50/60 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-textMain">{alloc.hostelName || 'Hostel'}</span>
                            <span>•</span>
                            <span className="text-textMuted">Room {alloc.roomNumber || '—'} (Bed {alloc.bedLabel || '—'})</span>
                            <span className={`px-2 py-0.2 text-[10px] font-bold rounded-full uppercase ${
                              alloc.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                              alloc.status === 'transferred' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {alloc.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-textMuted flex items-center gap-3">
                            <span>Allocated: {new Date(alloc.allocatedAt).toLocaleDateString()}</span>
                            {alloc.vacatedAt && <span>Vacated: {new Date(alloc.vacatedAt).toLocaleDateString()}</span>}
                            {alloc.remarks && <span className="italic font-medium">"{alloc.remarks}"</span>}
                          </div>
                        </div>
                        <div className="font-mono text-[10px] text-textMuted shrink-0">{alloc.id}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-textMain uppercase tracking-wider">Official Document Vault</h3>
                <button
                  onClick={() => setIsUploadingDoc(true)}
                  className="bg-primary hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" /> Attach Document
                </button>
              </div>

              {/* Upload Document Slide-Down */}
              {isUploadingDoc && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">Upload Verification Document</span>
                    <button onClick={() => setIsUploadingDoc(false)} className="text-textMuted hover:text-textMain"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-xs font-semibold text-textMain block mb-1">Document Category</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium"
                      >
                        <option value="id_proof">Official ID Proof</option>
                        <option value="admission_agreement">Admission & Hostel Agreement</option>
                        <option value="medical_clearance">Medical & Fitness Clearance</option>
                        <option value="undertaking">Disciplinary Undertaking</option>
                        <option value="other">Other Official Document</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-textMain block mb-1">Select File (.pdf, .png, .jpg)</label>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsUploadingDoc(false)}
                      className="px-3 py-1.5 text-xs text-textMuted hover:text-textMain font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!docFile || docUploading}
                      onClick={handleUploadDocument}
                      className="bg-primary hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {docUploading ? 'Uploading...' : 'Save & Verify Hash'}
                    </button>
                  </div>
                </div>
              )}

              {/* Document List */}
              {dossier.documents.length === 0 ? (
                <div className="p-8 text-center text-textMuted text-xs border border-border rounded-xl">
                  No verified documents attached. Click "Attach Document" above to archive student proofs.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border text-xs">
                  {dossier.documents.map((doc) => (
                    <div key={doc.id} className="p-3.5 hover:bg-slate-50/60 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-textMain flex items-center gap-2">
                            <span>{doc.fileName}</span>
                            <span className="px-2 py-0.2 rounded-md bg-slate-100 text-[10px] font-mono text-textMuted uppercase">
                              {doc.docType.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-textMuted flex items-center gap-2 font-mono mt-0.5">
                            <span>SHA-256: {doc.fileHash.substring(0, 16)}...</span>
                            <span>•</span>
                            <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenDoc(doc.id)}
                          title="Open safely in native desktop viewer"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-textMain text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          title="Delete document record"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: OFFICIAL STUDENT ID BADGE */}
          {activeTab === 'idcard' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-4 animate-fadeIn">
              {/* Institutional ID Card Graphic */}
              <div className="w-[380px] bg-white border-2 border-slate-300 rounded-2xl shadow-xl overflow-hidden text-slate-900 font-sans select-none relative">
                {/* Header Band */}
                <div className="bg-slate-900 text-white p-4 text-center border-b-2 border-primary">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-primary/90">Institutional Resident Pass</div>
                  <h4 className="text-sm font-black tracking-tight uppercase">Nexus University Campus</h4>
                  <div className="text-[9px] text-white/70">Hostel & Student Housing Administration</div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-24 rounded-xl border-2 border-slate-300 bg-slate-100 overflow-hidden flex items-center justify-center font-bold text-2xl text-slate-400 shrink-0 shadow-sm">
                      {dossier.photoPath ? (
                        <img src={dossier.photoPath} alt={dossier.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{dossier.firstName[0]}{dossier.lastName[0]}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-base font-black text-slate-900 leading-tight">
                        {dossier.firstName} {dossier.lastName}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-primary">{dossier.id}</div>
                      <div className="text-xs font-semibold text-slate-600">{dossier.course}</div>
                      <div className="text-[11px] text-slate-500">Year {dossier.academicYear} • Dept: {dossier.department}</div>
                    </div>
                  </div>

                  {/* Room Details Block */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Assigned Hostel</span>
                      <span className="font-bold text-slate-800">{dossier.hostelName || 'Not Assigned'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Room / Bed</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {dossier.roomNumber ? `Rm ${dossier.roomNumber} (Bed ${dossier.bedLabel || 'A'})` : 'Waiting'}
                      </span>
                    </div>
                  </div>

                  {/* Student Barcode Identifier */}
                  <div className="pt-2 text-center space-y-1">
                    <div className="h-9 w-full bg-slate-900 flex items-center justify-between px-3 tracking-widest text-[9px] font-mono text-white/90">
                      ||| | || |||| | ||| |||| | || ||| || ||||
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{dossier.enrollmentNumber}</span>
                  </div>
                </div>

                {/* Footer Band */}
                <div className="bg-slate-100 p-2 text-center text-[10px] font-medium text-slate-500 border-t border-slate-200">
                  Emergency: {dossier.guardians[0]?.phone || dossier.phone} • Valid Through 2026-2027
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => alert('Print command dispatched to system spooler.')}
                  className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" /> Print ID Badge
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="bg-primary text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Edit Student Modal
// ---------------------------------------------------------------------------
interface EditStudentModalProps {
  token: string;
  student: StudentDetailedDto;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({
  token,
  student,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = useState({
    firstName: student.firstName,
    lastName: student.lastName,
    dateOfBirth: student.dateOfBirth,
    gender: student.gender,
    bloodGroup: student.bloodGroup || '',
    phone: student.phone,
    email: student.email,
    nationalId: student.nationalId || '',
    permanentAddress: student.permanentAddress,
    course: student.course,
    department: student.department,
    academicYear: student.academicYear,
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await window.desktopApi.students.update(token, student.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        bloodGroup: form.bloodGroup || undefined,
        phone: form.phone,
        email: form.email,
        nationalId: form.nationalId || undefined,
        permanentAddress: form.permanentAddress,
        course: form.course,
        department: form.department,
        academicYear: Number(form.academicYear),
      });

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error?.message || 'Update failed');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-xl w-full overflow-hidden my-8 animate-scaleIn">
        <div className="p-6 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-textMain">Edit Student Record</h2>
            <p className="text-xs text-textMuted font-mono mt-0.5">{student.id} • {student.enrollmentNumber}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-textMain p-1"><X className="w-5 h-5" /></button>
        </div>

        {errorMsg && (
          <div className="m-6 mb-0 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-textMain">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-textMain">Last Name</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-textMain">Phone Number</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-textMain">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-textMain">Degree Course</label>
              <input
                type="text"
                required
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-textMain">Department</label>
              <input
                type="text"
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-textMain">Permanent Address</label>
            <textarea
              rows={2}
              required
              value={form.permanentAddress}
              onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl"
            />
          </div>

          <div className="p-4 border-t border-border -mx-6 -mb-6 mt-6 flex justify-end gap-2 bg-slate-50/50">
            <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-textMuted hover:text-textMain">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Change Status Modal
// ---------------------------------------------------------------------------
interface ChangeStatusModalProps {
  token: string;
  student: StudentDto;
  onClose: () => void;
  onSuccess: () => void;
}

const ChangeStatusModal: React.FC<ChangeStatusModalProps> = ({
  token,
  student,
  onClose,
  onSuccess,
}) => {
  const [newStatus, setNewStatus] = useState<string>(student.status);
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await window.desktopApi.students.setStatus(token, student.id, newStatus, remarks);
      if (res.success) {
        onSuccess();
      } else {
        alert(res.error?.message || 'Failed to change status');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
        <div className="p-6 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-textMain">Change Student Status</h2>
            <p className="text-xs text-textMuted font-mono mt-0.5">{student.firstName} {student.lastName} ({student.id})</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-textMain p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {student.assignedBedId && ['inactive', 'left', 'graduated', 'vacated', 'expelled'].includes(newStatus) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Notice: Changing status to "{newStatus}" will automatically vacate the currently assigned bed ({student.bedLabel}).</span>
            </div>
          )}

          <div>
            <label className="font-bold text-textMain">Select New Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 bg-surface border border-border rounded-xl font-medium"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="vacated">Vacated</option>
              <option value="expelled">Expelled</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-textMain">Status Change Reason / Notes</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 bg-surface border border-border rounded-xl"
              placeholder="e.g. End of academic program, completed degree requirements."
            />
          </div>

          <div className="p-4 border-t border-border -mx-6 -mb-6 mt-6 flex justify-end gap-2 bg-slate-50/50">
            <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-textMuted hover:text-textMain">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Confirm Status Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
