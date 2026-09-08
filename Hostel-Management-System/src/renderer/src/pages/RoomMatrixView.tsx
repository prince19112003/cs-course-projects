import React from 'react';
import { DoorClosed, CheckCircle2, AlertTriangle } from 'lucide-react';

export const RoomMatrixView: React.FC = () => {
  const blockARooms = [
    { number: 'A101', status: 'Occupied', student: 'John Doe (STU-001)' },
    { number: 'A102', status: 'Vacant' },
    { number: 'A103', status: 'Vacant' },
    { number: 'A104', status: 'Vacant' },
    { number: 'A105', status: 'Vacant' },
    { number: 'A201', status: 'Vacant' },
    { number: 'A202', status: 'Vacant' },
    { number: 'A203', status: 'Vacant' },
    { number: 'A204', status: 'Vacant' },
    { number: 'A205', status: 'Vacant' },
  ];

  const blockBRooms = [
    { number: 'B101', status: 'Vacant' },
    { number: 'B102', status: 'Vacant' },
    { number: 'B103', status: 'Vacant' },
    { number: 'B104', status: 'Vacant' },
    { number: 'B105', status: 'Vacant' },
    { number: 'B201', status: 'Vacant' },
    { number: 'B202', status: 'Vacant' },
    { number: 'B203', status: 'Vacant' },
    { number: 'B204', status: 'Vacant' },
    { number: 'B205', status: 'Occupied', student: 'Jane Smith (STU-002)' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain">
            Room Allocation Matrix
          </h1>
          <p className="text-sm text-textMuted font-medium">
            Visual map of residential capacities across sectors.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Vacant
          </div>
          <div className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Occupied
          </div>
        </div>
      </div>

      {/* Block A */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
            A
          </div>
          <h2 className="text-lg font-bold text-textMain">Block A - Ground Sector</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {blockARooms.map((r) => {
            const isOccupied = r.status === 'Occupied';
            return (
              <div
                key={r.number}
                className={`p-4 rounded-xl border transition-all shadow-sm ${
                  isOccupied
                    ? 'border-t-4 border-t-amber-500 bg-amber-50/40 border-amber-200'
                    : 'border-t-4 border-t-emerald-500 bg-emerald-50/30 border-emerald-200 hover:-translate-y-1'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-textMain">{r.number}</span>
                  <DoorClosed
                    className={`w-4 h-4 ${
                      isOccupied ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  />
                </div>
                <div className="text-[11px] font-semibold">
                  {isOccupied ? (
                    <span className="text-amber-800 font-bold block truncate">
                      {r.student}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Vacant (Available)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Block B */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm">
            B
          </div>
          <h2 className="text-lg font-bold text-textMain">Block B - Upper Sector</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {blockBRooms.map((r) => {
            const isOccupied = r.status === 'Occupied';
            return (
              <div
                key={r.number}
                className={`p-4 rounded-xl border transition-all shadow-sm ${
                  isOccupied
                    ? 'border-t-4 border-t-amber-500 bg-amber-50/40 border-amber-200'
                    : 'border-t-4 border-t-emerald-500 bg-emerald-50/30 border-emerald-200 hover:-translate-y-1'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-textMain">{r.number}</span>
                  <DoorClosed
                    className={`w-4 h-4 ${
                      isOccupied ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  />
                </div>
                <div className="text-[11px] font-semibold">
                  {isOccupied ? (
                    <span className="text-amber-800 font-bold block truncate">
                      {r.student}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Vacant (Available)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
