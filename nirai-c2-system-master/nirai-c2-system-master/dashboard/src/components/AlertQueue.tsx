import React, { useState, useEffect } from 'react';
import { Clock, MapPin, User, Send, PhoneCall, XCircle, Activity, Mic, Search, ShieldAlert } from 'lucide-react';
import { Case } from '../types';
import { checkRedZoneCollision } from './LiveMap';
import { soundFX } from '../utils/audioEffects';

interface AlertQueueProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onVerifyCase: (caseId: string, isFalseAlarm: boolean) => void;
  onOpenDispatchModal: (caseId: string) => void;
  onCancelCase?: (caseId: string) => void;
}

// Subtle Organic Decibel Meter (Apple Health style, no aggressive strobe)
const DecibelMeter: React.FC<{ active: boolean }> = ({ active }) => {
  const [levels, setLevels] = useState([8, 14, 10, 16, 20, 12, 16, 10, 18, 8]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setLevels(prev => prev.map(() => Math.floor(Math.random() * 14) + 4));
    }, 220);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="flex items-center space-x-2 bg-black/30 px-2.5 py-1.5 rounded-full border border-white/[0.06]">
      <Mic className={`w-3 h-3 ${active ? 'text-[#2997ff]' : 'text-[#86868b]'}`} />
      <span className="text-[10px] text-[#86868b] font-medium">Live Audio</span>
      <div className="flex items-center space-x-1 h-2.5">
        {levels.map((level, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-200"
            style={{
              height: active ? `${Math.min(10, level / 2)}px` : '2.5px',
              backgroundColor: active ? (i % 2 === 0 ? 'rgba(41, 151, 255, 0.7)' : 'rgba(0, 113, 227, 0.45)') : 'rgba(255, 255, 255, 0.12)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const AlertQueue: React.FC<AlertQueueProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onVerifyCase,
  onOpenDispatchModal,
  onCancelCase,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'critical' | 'verifying' | 'dispatched'>('all');

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');

  const filteredCases = activeCases.filter(c => {
    const matchesSearch = searchFilter === '' || 
      c.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.reporterName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.address.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    if (statusTab === 'critical') return c.severityScore >= 5;
    if (statusTab === 'verifying') return c.status === 'raised' || c.status === 'verifying';
    if (statusTab === 'dispatched') return c.status === 'airborne' || c.status === 'unit_assigned' || c.status === 'on_scene';
    return true;
  });

  const getAiTelemetry = (c: Case) => {
    const numericId = c.id.split('-')[1] || '1';
    const isOdd = numericId.charCodeAt(numericId.length - 1) % 2 === 1;
    const stressScore = Math.min(95, Math.max(45, (c.severityScore * 10) + (isOdd ? 14 : 4)));
    const acousticDistress = c.severityScore >= 5;
    return { stressScore, acousticDistress };
  };

  return (
    <div className="liquid-glass border-r border-white/[0.08] flex flex-col h-full overflow-hidden select-none">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-apple-pulse" />
          <h2 className="apple-headline text-xs font-semibold text-white tracking-tight">
            Incident Queue
          </h2>
        </div>
        <span className="bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/30 text-[10px] px-2 py-0.5 rounded-full font-medium apple-tabular">
          {activeCases.length} Active
        </span>
      </div>

      {/* Quick Search & Status Filter Tabs */}
      <div className="p-3 border-b border-white/[0.06] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search incident, citizen, place..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-black/30 border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#86868b] focus:outline-none focus:border-[#2997ff]/60 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'all'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'bg-white/[0.04] text-[#86868b] hover:text-white'
            }`}
          >
            All ({activeCases.length})
          </button>
          <button
            onClick={() => setStatusTab('critical')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'critical'
                ? 'bg-[#ff453a] text-white font-semibold shadow-sm'
                : 'bg-white/[0.04] text-[#86868b] hover:text-white'
            }`}
          >
            High ({activeCases.filter(c => c.severityScore >= 5).length})
          </button>
          <button
            onClick={() => setStatusTab('verifying')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'verifying'
                ? 'bg-[#ff9f0a] text-black font-semibold shadow-sm'
                : 'bg-white/[0.04] text-[#86868b] hover:text-white'
            }`}
          >
            Verify
          </button>
          <button
            onClick={() => setStatusTab('dispatched')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusTab === 'dispatched'
                ? 'bg-[#2997ff] text-white font-semibold shadow-sm'
                : 'bg-white/[0.04] text-[#86868b] hover:text-white'
            }`}
          >
            Dispatched
          </button>
        </div>
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredCases.length === 0 ? (
          <div className="text-center py-16 text-[#86868b] text-xs">
            {searchFilter ? 'No matching incidents' : 'All Clear — No Incidents'}
          </div>
        ) : (
          filteredCases.map((c) => {
            const isSelected = c.id === selectedCaseId;
            const timeAgo = Math.max(1, Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000));
            const { stressScore, acousticDistress } = getAiTelemetry(c);
            // Guard against null/invalid location before calling red-zone check
            const hasValidLocation = !c.locationUnavailable &&
              c.location &&
              typeof c.location.lat === 'number' &&
              typeof c.location.lng === 'number' &&
              Number.isFinite(c.location.lat) &&
              Number.isFinite(c.location.lng) &&
              c.location.lat >= -90 && c.location.lat <= 90 &&
              c.location.lng >= -180 && c.location.lng <= 180 &&
              !(c.location.lat === 0 && c.location.lng === 0);
            const insideRedZone = hasValidLocation
              ? checkRedZoneCollision(c.location.lat, c.location.lng)
              : false;

            return (
              <div
                key={c.id}
                onClick={() => {
                  soundFX.playClickTick();
                  onSelectCase(c.id);
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/[0.09] border-[#2997ff]/70 shadow-lg ring-1 ring-[#2997ff]/40'
                    : 'apple-card apple-card-hover'
                }`}
              >
                {/* Header line */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-white apple-tabular">{c.id}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'airborne' ? 'bg-[#bf5af2]/20 text-[#bf5af2]' :
                      c.status === 'unit_assigned' ? 'bg-[#ff9f0a]/20 text-[#ff9f0a]' :
                      'bg-[#ff453a]/15 text-[#ff453a]'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-[#86868b] text-[10px]">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="apple-tabular">{timeAgo}m ago</span>
                  </div>
                </div>

                {/* Reporter & Location */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center text-white/90 font-medium">
                    {c.reporterPhotoUrl ? (
                      <img
                        src={c.reporterPhotoUrl}
                        alt={c.reporterName}
                        className="w-4 h-4 rounded-full mr-1.5 object-cover border border-white/20"
                      />
                    ) : (
                      <User className="w-3 h-3 text-[#86868b] mr-1.5 flex-shrink-0" />
                    )}
                    <span className="text-[11px]">{c.reporterName}</span>
                    <span className="text-[#86868b] text-[10px] ml-1 apple-tabular">({c.reporterPhone})</span>
                  </div>
                  <div className="flex items-start text-[#f5f5f7] text-[11px]">
                    <MapPin className="w-3 h-3 text-[#ff453a] mr-1 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="line-clamp-1 text-white/80 text-[11px]">{c.address}</span>
                      <div className="text-[10px] mt-0.5 apple-tabular">
                        {hasValidLocation ? (
                          <span className="text-[#2997ff]">
                            {c.location.lat}°, {c.location.lng}°
                          </span>
                        ) : (
                          <span className="text-[#ff9f0a] flex items-center space-x-1">
                            <span>⚠ Location unavailable — GPS not yet received</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telemetry strip */}
                <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-2 text-[#86868b]">
                    <span className="apple-tabular">Distress: {stressScore}%</span>
                    {acousticDistress && (
                      <span className="text-[#ff453a] font-medium flex items-center space-x-1">
                        <ShieldAlert className="w-2.5 h-2.5" />
                        <span>Acoustic Peak</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Waveform */}
                <div className="mt-1.5">
                  <DecibelMeter active={c.status === 'raised' || c.status === 'verifying' || c.status === 'unit_assigned'} />
                </div>

                {/* Quick actions */}
                <div className="mt-2.5 flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/[0.06]">
                  {c.status === 'raised' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFX.playClickTick();
                        onVerifyCase(c.id, false);
                      }}
                      className="apple-btn-secondary text-[10px] py-0.5 px-2 inline-flex items-center space-x-1"
                    >
                      <PhoneCall className="w-2.5 h-2.5 text-[#30d158]" />
                      <span>Verify</span>
                    </button>
                  )}

                  {onCancelCase && c.status !== 'resolved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFX.playClickTick();
                        onCancelCase(c.id);
                      }}
                      className="apple-btn-destructive text-[10px] py-0.5 px-2 inline-flex items-center space-x-1"
                    >
                      <XCircle className="w-2.5 h-2.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {c.status !== 'airborne' && c.status !== 'on_scene' && (
                    <button
                      disabled={insideRedZone}
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFX.playClickTick();
                        onOpenDispatchModal(c.id);
                      }}
                      className={`text-[10px] py-0.5 px-2.5 apple-pill-btn inline-flex items-center space-x-1 ${
                        insideRedZone
                          ? 'bg-white/[0.05] text-white/40 cursor-not-allowed border border-white/[0.06]'
                          : 'apple-btn-primary'
                      }`}
                    >
                      <Send className="w-2.5 h-2.5" />
                      <span>Dispatch Drone</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
