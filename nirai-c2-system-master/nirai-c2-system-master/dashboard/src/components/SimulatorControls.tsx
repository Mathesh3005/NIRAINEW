import React, { useState } from 'react';
import { Terminal, X, AlertTriangle, UserCheck, Video } from 'lucide-react';

interface SimulatorControlsProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSOS: (name: string, locationName: string, lat: number, lng: number) => void;
  onSimulateOfficerMove: () => void;
  onSimulateMediaStream?: () => void;
}

const SAMPLE_LOCATIONS = [
  { name: 'Mount Road near Anna Flyover, Chennai', lat: 13.0604, lng: 80.2496 },
  { name: 'T. Nagar Ranganathan Street, Chennai', lat: 13.0405, lng: 80.2337 },
  { name: 'Marina Beach Light House Area, Chennai', lat: 13.0382, lng: 80.2798 },
  { name: 'Guindy Industrial Estate, Chennai', lat: 13.0102, lng: 80.2157 },
];

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  isOpen,
  onClose,
  onTriggerSOS,
  onSimulateOfficerMove,
  onSimulateMediaStream,
}) => {
  const [selectedLocIndex, setSelectedLocIndex] = useState(0);
  const [reporterName, setReporterName] = useState('Ananya Ramachandran');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 select-none">
      <div className="apple-glass rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2997ff]/15 border border-[#2997ff]/30 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-[#2997ff]" />
            </div>
            <div>
              <h3 className="apple-headline font-semibold text-base text-white">Incident Simulator</h3>
              <p className="text-xs text-[#86868b]">Testing telemetry & dispatch flows</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/70 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs text-white/90">
          <div>
            <label className="block text-[#86868b] text-[11px] mb-1 font-medium">Citizen Name</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="w-full bg-black/50 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white focus:border-[#2997ff] focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[#86868b] text-[11px] mb-1 font-medium">Simulated Location</label>
            <select
              value={selectedLocIndex}
              onChange={(e) => setSelectedLocIndex(Number(e.target.value))}
              className="w-full bg-black/50 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:border-[#2997ff] focus:outline-none transition-all"
            >
              {SAMPLE_LOCATIONS.map((loc, idx) => (
                <option key={idx} value={idx}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex flex-col space-y-2">
            <button
              onClick={() => {
                const loc = SAMPLE_LOCATIONS[selectedLocIndex];
                onTriggerSOS(reporterName, loc.name, loc.lat, loc.lng);
                onClose();
              }}
              className="w-full apple-pill-btn bg-[#ff453a] hover:bg-[#ff5147] text-white font-medium py-2.5 rounded-full transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#ff453a]/25 text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Simulate Civilian SOS Trigger</span>
            </button>

            <button
              onClick={() => {
                onSimulateOfficerMove();
                onClose();
              }}
              className="w-full apple-btn-secondary py-2.5 text-xs font-medium flex items-center justify-center space-x-2"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span>Update Patrol GPS Heartbeat</span>
            </button>

            {onSimulateMediaStream && (
              <button
                onClick={() => {
                  onSimulateMediaStream();
                  onClose();
                }}
                className="w-full apple-btn-secondary py-2.5 text-xs font-medium flex items-center justify-center space-x-2 border border-[#2997ff]/30 text-[#2997ff] hover:bg-[#2997ff]/10"
              >
                <Video className="w-3.5 h-3.5 text-[#2997ff]" />
                <span>Stream Live Camera & Audio (A/V Uplink)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
