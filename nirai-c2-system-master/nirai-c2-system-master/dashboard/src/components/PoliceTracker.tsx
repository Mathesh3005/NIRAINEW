import React from 'react';
import { ShieldCheck, MapPin, Navigation, UserCheck } from 'lucide-react';
import { Officer, Case } from '../types';

interface PoliceTrackerProps {
  officers: Officer[];
  selectedCase: Case | null;
  onAssignOfficer: (caseId: string, officerUserId: string) => void;
}

export const PoliceTracker: React.FC<PoliceTrackerProps> = ({
  officers,
  selectedCase,
  onAssignOfficer,
}) => {
  const activeOfficers = officers.filter(o => o.onDuty);

  return (
    <div className="apple-glass border-l border-white/[0.08] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-[#0a84ff]" />
          <h2 className="apple-headline text-xs font-semibold text-white">Patrol Units</h2>
        </div>
        <span className="bg-[#0a84ff]/15 text-[#0a84ff] text-[11px] px-2.5 py-0.5 rounded-full font-medium apple-tabular">
          {activeOfficers.length} On Duty
        </span>
      </div>

      {/* Selected Case Reference Header */}
      {selectedCase ? (
        <div className="bg-[#0071e3]/10 border-b border-[#0071e3]/20 px-4 py-2 text-xs text-[#2997ff] flex items-center justify-between">
          <span className="apple-tabular font-medium">Target: {selectedCase.id}</span>
          <span className="text-[11px] text-[#2997ff]/80">Proximity sorted</span>
        </div>
      ) : (
        <div className="bg-white/[0.02] border-b border-white/[0.06] px-4 py-2 text-xs text-[#86868b]">
          Select an incident to view unit proximity
        </div>
      )}

      {/* Officer List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {activeOfficers.map((officer) => {
          const isAssignedToCurrent = selectedCase?.assignedOfficerUserId === officer.userId;

          return (
            <div
              key={officer.userId}
              className={`p-3.5 rounded-[16px] border transition-all ${
                isAssignedToCurrent
                  ? 'bg-[#232326] border-[#0a84ff]/60 shadow-apple-card ring-1 ring-[#0a84ff]/40'
                  : 'apple-card apple-card-hover'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-[#0a84ff] apple-tabular">{officer.badgeId}</span>
                  <h3 className="text-xs font-semibold text-white">{officer.name}</h3>
                </div>
                <span className="text-[10px] bg-white/[0.06] text-white/80 border border-white/[0.08] px-2 py-0.5 rounded-full">
                  {officer.vehicle}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[#86868b]">
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-[#86868b]" />
                  <span className="apple-tabular">
                    {officer.location.lat.toFixed(4)}°, {officer.location.lng.toFixed(4)}°
                  </span>
                </div>
              </div>

              {selectedCase && (() => {
                const R = 6371;
                const dLat = (selectedCase.location.lat - officer.location.lat) * (Math.PI / 180);
                const dLng = (selectedCase.location.lng - officer.location.lng) * (Math.PI / 180);
                const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(officer.location.lat * Math.PI / 180) *
                  Math.cos(selectedCase.location.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) ** 2;
                const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const etaMin = Math.max(1, Math.round(distKm * 2)); // ~30 km/h city traffic

                return (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="text-[11px] text-[#f5f5f7] space-x-3 apple-tabular">
                      <span><span className="text-[#86868b]">Dist: </span><span className="font-medium text-[#2997ff]">{distKm.toFixed(2)} km</span></span>
                      <span><span className="text-[#86868b]">ETA: </span><span className="font-medium text-[#ff9f0a]">{etaMin}m</span></span>
                    </div>

                    {isAssignedToCurrent ? (
                      <span className="text-[11px] bg-[#0a84ff]/20 text-[#0a84ff] border border-[#0a84ff]/30 px-2.5 py-0.5 rounded-full flex items-center space-x-1 font-medium">
                        <UserCheck className="w-3 h-3" />
                        <span>Assigned</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onAssignOfficer(selectedCase.id, officer.userId)}
                        className="apple-btn-primary text-[11px] py-1 px-3 inline-flex items-center space-x-1 font-medium"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Assign Unit</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
