import React, { useState } from 'react';
import { Smartphone, Shield, Radio, Layers, RefreshCw, Monitor, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Case, Officer, Drone } from '../types';

interface ConnectedDevicesPanelProps {
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  isConnected: boolean;
  onClearAll?: () => void;
  operatorLocation?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  gpsStatus?: string;
}

export const ConnectedDevicesPanel: React.FC<ConnectedDevicesPanelProps> = ({
  cases,
  officers,
  drones,
  isConnected,
  operatorLocation,
  gpsStatus = 'locked'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const activeOfficers = officers.filter(o => o.onDuty);
  const totalNodes = activeCases.length + activeOfficers.length + drones.length + (operatorLocation ? 1 : 0);

  const handlePingDevices = () => {
    setPingStatus('Pinging mesh nodes via encrypted telemetry...');
    setTimeout(() => {
      setPingStatus(`Verified: 1 Command HQ, ${activeCases.length} SOS Units, ${activeOfficers.length} Officers, ${drones.length} Drones Online`);
    }, 600);
  };

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center border border-white/[0.08]">
            <Layers className="w-3.5 h-3.5 text-[#2997ff]" />
          </div>
          <span className="apple-headline text-xs font-semibold text-[#f5f5f7]">
            Hardware & Nodes
          </span>
          <span className="bg-white/[0.08] text-white/80 text-[10px] px-2 py-0.5 rounded-full font-medium apple-tabular">
            {totalNodes} Active
          </span>
          {operatorLocation && (
            <span className="hidden md:inline-flex items-center space-x-1.5 text-[11px] text-[#30d158] bg-[#30d158]/10 border border-[#30d158]/20 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]"></span>
              <span className="apple-tabular">
                HQ GPS: {operatorLocation.lat.toFixed(4)}°, {operatorLocation.lng.toFixed(4)}° (±{operatorLocation.accuracy || 5}m)
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePingDevices();
            }}
            className="apple-btn-secondary h-7 text-[11px] px-2.5 inline-flex items-center space-x-1.5 font-medium"
          >
            <RefreshCw className="w-3 h-3 text-[#2997ff]" />
            <span>Verify Nodes</span>
          </button>

          <div className="w-6 h-6 rounded-full bg-white/[0.04] flex items-center justify-center text-[#86868b]">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>

      {pingStatus && (
        <div className="bg-[#0071e3]/10 border-t border-[#0071e3]/20 px-4 py-1.5 text-[11px] text-[#2997ff] flex items-center justify-between">
          <span>{pingStatus}</span>
          <button onClick={() => setPingStatus(null)} className="text-white/60 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded Node List */}
      {isExpanded && (
        <div className="p-3.5 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
          {/* C2 Command Node */}
          <div className="apple-card p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white/90 flex items-center space-x-1.5">
                <Monitor className="w-3.5 h-3.5 text-[#2997ff]" />
                <span>Command Station</span>
              </span>
              <span className="text-[9px] bg-[#2997ff]/20 text-[#2997ff] px-2 py-0.5 rounded-full font-medium">
                HQ Master
              </span>
            </div>
            {operatorLocation ? (
              <div className="text-[11px] bg-black/40 p-2.5 rounded-lg border border-white/[0.06] space-y-1">
                <span className="text-white/90 font-medium block">Station Primary</span>
                <span className="text-[10px] text-[#2997ff] block apple-tabular font-medium">
                  {operatorLocation.lat.toFixed(5)}°, {operatorLocation.lng.toFixed(5)}°
                </span>
                <span className="text-[10px] text-[#30d158] block apple-tabular">
                  Sensor Accuracy: ±{operatorLocation.accuracy || 5}m
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[#ff9f0a]">Acquiring GPS fix...</p>
            )}
          </div>

          {/* Civilian SOS Nodes */}
          <div className="apple-card p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white/90 flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#ff453a]" />
                <span>Civilian SOS Units</span>
              </span>
              <span className="text-[9px] bg-[#ff453a]/20 text-[#ff453a] px-2 py-0.5 rounded-full font-medium apple-tabular">
                {activeCases.length} Active
              </span>
            </div>
            {activeCases.length === 0 ? (
              <p className="text-[11px] text-[#86868b] py-2">No active SOS units</p>
            ) : (
              <div className="space-y-1.5">
                {activeCases.map(c => (
                  <div key={c.id} className="text-[11px] bg-black/40 p-2 rounded-lg border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium block">{c.reporterName}</span>
                      <span className="text-[10px] text-[#86868b] apple-tabular">
                        {!c.locationUnavailable && c.location
                          ? `${c.location.lat}, ${c.location.lng}`
                          : 'Location unavailable'}
                      </span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-apple-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Police Patrol Units */}
          <div className="apple-card p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white/90 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-[#0a84ff]" />
                <span>Patrol Units</span>
              </span>
              <span className="text-[9px] bg-[#0a84ff]/20 text-[#0a84ff] px-2 py-0.5 rounded-full font-medium apple-tabular">
                {activeOfficers.length} On Duty
              </span>
            </div>
            <div className="space-y-1.5">
              {officers.map(o => (
                <div key={o.userId} className="text-[11px] bg-black/40 p-2 rounded-lg border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">{o.name} ({o.badgeId})</span>
                    <span className="text-[10px] text-[#86868b]">{o.vehicle}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${o.onDuty ? 'bg-[#30d158]' : 'bg-[#636366]'}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Drone Fleet */}
          <div className="apple-card p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white/90 flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-[#bf5af2]" />
                <span>Drone Fleet</span>
              </span>
              <span className="text-[9px] bg-[#bf5af2]/20 text-[#bf5af2] px-2 py-0.5 rounded-full font-medium apple-tabular">
                {drones.length} Units
              </span>
            </div>
            <div className="space-y-1.5">
              {drones.map(d => (
                <div key={d.id} className="text-[11px] bg-black/40 p-2 rounded-lg border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium block">{d.name}</span>
                    <span className="text-[10px] text-[#86868b] apple-tabular">
                      Bat: {d.batteryPct}% • Alt: {d.altitudeMeters}m
                    </span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    d.status === 'airborne' ? 'bg-[#bf5af2]/20 text-[#bf5af2]' : 'bg-white/[0.08] text-white/60'
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
