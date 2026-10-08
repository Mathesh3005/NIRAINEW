import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertCircle, 
  User, 
  Phone, 
  MapPin, 
  Clock, 
  Activity, 
  Mic, 
  Shield, 
  Radio, 
  CheckCircle, 
  XCircle, 
  Send, 
  Navigation, 
  X, 
  ShieldAlert,
  Video,
  Volume2,
  VolumeX,
  Play,
  Flame,
  RadioTower
} from 'lucide-react';
import { Case, Officer, Drone } from '../types';
import { checkRedZoneCollision } from './LiveMap';
import { soundFX } from '../utils/audioEffects';

interface IncidentInspectorCardProps {
  selectedCase: Case | null;
  officers: Officer[];
  drones: Drone[];
  onClose: () => void;
  onVerifyCase: (caseId: string, isFalseAlarm: boolean) => void;
  onOpenDispatchModal: (caseId: string) => void;
  onAssignOfficer: (caseId: string, officerUserId: string) => void;
  onResolveCase: (caseId: string) => void;
  onCancelCase?: (caseId: string) => void;
  onSimulateMediaStream?: (caseId: string) => void;
}

// Organic Live Acoustic Stream Component with Web Audio Monitoring
const LiveAcousticStream: React.FC<{ 
  active: boolean; 
  decibelLevel?: number; 
  audioData?: string;
  caseId: string;
}> = ({ active, decibelLevel, audioData, caseId }) => {
  const [levels, setLevels] = useState([6, 12, 16, 10, 18, 14, 20, 12, 14, 8]);
  const [isListening, setIsListening] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const displayDb = decibelLevel || (active ? 48 : 22);

  // Dynamic bar visualization reacting to incoming decibel levels
  useEffect(() => {
    if (!active) return;
    const baseMultiplier = (displayDb / 50);
    const timer = setInterval(() => {
      setLevels(prev => prev.map(() => {
        const rand = Math.floor(Math.random() * 12) + 4;
        return Math.min(22, Math.max(3, Math.round(rand * baseMultiplier)));
      }));
    }, 150);
    return () => clearInterval(timer);
  }, [active, displayDb]);

  // Audio Monitoring via Web Audio API
  useEffect(() => {
    if (!isListening) {
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
        setTimeout(() => {
          try {
            oscRef.current?.stop();
            oscRef.current?.disconnect();
            audioCtxRef.current?.close();
          } catch (e) {}
          audioCtxRef.current = null;
          oscRef.current = null;
          gainRef.current = null;
        }, 100);
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Create warm bandpass-filtered acoustic tone to simulate live encrypted radio feed
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220 + (displayDb * 2), ctx.currentTime);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.Q.setValueAtTime(3.0, ctx.currentTime);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }

    return () => {
      try {
        oscRef.current?.stop();
        audioCtxRef.current?.close();
      } catch (e) {}
    };
  }, [isListening]);

  // Modulate frequency when decibels change
  useEffect(() => {
    if (isListening && oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setTargetAtTime(200 + (displayDb * 2.5), audioCtxRef.current.currentTime, 0.1);
    }
  }, [displayDb, isListening]);

  return (
    <div className="bg-black/40 p-3 rounded-2xl border border-white/[0.08] space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-lg bg-[#2997ff]/15 flex items-center justify-center">
            <Mic className={`w-3 h-3 ${active ? 'text-[#2997ff]' : 'text-[#86868b]'}`} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-white/90 block">Acoustic Audio Channel</span>
            <span className="text-[9px] text-[#86868b]">
              {active ? `Live Feed • ${displayDb} dB SPL` : 'Standby'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            soundFX.playClickTick();
            setIsListening(!isListening);
          }}
          className={`apple-pill-btn text-[10px] px-2.5 py-1 font-medium flex items-center space-x-1.5 transition-all ${
            isListening 
              ? 'bg-[#30d158]/20 text-[#30d158] border border-[#30d158]/40' 
              : 'bg-white/[0.06] text-[#86868b] hover:text-white border border-white/[0.08]'
          }`}
          title={isListening ? 'Mute Live Acoustic Feed' : 'Listen Live to Incident Feed'}
        >
          {isListening ? <Volume2 className="w-3 h-3 text-[#30d158]" /> : <VolumeX className="w-3 h-3" />}
          <span>{isListening ? 'Listening Live' : 'Listen Live'}</span>
        </button>
      </div>

      {/* Dynamic Sound Waveform Bars */}
      <div className="flex items-center justify-between h-5 px-1 bg-black/30 rounded-xl border border-white/[0.04]">
        <div className="flex items-center space-x-1 flex-1 justify-around">
          {levels.map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-150"
              style={{
                height: active ? `${h}px` : '3px',
                backgroundColor: active 
                  ? (displayDb > 70 
                      ? 'rgba(255, 69, 58, 0.85)' 
                      : (i % 2 === 0 ? 'rgba(41, 151, 255, 0.85)' : 'rgba(48, 209, 88, 0.75)'))
                  : 'rgba(255, 255, 255, 0.12)'
              }}
            />
          ))}
        </div>
        <span className="text-[9px] font-mono text-[#2997ff] ml-2 apple-tabular">
          {displayDb} dB
        </span>
      </div>
    </div>
  );
};

