import React, { useState } from 'react';
import { Cpu, BatteryCharging, Radio, CheckSquare, AlertOctagon, Video, ShieldAlert, Play, Battery, Orbit, HardDrive, ChevronUp, ChevronDown } from 'lucide-react';
import { Drone, Case } from '../types';
import { checkRedZoneCollision } from './LiveMap';
import { soundFX } from '../utils/audioEffects';

interface DroneControlPanelProps {
  drones: Drone[];
  selectedCase: Case | null;
  dispatchModalCaseId: string | null;
  onCloseDispatchModal: () => void;
  onConfirmDispatch: (caseId: string, motherDroneId: string, airspaceConfirmed: boolean) => void;
  onResolveCase: (caseId: string) => void;
  defaultExpanded?: boolean;
}

export const DroneControlPanel: React.FC<DroneControlPanelProps> = ({
  drones,
  selectedCase,
  dispatchModalCaseId,
  onCloseDispatchModal,
  onConfirmDispatch,
  onResolveCase,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [airspaceChecked, setAirspaceChecked] = useState(false);
  const [selectedMotherId] = useState('drone-m1');

  const motherDrones = drones.filter(d => d.type === 'mother');
  const childDrones = drones.filter(d => d.type === 'child');
  const activeChild = childDrones.find(d => d.status === 'airborne' || d.streamUrl);
  const motherAlpha = motherDrones[0];

  const isBlockedByGeofence = selectedCase 
    ? checkRedZoneCollision(selectedCase.location.lat, selectedCase.location.lng) 
    : false;

  return (
    <div className="w-full max-w-4xl mx-auto transition-all duration-300 select-none">
      {/* Collapsed Minimalist Dock Pill */}
      {!isExpanded ? (
        <div className="liquid-glass rounded-full px-5 py-2.5 shadow-2xl border border-white/[0.12] flex items-center justify-between space-x-4 cursor-pointer hover:border-[#bf5af2]/40 transition-all"
             onClick={() => {
               soundFX.playClickTick();
               setIsExpanded(true);
             }}>
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-full bg-[#bf5af2]/15 border border-[#bf5af2]/30 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-[#bf5af2]" />
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-white">{motherAlpha ? motherAlpha.name : 'Mother Alpha'}</span>
              <span className="text-[11px] bg-white/[0.08] text-[#30d158] border border-white/[0.08] px-2 py-0.5 rounded-full font-medium apple-tabular">
                {motherAlpha ? `${motherAlpha.batteryPct}% BAT` : '100%'}
              </span>
              <span className="text-[#86868b]">•</span>
              <span className="text-[11px] text-[#f5f5f7]">
                {childDrones.filter(c => c.status === 'airborne').length > 0 ? (
                  <span className="text-[#bf5af2] font-semibold">1 Recon Active</span>
                ) : (
                  <span>{childDrones.filter(c => c.status === 'docked' || c.status === 'charging').length} Bays Docked</span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {selectedCase && (selectedCase.status === 'airborne' || selectedCase.status === 'on_scene') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  soundFX.playResolveChime();
                  onResolveCase(selectedCase.id);
                }}
                className="apple-pill-btn bg-[#30d158]/15 hover:bg-[#30d158]/25 text-[#30d158] border border-[#30d158]/30 text-[11px] px-3 py-1 font-medium transition-all flex items-center space-x-1"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Recall Fleet</span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                soundFX.playClickTick();
                setIsExpanded(true);
              }}
              className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#86868b] hover:text-white"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Floating Card */
        <div className="liquid-glass rounded-3xl p-4 shadow-2xl border border-white/[0.12] flex flex-col justify-between">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-[#bf5af2]" />
              <h2 className="apple-headline text-xs font-semibold text-white">
                Drone Fleet & Telemetry
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              {selectedCase && (selectedCase.status === 'airborne' || selectedCase.status === 'on_scene') && (
                <button
                  onClick={() => {
                    soundFX.playResolveChime();
                    onResolveCase(selectedCase.id);
                  }}
                  className="apple-pill-btn bg-[#30d158]/15 hover:bg-[#30d158]/25 text-[#30d158] border border-[#30d158]/30 text-xs px-3.5 py-1.5 font-medium transition-all flex items-center space-x-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Recall Fleet</span>
                </button>
              )}
              <button
                onClick={() => {
                  soundFX.playClickTick();
                  setIsExpanded(false);
                }}
                className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#86868b] hover:text-white"
                title="Collapse dock"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

      {/* Fleet Cards + Live Stream Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-2 flex-1 overflow-hidden">
        {/* Mother Drone Telemetry */}
        {motherDrones.map(m => (
          <div key={m.id} className="apple-card p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#bf5af2]">{m.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                m.status === 'airborne' ? 'bg-[#2997ff]/20 text-[#2997ff]' : 'bg-white/[0.06] text-white/70'
              }`}>
                {m.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs my-2">
              <div className="bg-black/40 p-2 rounded-xl border border-white/[0.06]">
                <span className="text-[10px] text-[#86868b] block">Battery</span>
                <span className="font-semibold text-[#30d158] apple-tabular">{m.batteryPct}%</span>
              </div>
              <div className="bg-black/40 p-2 rounded-xl border border-white/[0.06]">
                <span className="text-[10px] text-[#86868b] block">Altitude</span>
                <span className="font-semibold text-[#2997ff] apple-tabular">{m.altitudeMeters}m</span>
              </div>
              <div className="bg-black/40 p-2 rounded-xl border border-white/[0.06]">
                <span className="text-[10px] text-[#86868b] block">Speed</span>
                <span className="font-semibold text-[#ff9f0a] apple-tabular">{m.speedKmh} km/h</span>
              </div>
            </div>
            <div className="text-[11px] text-[#86868b] flex items-center justify-between">
              <span>Bays: {childDrones.filter(c => c.status === 'docked' || c.status === 'charging').length}/{childDrones.length} Docked</span>
              <Radio className="w-3.5 h-3.5 text-[#bf5af2]" />
            </div>
          </div>
        ))}

        {/* Child Recon Drone Bay Grid */}
        <div className="apple-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-white/90">Mother-Drone Bay Slots</span>
            <span className="text-[10px] text-[#86868b]">Cradle Charger Active</span>
          </div>
          
          {/* 2x2 Bay Slot Grid */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {childDrones.map((c, idx) => {
              let slotColor = 'border-white/[0.06] bg-black/40 text-white/70';
              let IconComp = HardDrive;
              let label = 'Docked';

              if (c.status === 'airborne') {
                slotColor = 'border-[#bf5af2]/40 bg-[#bf5af2]/10 text-[#bf5af2]';
                IconComp = Orbit;
                label = 'Recon';
              } else if (c.batteryPct < 98) {
                slotColor = 'border-[#ff9f0a]/30 bg-[#ff9f0a]/10 text-[#ff9f0a]';
                IconComp = BatteryCharging;
                label = 'Charging';
              } else {
                slotColor = 'border-[#30d158]/30 bg-[#30d158]/10 text-[#30d158]';
                IconComp = Battery;
                label = 'Ready';
              }

              return (
                <div key={c.id} className={`border rounded-xl p-2 flex flex-col justify-between ${slotColor} transition-all`}>
                  <div className="flex items-center justify-between text-[10px] font-medium">
                    <span>Bay {idx + 1}</span>
                    <IconComp className="w-3 h-3" />
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[9px] font-medium">{label}</span>
                    <span className="text-xs font-semibold apple-tabular">{c.batteryPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Stream View */}
        <div className="apple-card p-3.5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center space-x-1.5">
              <Video className="w-3.5 h-3.5 text-[#ff453a]" />
              <span className="text-xs font-semibold text-white">Live Optical Feed</span>
            </div>
            <span className="text-[10px] bg-black/50 text-[#30d158] border border-white/[0.08] px-2 py-0.5 rounded-full font-medium">
              {activeChild?.status === 'airborne' ? '1080p HD' : 'Standby'}
            </span>
          </div>

          {activeChild?.streamUrl || activeChild?.status === 'airborne' ? (
            <div className="relative w-full h-24 bg-black/60 rounded-xl overflow-hidden mt-1 flex items-center justify-center border border-white/[0.08]">
              {activeChild?.streamUrl?.startsWith('data:image') ? (
                <img
                  src={activeChild.streamUrl}
                  alt="Live Drone Camera Stream"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={activeChild?.streamUrl || undefined}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90"
                />
              )}
              <div className="absolute top-1.5 left-1.5 text-[9px] bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[#2997ff] border border-white/[0.1] flex items-center space-x-1 apple-tabular">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] animate-pulse"></span>
                <span>Recon-1 • {activeChild?.location.lat.toFixed(4)}°, {activeChild?.location.lng.toFixed(4)}°</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-24 bg-black/40 rounded-xl flex flex-col items-center justify-center text-[#86868b] text-xs border border-white/[0.06] mt-1">
              <ShieldAlert className="w-5 h-5 mb-1 opacity-50 text-[#86868b]" />
              <span className="text-[11px]">Optical Feed Standby</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

      {/* Human-in-the-Loop "Confirm Dispatch" Modal */}
      {dispatchModalCaseId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
          <div className="apple-glass rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-white/[0.08] pb-3">
              <div className="p-2.5 bg-[#0071e3]/15 border border-[#0071e3]/30 rounded-xl">
                <AlertOctagon className="w-6 h-6 text-[#2997ff]" />
              </div>
              <div>
                <h3 className="apple-headline font-semibold text-base text-white">Mission Authorization</h3>
                <p className="text-xs text-[#86868b]">Mother-Child Drone Launch Verification</p>
              </div>
            </div>

            {/* Geofence collision warning block */}
            {isBlockedByGeofence && (
              <div className="bg-[#ff453a]/15 border border-[#ff453a]/30 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 text-[#ff453a] font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-apple-pulse"></span>
                  <span>Launch Blocked: Restricted Airspace</span>
                </div>
                <p className="text-[12px] text-white/80 leading-relaxed">
                  The target incident coordinate lies inside designated restricted airspace (Chennai Port Air Command Z-RED-04). Deployment is locked by DGCA regulation.
                </p>
              </div>
            )}

            <div className="bg-black/50 p-4 rounded-xl border border-white/[0.08] space-y-2 text-xs text-white/80 apple-tabular">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Target Case:</span>
                <span className="font-semibold text-[#ff453a]">{dispatchModalCaseId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Assigned Unit:</span>
                <span className="font-medium text-[#bf5af2]">Mother Alpha (Station Dock 1)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Diagnostics:</span>
                <span className={isBlockedByGeofence ? 'text-[#ff453a] font-semibold' : 'text-[#30d158] font-semibold'}>
                  {isBlockedByGeofence ? 'Restricted Zone Conflict' : 'All Systems Nominal'}
                </span>
              </div>
            </div>

            {/* Digital Sky Airspace Verification Box */}
            <div className={`border p-3.5 rounded-xl flex items-start space-x-3 transition-colors ${
              isBlockedByGeofence 
                ? 'bg-black/30 border-white/[0.06] opacity-50' 
                : 'bg-white/[0.03] border-white/[0.08]'
            }`}>
              <input
                type="checkbox"
                id="airspaceCheck"
                disabled={isBlockedByGeofence}
                checked={airspaceChecked}
                onChange={(e) => setAirspaceChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-md border-white/20 bg-black/60 text-[#0071e3] focus:ring-[#0071e3] disabled:cursor-not-allowed"
              />
              <label htmlFor="airspaceCheck" className="text-xs text-white/80 cursor-pointer leading-relaxed">
                <span className="font-medium text-white block mb-0.5">DGCA Digital Sky Airspace Confirmation</span>
                I confirm that the incident location lies outside designated Red No-Fly Zones and flight telemetry is verified safe for emergency deployment.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={onCloseDispatchModal}
                className="apple-btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                disabled={!airspaceChecked || isBlockedByGeofence}
                onClick={() => {
                  onConfirmDispatch(dispatchModalCaseId, selectedMotherId, airspaceChecked);
                  setAirspaceChecked(false);
                }}
                className={`text-xs py-2 px-5 apple-pill-btn flex items-center space-x-1.5 font-medium ${
                  airspaceChecked && !isBlockedByGeofence
                    ? 'apple-btn-primary'
                    : 'bg-white/[0.05] text-white/40 border border-white/[0.06] cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Confirm Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
