import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  DoorClosed,
  BedDouble,
  UserCheck,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRightLeft,
  LogOut,
  History,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import {
  HostelDto,
  BlockDto,
  FloorDto,
  RoomDto,
  BedDto,
  AllocationDto,
  OccupancyMetricsDto,
  SessionUser,
} from '../../../shared/types';

interface HostelManagementViewProps {
  token: string;
  currentUser: SessionUser;
}

type SubTab = 'hostels' | 'blocks' | 'floors' | 'rooms' | 'beds' | 'allocations';

export const HostelManagementView: React.FC<HostelManagementViewProps> = ({
  token,
  currentUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('hostels');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data lists
  const [hostels, setHostels] = useState<HostelDto[]>([]);
  const [blocks, setBlocks] = useState<BlockDto[]>([]);
  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [beds, setBeds] = useState<BedDto[]>([]);
  const [allocations, setAllocations] = useState<AllocationDto[]>([]);
  const [campusStats, setCampusStats] = useState<OccupancyMetricsDto | null>(null);

  // Filters
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [isHostelModalOpen, setIsHostelModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isVacateModalOpen, setIsVacateModalOpen] = useState(false);

  // Form states
  const [hostelForm, setHostelForm] = useState({ name: '', code: '', genderType: 'boys' as const, totalCapacity: 100 });
  const [blockForm, setBlockForm] = useState({ hostelId: '', name: '', code: '', totalFloors: 3 });
  const [floorForm, setFloorForm] = useState({ blockId: '', floorNumber: 1, name: '1st Floor' });
  const [roomForm, setRoomForm] = useState({
    floorId: '',
    roomNumber: '',
    capacity: 2,
    roomType: 'double' as const,
    acType: 'non_ac' as const,
    monthlyRent: 400000,
  });
  const [bedForm, setBedForm] = useState({ roomId: '', bedLabel: 'Bed 1' });

  // Allocation & Transfer states
  const [devStudents, setDevStudents] = useState<Array<{ id: string; name: string; enrollmentNumber: string; isAllocated: boolean }>>([]);
  const [allocStudentId, setAllocStudentId] = useState('');
  const [allocBedId, setAllocBedId] = useState('');
  const [allocRemarks, setAllocRemarks] = useState('');

  const [selectedAllocForAction, setSelectedAllocForAction] = useState<AllocationDto | null>(null);
  const [transferDestBedId, setTransferDestBedId] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [vacateRemarks, setVacateRemarks] = useState('');

  // --------------------------------------------------------------------------
  // Fetch Functions
  // --------------------------------------------------------------------------
  const fetchAllData = async () => {
    setLoading(true);
    try {
      if (!window.desktopApi) return;

      // 1. Hostels
      const hRes = await window.desktopApi.hostels.list(token, true);
      if (hRes.success && hRes.data) {
        setHostels(hRes.data);
        if (!selectedHostelId && hRes.data.length > 0) {
          setSelectedHostelId(hRes.data[0].id);
        }
      }

      // 2. Blocks
      const bRes = await window.desktopApi.blocks.list(token, selectedHostelId || undefined, true);
      if (bRes.success && bRes.data) {
        setBlocks(bRes.data);
      }

      // 3. Floors
      const fRes = await window.desktopApi.floors.list(token, selectedBlockId || undefined, true);
      if (fRes.success && fRes.data) {
        setFloors(fRes.data);
      }

      // 4. Rooms
      const rRes = await window.desktopApi.rooms.list(token, {
        hostelId: selectedHostelId || undefined,
        blockId: selectedBlockId || undefined,
        floorId: selectedFloorId || undefined,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      if (rRes.success && rRes.data) {
        setRooms(rRes.data.data);
      }

      // 5. Beds
      const bdRes = await window.desktopApi.beds.list(token, {
        roomId: selectedRoomId || undefined,
      });
      if (bdRes.success && bdRes.data) {
        setBeds(bdRes.data);
      }

      // 6. Allocations
      const aRes = await window.desktopApi.allocations.list(token, {
        hostelId: selectedHostelId || undefined,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      if (aRes.success && aRes.data) {
        setAllocations(aRes.data.data);
      }

      // 7. Occupancy Stats
      const occRes = await window.desktopApi.occupancy.getCampus(token);
      if (occRes.success && occRes.data) {
        setCampusStats(occRes.data);
      }

      // 8. Registered Students for room allocation
      const dsRes = await window.desktopApi.allocations.getDevStudents(token);
      if (dsRes.success && dsRes.data) {
        setDevStudents(dsRes.data);
      }
    } catch (err: any) {
      console.error('Failed fetching infrastructure data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [activeSubTab, selectedHostelId, selectedBlockId, selectedFloorId, selectedRoomId, statusFilter]);

  // --------------------------------------------------------------------------
  // Action Handlers
  // --------------------------------------------------------------------------
  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.desktopApi.hostels.create(token, hostelForm);
      if (res.success) {
        setNotification({ type: 'success', message: `Hostel ${hostelForm.name} created successfully.` });
        setIsHostelModalOpen(false);
        setHostelForm({ name: '', code: '', genderType: 'boys', totalCapacity: 100 });
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to create hostel.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleToggleHostel = async (id: string, isActive: boolean) => {
    try {
      const res = await window.desktopApi.hostels.toggleStatus(token, id, isActive);
      if (res.success) {
        setNotification({ type: 'success', message: `Hostel status set to ${isActive ? 'Active' : 'Inactive'}.` });
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to update hostel.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.desktopApi.blocks.create(token, {
        ...blockForm,
        hostelId: blockForm.hostelId || selectedHostelId || hostels[0]?.id,
      });
      if (res.success) {
        setNotification({ type: 'success', message: `Block ${blockForm.name} created successfully.` });
        setIsBlockModalOpen(false);
        setBlockForm({ hostelId: '', name: '', code: '', totalFloors: 3 });
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to create block.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.desktopApi.floors.create(token, {
        ...floorForm,
        blockId: floorForm.blockId || selectedBlockId || blocks[0]?.id,
      });
      if (res.success) {
        setNotification({ type: 'success', message: `Floor ${floorForm.name} created successfully.` });
        setIsFloorModalOpen(false);
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to create floor.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.desktopApi.rooms.create(token, {
        ...roomForm,
        floorId: roomForm.floorId || selectedFloorId || floors[0]?.id,
      });
      if (res.success) {
        setNotification({ type: 'success', message: `Room ${roomForm.roomNumber} created successfully.` });
        setIsRoomModalOpen(false);
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to create room.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.desktopApi.beds.create(token, {
        ...bedForm,
        roomId: bedForm.roomId || selectedRoomId || rooms[0]?.id,
      });
      if (res.success) {
        setNotification({ type: 'success', message: `Bed ${bedForm.bedLabel} added successfully.` });
        setIsBedModalOpen(false);
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to add bed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleAllocateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.desktopApi.allocations.create(token, {
        studentId: allocStudentId,
        bedId: allocBedId,
        remarks: allocRemarks,
      });
      if (res.success) {
        setNotification({ type: 'success', message: 'Bed allocated successfully.' });
        setIsAllocateModalOpen(false);
        setAllocStudentId('');
        setAllocBedId('');
        setAllocRemarks('');
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Allocation failed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleTransferBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllocForAction) return;
    try {
      const res = await window.desktopApi.allocations.transfer(token, {
        studentId: selectedAllocForAction.studentId,
        destinationBedId: transferDestBedId,
        remarks: transferRemarks,
      });
      if (res.success) {
        setNotification({ type: 'success', message: 'Bed transfer completed successfully.' });
        setIsTransferModalOpen(false);
        setTransferDestBedId('');
        setTransferRemarks('');
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Transfer failed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleVacateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllocForAction) return;
    try {
      const res = await window.desktopApi.allocations.vacate(token, {
        allocationId: selectedAllocForAction.id,
        remarks: vacateRemarks,
      });
      if (res.success) {
        setNotification({ type: 'success', message: 'Bed vacated successfully.' });
        setIsVacateModalOpen(false);
        setVacateRemarks('');
        fetchAllData();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Vacate failed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const vacantBedsList = beds.filter((b) => b.status === 'vacant' && b.isArchived === 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-20 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-primary" />
            Hostel Structure & Bed Allocations
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Configure institutional residential buildings, blocks, floors, rooms, beds, and manage ACID resident allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="p-2 border border-border bg-white rounded-xl text-slate-600 hover:bg-slate-50 transition-all"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {activeSubTab === 'hostels' && (
            <button
              onClick={() => setIsHostelModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Hostel</span>
            </button>
          )}
          {activeSubTab === 'blocks' && (
            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Block / Wing</span>
            </button>
          )}
          {activeSubTab === 'floors' && (
            <button
              onClick={() => setIsFloorModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Floor</span>
            </button>
          )}
          {activeSubTab === 'rooms' && (
            <button
              onClick={() => setIsRoomModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </button>
          )}
          {activeSubTab === 'beds' && (
            <button
              onClick={() => setIsBedModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bed</span>
            </button>
          )}
          {activeSubTab === 'allocations' && (
            <button
              onClick={() => setIsAllocateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>New Bed Allocation</span>
            </button>
          )}
        </div>
      </div>

      {/* Campus Occupancy Metric Cards */}
      {campusStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-bold text-textMuted uppercase tracking-wider">Total Hostels / Rooms</div>
            <div className="text-xl font-bold text-textMain mt-1">
              {campusStats.totalHostels || hostels.length} Hostels <span className="text-slate-400 text-sm font-normal">/ {campusStats.totalRooms} Rooms</span>
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-bold text-textMuted uppercase tracking-wider">Total Bed Capacity</div>
            <div className="text-xl font-bold text-primary mt-1">
              {campusStats.totalBeds} <span className="text-slate-400 text-xs font-normal">berths configured</span>
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-bold text-textMuted uppercase tracking-wider">Occupied vs Available</div>
            <div className="text-xl font-bold text-emerald-600 mt-1 flex items-center gap-2">
              <span>{campusStats.occupiedBeds} Occupied</span>
              <span className="text-slate-400 text-xs font-normal">/ {campusStats.vacantBeds} Free</span>
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-bold text-textMuted uppercase tracking-wider">Occupancy Rate</div>
            <div className="text-xl font-bold text-indigo-600 mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              <span>{campusStats.occupancyPercentage}%</span>
            </div>
          </div>
        </div>
      )}

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
          <button onClick={() => setNotification(null)} className="font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
        {[
          { id: 'hostels', label: 'Hostels', count: hostels.length, icon: Building2 },
          { id: 'blocks', label: 'Blocks / Wings', count: blocks.length, icon: Layers },
          { id: 'floors', label: 'Floors', count: floors.length, icon: Layers },
          { id: 'rooms', label: 'Rooms', count: rooms.length, icon: DoorClosed },
          { id: 'beds', label: 'Beds', count: beds.length, icon: BedDouble },
          { id: 'allocations', label: 'Allocations & History', count: allocations.length, icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: HOSTELS */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'hostels' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hostels.map((h) => (
              <div
                key={h.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm space-y-3 transition-all ${
                  h.isActive ? 'border-border' : 'border-red-200 bg-red-50/20 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] text-primary font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {h.code}
                    </span>
                    <h3 className="font-bold text-sm text-textMain mt-1.5">{h.name}</h3>
                    <p className="text-[11px] text-textMuted capitalize">Category: {h.genderType} Hostel</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      h.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {h.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-textMuted">Max Capacity: <b className="text-slate-800">{h.totalCapacity}</b></span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleHostel(h.id, !h.isActive)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        h.isActive
                          ? 'border-red-200 text-red-700 hover:bg-red-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {h.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: BLOCKS */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'blocks' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Filter by Hostel:</span>
            <select
              value={selectedHostelId}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              className="border border-border rounded-xl py-1.5 px-3 text-xs outline-none bg-white text-slate-800"
            >
              <option value="">All Hostels</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Block ID / Code</th>
                  <th className="py-3 px-4">Block / Wing Name</th>
                  <th className="py-3 px-4">Parent Hostel</th>
                  <th className="py-3 px-4">Floors</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blocks.map((b) => {
                  const parent = hostels.find((h) => h.id === b.hostelId);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">{b.code} ({b.id})</td>
                      <td className="py-3.5 px-4 font-bold text-textMain">{b.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{parent?.name || b.hostelId}</td>
                      <td className="py-3.5 px-4">{b.totalFloors} Floors</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: FLOORS */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'floors' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Filter by Block:</span>
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="border border-border rounded-xl py-1.5 px-3 text-xs outline-none bg-white text-slate-800"
            >
              <option value="">All Blocks</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Floor ID</th>
                  <th className="py-3 px-4">Floor Level</th>
                  <th className="py-3 px-4">Display Name</th>
                  <th className="py-3 px-4">Parent Block</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {floors.map((f) => {
                  const parentBlock = blocks.find((b) => b.id === f.blockId);
                  return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600">{f.id}</td>
                      <td className="py-3.5 px-4 font-bold text-primary">Level {f.floorNumber}</td>
                      <td className="py-3.5 px-4 font-semibold text-textMain">{f.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{parentBlock?.name || f.blockId}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {f.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: ROOMS */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'rooms' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search room number..."
                className="border border-border rounded-xl py-1.5 px-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-border rounded-xl py-1.5 px-3 text-xs outline-none bg-white text-slate-800"
              >
                <option value="">All Statuses</option>
                <option value="available">Available</option>
                <option value="full">Full</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rooms.map((r) => (
              <div key={r.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-base font-bold text-textMain">{r.roomNumber}</span>
                    <span className="text-[10px] ml-2 uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {r.roomType}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'available'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : r.status === 'full'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-textMuted space-y-1">
                  <div className="flex justify-between">
                    <span>Rated Capacity:</span>
                    <b className="text-slate-800">{r.capacity} Bed(s)</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Climate:</span>
                    <span className="uppercase text-[10px] font-bold text-slate-700">{r.acType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly Rate:</span>
                    <span className="font-mono text-slate-700 font-bold">${(r.monthlyRent / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 5: BEDS */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'beds' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bed ID</th>
                  <th className="py-3 px-4">Bed Label / Name</th>
                  <th className="py-3 px-4">Room ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {beds.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-500">{b.id}</td>
                    <td className="py-3.5 px-4 font-sans font-bold text-textMain">{b.bedLabel}</td>
                    <td className="py-3.5 px-4 text-primary font-bold">{b.roomId}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-sans px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'vacant'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : b.status === 'occupied'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {b.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {b.status === 'vacant' && (
                        <button
                          onClick={() => {
                            setAllocBedId(b.id);
                            setIsAllocateModalOpen(true);
                          }}
                          className="font-sans text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100"
                        >
                          Allocate Bed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 6: ALLOCATIONS & HISTORY */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'allocations' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resident or room..."
                className="border border-border rounded-xl py-1.5 px-3 text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-border rounded-xl py-1.5 px-3 text-xs outline-none bg-white text-slate-800"
              >
                <option value="">All Records</option>
                <option value="active">Active Residents Only</option>
                <option value="transferred">Transferred</option>
                <option value="vacated">Vacated</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Resident Name / Enrollment</th>
                  <th className="py-3 px-4">Bed & Room Location</th>
                  <th className="py-3 px-4">Hostel / Wing</th>
                  <th className="py-3 px-4">Allocated Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-textMain">{a.studentName || a.studentId}</div>
                      <div className="font-mono text-[11px] text-slate-400">{a.enrollmentNumber || a.studentId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-primary font-mono">{a.roomNumber ? `Room ${a.roomNumber}` : a.bedId}</span>
                      <span className="text-[11px] text-slate-500 block">({a.bedLabel || 'Bed'})</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{a.hostelName || 'Hostel'}</div>
                      <div className="text-[11px] text-slate-400">{a.blockName || 'Block'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(a.allocatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          a.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'transferred'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {a.status === 'active' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedAllocForAction(a);
                              setIsTransferModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Transfer</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAllocForAction(a);
                              setIsVacateModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Vacate</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE HOSTEL */}
      {/* --------------------------------------------------------------------- */}
      {isHostelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Create Hostel Building
              </h3>
              <button onClick={() => setIsHostelModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateHostel} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Hostel Name</label>
                <input
                  type="text"
                  required
                  value={hostelForm.name}
                  onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                  placeholder="e.g. Ramanujan Hall of Residence"
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={hostelForm.code}
                    onChange={(e) => setHostelForm({ ...hostelForm, code: e.target.value })}
                    placeholder="e.g. RHR-1"
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gender Type</label>
                  <select
                    value={hostelForm.genderType}
                    onChange={(e) => setHostelForm({ ...hostelForm, genderType: e.target.value as any })}
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white"
                  >
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                    <option value="coed">Co-Ed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Bed Capacity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={hostelForm.totalCapacity}
                  onChange={(e) => setHostelForm({ ...hostelForm, totalCapacity: parseInt(e.target.value) || 0 })}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsHostelModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm">Save Hostel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE BLOCK */}
      {/* --------------------------------------------------------------------- */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Add Block / Wing
              </h3>
              <button onClick={() => setIsBlockModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateBlock} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Parent Hostel</label>
                <select
                  value={blockForm.hostelId || selectedHostelId}
                  onChange={(e) => setBlockForm({ ...blockForm, hostelId: e.target.value })}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white"
                >
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Block / Wing Name</label>
                <input
                  type="text"
                  required
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  placeholder="e.g. Block A - North Wing"
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={blockForm.code}
                    onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })}
                    placeholder="e.g. A"
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Floors</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={blockForm.totalFloors}
                    onChange={(e) => setBlockForm({ ...blockForm, totalFloors: parseInt(e.target.value) || 1 })}
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsBlockModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm">Save Block</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE FLOOR */}
      {/* --------------------------------------------------------------------- */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Add Floor
              </h3>
              <button onClick={() => setIsFloorModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateFloor} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Parent Block</label>
                <select
                  value={floorForm.blockId || selectedBlockId}
                  onChange={(e) => setFloorForm({ ...floorForm, blockId: e.target.value })}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white"
                >
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Floor Number</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={floorForm.floorNumber}
                    onChange={(e) => setFloorForm({ ...floorForm, floorNumber: parseInt(e.target.value) || 0 })}
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Floor Name</label>
                  <input
                    type="text"
                    required
                    value={floorForm.name}
                    onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                    placeholder="e.g. Ground Floor"
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsFloorModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm">Save Floor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE ROOM */}
      {/* --------------------------------------------------------------------- */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <DoorClosed className="w-4 h-4 text-primary" /> Create Room
              </h3>
              <button onClick={() => setIsRoomModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Floor</label>
                <select
                  value={roomForm.floorId || selectedFloorId}
                  onChange={(e) => setRoomForm({ ...roomForm, floorId: e.target.value })}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white"
                >
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    value={roomForm.roomNumber}
                    onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                    placeholder="e.g. A101"
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Capacity Ceiling</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 1 })}
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Type</label>
                  <select
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value as any })}
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white"
                  >
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                    <option value="triple">Triple</option>
                    <option value="dormitory">Dormitory</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Climate Control</label>
                  <select
                    value={roomForm.acType}
                    onChange={(e) => setRoomForm({ ...roomForm, acType: e.target.value as any })}
                    className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white"
                  >
                    <option value="non_ac">Non-AC</option>
                    <option value="ac">Air Conditioned (AC)</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsRoomModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm">Save Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE BED */}
      {/* --------------------------------------------------------------------- */}
      {isBedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-primary" /> Add Bed Berth
              </h3>
              <button onClick={() => setIsBedModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateBed} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Room</label>
                <select
                  value={bedForm.roomId || selectedRoomId}
                  onChange={(e) => setBedForm({ ...bedForm, roomId: e.target.value })}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white font-mono"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>Room {r.roomNumber} (Capacity: {r.capacity})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bed Label / Identifier</label>
                <input
                  type="text"
                  required
                  value={bedForm.bedLabel}
                  onChange={(e) => setBedForm({ ...bedForm, bedLabel: e.target.value })}
                  placeholder="e.g. Bed A, Bed 1, Lower Berth"
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsBedModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm">Save Bed</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ALLOCATE BED */}
      {/* --------------------------------------------------------------------- */}
      {isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-emerald-50/70">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" /> New Resident Bed Allocation
              </h3>
              <button onClick={() => setIsAllocateModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAllocateBed} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700">Select Registered Student:</span>
                <select
                  required
                  value={allocStudentId}
                  onChange={(e) => setAllocStudentId(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white text-xs"
                >
                  <option value="">-- Choose Student --</option>
                  {devStudents.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.isAllocated}>
                      {s.name} ({s.enrollmentNumber}) {s.isAllocated ? '[Already Occupying Bed]' : '[Available]'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Vacant Bed Berth</label>
                <select
                  required
                  value={allocBedId}
                  onChange={(e) => setAllocBedId(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white font-mono"
                >
                  <option value="">-- Select Vacant Bed --</option>
                  {vacantBedsList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedLabel} (Room ID: {b.roomId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Allocation Remarks (Optional)</label>
                <input
                  type="text"
                  value={allocRemarks}
                  onChange={(e) => setAllocRemarks(e.target.value)}
                  placeholder="e.g. Fresh admission 2026"
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAllocateModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm">Commit Allocation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: TRANSFER BED */}
      {/* --------------------------------------------------------------------- */}
      {isTransferModalOpen && selectedAllocForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-blue-50/70">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Transfer Bed Berth
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleTransferBed} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800">{selectedAllocForAction.studentName}</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Currently in {selectedAllocForAction.roomNumber ? `Room ${selectedAllocForAction.roomNumber}` : selectedAllocForAction.bedId} ({selectedAllocForAction.bedLabel})
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination Vacant Bed</label>
                <select
                  required
                  value={transferDestBedId}
                  onChange={(e) => setTransferDestBedId(e.target.value)}
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary bg-white font-mono"
                >
                  <option value="">-- Select Vacant Destination --</option>
                  {vacantBedsList
                    .filter((b) => b.id !== selectedAllocForAction.bedId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bedLabel} (Room ID: {b.roomId})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transfer Reason / Remarks</label>
                <input
                  type="text"
                  required
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  placeholder="e.g. Requested floor transfer"
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm">Execute Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: VACATE BED */}
      {/* --------------------------------------------------------------------- */}
      {isVacateModalOpen && selectedAllocForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-red-50/70">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <LogOut className="w-4 h-4 text-red-600" /> Vacate Bed & Checkout
              </h3>
              <button onClick={() => setIsVacateModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleVacateBed} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
                Vacating will restore the bed to <b>vacant</b> status, timestamp the checkout, and clear the active resident pointer.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Checkout Remarks</label>
                <input
                  type="text"
                  required
                  value={vacateRemarks}
                  onChange={(e) => setVacateRemarks(e.target.value)}
                  placeholder="e.g. End of academic year, keys returned"
                  className="w-full border border-border rounded-xl py-2 px-3 outline-none focus:border-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsVacateModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm">Confirm Vacate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