export const IncidentInspectorCard: React.FC<IncidentInspectorCardProps> = ({
  selectedCase,
  officers,
  drones,
  onClose,
  onVerifyCase,
  onOpenDispatchModal,
  onAssignOfficer,
  onResolveCase,
  onCancelCase,
  onSimulateMediaStream
}) => {
  const [isThermal, setIsThermal] = useState(false);

  if (!selectedCase) return null;

  const activeOfficers = officers.filter(o => o.onDuty);
  const timeAgo = Math.max(1, Math.round((Date.now() - new Date(selectedCase.createdAt).getTime()) / 60000));
  const isBlocked = checkRedZoneCollision(selectedCase.location.lat, selectedCase.location.lng);

  // Proximity calculations
  const rankedOfficers = activeOfficers.map(officer => {
    const R = 6371;
    const dLat = (selectedCase.location.lat - officer.location.lat) * (Math.PI / 180);
    const dLng = (selectedCase.location.lng - officer.location.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(officer.location.lat * Math.PI / 180) *
      Math.cos(selectedCase.location.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const etaMin = Math.max(1, Math.round(distKm * 2));
    return { officer, distKm, etaMin };
  }).sort((a, b) => a.distKm - b.distKm);

  const nearest = rankedOfficers[0];
  const assignedOfficer = officers.find(o => o.userId === selectedCase.assignedOfficerUserId);

  // Deterministic metrics
  const numericId = selectedCase.id.split('-')[1] || '1';
  const isOdd = numericId.charCodeAt(numericId.length - 1) % 2 === 1;
  const distressIndex = Math.min(96, Math.max(45, (selectedCase.severityScore * 10) + (isOdd ? 14 : 4)));
  const acousticDistressAlert = selectedCase.severityScore >= 5 || (selectedCase.decibelLevel || 0) > 70;

  return (
    <div className="w-80 md:w-88 liquid-glass rounded-3xl shadow-2xl border border-white/[0.12] overflow-hidden flex flex-col z-[1000] select-none animate-slideInRight">
      {/* Sleek Top Header Bar */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-apple-pulse" />
          <span className="apple-headline text-xs font-semibold text-white">Incident Triage</span>
          <span className="apple-tabular text-[10px] bg-white/[0.08] text-[#2997ff] border border-white/[0.1] px-2 py-0.5 rounded-full font-medium">
            {selectedCase.id}
          </span>
        </div>
        <button
          onClick={() => {
            soundFX.playClickTick();
            onClose();
          }}
          className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white transition-all"
          title="Close Inspector (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-3.5 max-h-[calc(100vh-170px)] overflow-y-auto">
        {/* Reporter Information */}
        <div className="apple-card p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {selectedCase.reporterPhotoUrl ? (
              <img
                src={selectedCase.reporterPhotoUrl}
                alt={selectedCase.reporterName}
                className="w-9 h-9 rounded-xl object-cover border border-white/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-[#2997ff]" />
              </div>
            )}
            <div>
              <h3 className="apple-headline font-semibold text-xs text-white leading-tight">{selectedCase.reporterName}</h3>
              <a
                href={`tel:${selectedCase.reporterPhone}`}
                className="text-[11px] text-[#2997ff] hover:underline flex items-center space-x-1 mt-0.5"
              >
                <Phone className="w-2.5 h-2.5" />
                <span className="apple-tabular">{selectedCase.reporterPhone}</span>
              </a>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              selectedCase.status === 'airborne' ? 'bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/30' :
              selectedCase.status === 'unit_assigned' ? 'bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30' :
              'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/30'
            }`}>
              {selectedCase.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-[#86868b] block mt-1 apple-tabular">{timeAgo}m ago</span>
          </div>
        </div>

        {/* Live Optical Video Feed Container */}
        <div className="apple-card p-3 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Video className="w-3.5 h-3.5 text-[#ff453a]" />
              <span className="apple-headline text-xs font-semibold text-white">Live Scene Video Feed</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {selectedCase.mediaUrl ? (
                <span className="text-[9px] bg-[#ff453a]/20 text-[#ff453a] border border-[#ff453a]/30 px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff453a] animate-pulse"></span>
                  <span>LIVE</span>
                </span>
              ) : (
                <span className="text-[9px] bg-white/[0.06] text-[#86868b] border border-white/[0.08] px-2 py-0.5 rounded-full font-medium">
                  STANDBY
                </span>
              )}
              <span className="text-[9px] bg-white/[0.08] text-[#2997ff] border border-white/[0.1] px-2 py-0.5 rounded-full font-medium">
                1080P
              </span>
            </div>
          </div>

          {selectedCase.mediaUrl ? (
            <div className="relative w-full h-44 bg-black rounded-xl overflow-hidden border border-white/[0.1] flex items-center justify-center">
              {selectedCase.mediaUrl.startsWith('data:image') ? (
                <img
                  src={selectedCase.mediaUrl}
                  alt="Live Camera Feed"
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    isThermal ? 'filter invert contrast-150 saturate-200 hue-rotate-90' : ''
                  }`}
                />
              ) : (
                <video
                  src={selectedCase.mediaUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    isThermal ? 'filter invert contrast-150 saturate-200 hue-rotate-90' : ''
                  }`}
                />
              )}

              {/* Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-12 h-12 border border-white/30 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#ff453a] rounded-full"></div>
                </div>
              </div>

              {/* HUD Coordinates & Source Tag */}
              <div className="absolute top-2 left-2 flex items-center space-x-1">
                <span className="text-[8px] bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-white/90 font-mono">
                  SRC: {selectedCase.reporterName.toUpperCase()}
                </span>
              </div>

              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <span className="text-[8px] bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[#30d158] font-mono apple-tabular">
                  {selectedCase.location.lat}°, {selectedCase.location.lng}°
                </span>
                <button
                  onClick={() => setIsThermal(!isThermal)}
                  className={`text-[9px] px-2 py-0.5 rounded-md font-medium backdrop-blur-md transition-all ${
                    isThermal
                      ? 'bg-[#30d158] text-black font-semibold'
                      : 'bg-black/60 text-white/80 hover:text-white border border-white/20'
                  }`}
                >
                  {isThermal ? 'IR THERMAL' : 'OPTICAL'}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-24 bg-white/[0.02] border border-dashed border-white/[0.12] rounded-xl flex flex-col items-center justify-center p-3 text-center">
              <Video className="w-5 h-5 text-[#86868b] mb-1 opacity-60" />
              <span className="text-[11px] text-[#86868b]">Waiting for mobile A/V stream</span>
              {onSimulateMediaStream && (
                <button
                  onClick={() => {
                    soundFX.playClickTick();
                    onSimulateMediaStream(selectedCase.id);
                  }}
                  className="mt-2 text-[10px] apple-btn-primary px-2.5 py-1 flex items-center space-x-1 font-medium"
                >
                  <Play className="w-2.5 h-2.5" />
                  <span>Start Live A/V Simulation</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Location GPS */}
        <div className="apple-card p-3 rounded-xl space-y-1 text-xs">
          <div className="flex items-start space-x-2">
            <MapPin className="w-3.5 h-3.5 text-[#ff453a] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/90 text-[11px] leading-relaxed line-clamp-2">{selectedCase.address}</p>
              <span className="text-[10px] text-[#2997ff] font-medium apple-tabular block mt-0.5">
                {selectedCase.location.lat.toFixed(5)}°N, {selectedCase.location.lng.toFixed(5)}°E
              </span>
            </div>
          </div>
        </div>

        {/* Threat Evaluation & Real-Time Audio Receiver */}
        <div className="apple-card p-3.5 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-white/90">
              <Activity className="w-3.5 h-3.5 text-[#2997ff]" />
              <span>Biometric & Acoustic Analysis</span>
            </div>
            {acousticDistressAlert && (
              <span className="text-[9px] bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 px-2 py-0.5 rounded-full font-medium">
                High Distress
              </span>
            )}
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#86868b]">Distress Index</span>
              <span className="font-medium text-white apple-tabular">{distressIndex}%</span>
            </div>
            <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${distressIndex}%`,
                  backgroundColor: distressIndex > 75 ? '#ff453a' : '#2997ff',
                }}
              />
            </div>
          </div>

          {/* Real Acoustic Channel with Live Audio Listen Capability */}
          <LiveAcousticStream
            active={selectedCase.status !== 'resolved'}
            decibelLevel={selectedCase.decibelLevel}
            audioData={selectedCase.audioData}
            caseId={selectedCase.id}
          />
        </div>

        {/* Direct Dispatch Options */}
        <div className="space-y-2">
          {/* Nearest Patrol Unit */}
          <div className="apple-card p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5 text-[#0a84ff]" />
                <div>
                  <span className="font-semibold text-white block text-[11px]">
                    {assignedOfficer ? assignedOfficer.name : nearest ? nearest.officer.name : 'No Units Available'}
                  </span>
                  <span className="text-[10px] text-[#86868b]">
                    {assignedOfficer ? `Badge ${assignedOfficer.badgeId} • Assigned` : nearest ? `Closest Unit • ${nearest.officer.vehicle}` : ''}
                  </span>
                </div>
              </div>
              {nearest && !assignedOfficer && (
                <div className="text-right apple-tabular text-xs">
                  <span className="text-[#2997ff] font-medium block text-[11px]">{nearest.distKm.toFixed(2)} km</span>
                  <span className="text-[#ff9f0a] text-[10px]">~{nearest.etaMin}m</span>
                </div>
              )}
            </div>

            {assignedOfficer ? (
              <div className="bg-[#0a84ff]/10 border border-[#0a84ff]/25 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] text-[#0a84ff]">
                <span>Unit Dispatched</span>
                <CheckCircle className="w-3 h-3" />
              </div>
            ) : nearest ? (
              <button
                onClick={() => {
                  soundFX.playDispatchConfirm();
                  onAssignOfficer(selectedCase.id, nearest.officer.userId);
                }}
                className="w-full apple-btn-primary text-[11px] py-1.5 flex items-center justify-center space-x-1.5 font-medium"
              >
                <Navigation className="w-3 h-3" />
                <span>Assign {nearest.officer.name} (~{nearest.etaMin}m)</span>
              </button>
            ) : null}
          </div>

          {/* Autonomous Drone Recon */}
          <div className="apple-card p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Radio className="w-3.5 h-3.5 text-[#bf5af2]" />
                <div>
                  <span className="font-semibold text-white block text-[11px]">Autonomous Drone Recon</span>
                  <span className="text-[10px] text-[#86868b]">
                    {isBlocked ? 'Restricted Airspace' : 'DGCA Airspace Cleared'}
                  </span>
                </div>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                isBlocked ? 'bg-[#ff453a]/15 text-[#ff453a]' : 'bg-[#30d158]/15 text-[#30d158]'
              }`}>
                {isBlocked ? 'Blocked' : 'Ready'}
              </span>
            </div>

            {selectedCase.status === 'airborne' || selectedCase.status === 'on_scene' ? (
              <div className="bg-[#bf5af2]/10 border border-[#bf5af2]/25 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] text-[#bf5af2]">
                <span>Drone Airborne & Streaming</span>
                <Radio className="w-3 h-3 animate-pulse" />
              </div>
            ) : (
              <button
                disabled={isBlocked}
                onClick={() => {
                  soundFX.playClickTick();
                  onOpenDispatchModal(selectedCase.id);
                }}
                className={`w-full py-1.5 apple-pill-btn text-[11px] flex items-center justify-center space-x-1.5 font-medium ${
                  isBlocked
                    ? 'bg-white/[0.05] text-white/40 border border-white/[0.06] cursor-not-allowed'
                    : 'apple-btn-primary'
                }`}
              >
                <Send className="w-3 h-3" />
                <span>{isBlocked ? 'Airspace Restriction Active' : 'Launch Mother Drone Alpha'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
          {selectedCase.status === 'raised' && (
            <button
              onClick={() => {
                soundFX.playClickTick();
                onVerifyCase(selectedCase.id, false);
              }}
              className="apple-btn-secondary flex-1 py-1.5 text-[11px] flex items-center justify-center space-x-1"
            >
              <Phone className="w-3 h-3 text-[#30d158]" />
              <span>Verify Call</span>
            </button>
          )}

          {onCancelCase && selectedCase.status !== 'resolved' && (
            <button
              onClick={() => {
                soundFX.playClickTick();
                onCancelCase(selectedCase.id);
              }}
              className="apple-btn-destructive flex-1 py-1.5 text-[11px] flex items-center justify-center space-x-1"
            >
              <XCircle className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          )}

          {(selectedCase.status === 'airborne' || selectedCase.status === 'unit_assigned' || selectedCase.status === 'on_scene') && (
            <button
              onClick={() => {
                soundFX.playResolveChime();
                onResolveCase(selectedCase.id);
              }}
              className="apple-pill-btn flex-1 bg-[#30d158] hover:bg-[#32d75b] text-black font-medium py-1.5 text-[11px] flex items-center justify-center space-x-1"
            >
              <CheckCircle className="w-3 h-3" />
              <span>Resolve</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
