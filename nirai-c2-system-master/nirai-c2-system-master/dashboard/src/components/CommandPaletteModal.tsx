import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertCircle, Shield, Radio, Terminal, Cpu, Sliders, Trash2, Navigation, Volume2, VolumeX, X, CornerDownLeft } from 'lucide-react';
import { Case, Officer, Drone } from '../types';
import { UserSession } from './DashboardAuthScreen';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  session?: UserSession | null;
  onSelectCase: (caseId: string) => void;
  onSelectOfficer?: (officerId: string) => void;
  onSelectDrone?: (droneId: string) => void;
  onRecenterMap?: () => void;
  onOpenSimulator: () => void;
  onOpenAuditLog: () => void;
  onOpenSuperAdminModal?: () => void;
  onClearAllRecords?: () => void;
  onToggleSidebar?: () => void;
  isMuted?: boolean;
  onToggleAudio?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  cases,
  officers,
  drones,
  session,
  onSelectCase,
  onSelectOfficer,
  onSelectDrone,
  onRecenterMap,
  onOpenSimulator,
  onOpenAuditLog,
  onOpenSuperAdminModal,
  onClearAllRecords,
  onToggleSidebar,
  isMuted,
  onToggleAudio,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  const q = query.toLowerCase().trim();

  // Search cases
  const matchingCases = activeCases.filter(c => 
    c.id.toLowerCase().includes(q) ||
    c.reporterName.toLowerCase().includes(q) ||
    c.reporterPhone.includes(q) ||
    c.address.toLowerCase().includes(q)
  );

  // Search officers
  const matchingOfficers = officers.filter(o =>
    o.name.toLowerCase().includes(q) ||
    o.badgeId.toLowerCase().includes(q) ||
    o.vehicle.toLowerCase().includes(q)
  );

  // Search drones
  const matchingDrones = drones.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.id.toLowerCase().includes(q) ||
    d.status.toLowerCase().includes(q)
  );

  // Quick action commands
  const quickActions = [
    ...(onRecenterMap ? [{
      id: 'action-recenter',
      title: 'Recenter Map to Station HQ',
      category: 'Navigation',
      icon: <Navigation className="w-4 h-4 text-[#2997ff]" />,
      shortcut: 'R',
      run: () => { onRecenterMap(); onClose(); },
    }] : []),
    ...(onToggleSidebar ? [{
      id: 'action-sidebar',
      title: 'Toggle Left Incident Sidebar',
      category: 'View',
      icon: <Search className="w-4 h-4 text-[#30d158]" />,
      shortcut: '[',
      run: () => { onToggleSidebar(); onClose(); },
    }] : []),
    ...(onToggleAudio ? [{
      id: 'action-audio',
      title: isMuted ? 'Unmute Audio Cues' : 'Mute Audio Cues',
      category: 'Preferences',
      icon: isMuted ? <VolumeX className="w-4 h-4 text-[#ff9f0a]" /> : <Volume2 className="w-4 h-4 text-[#30d158]" />,
      shortcut: 'M',
      run: () => { onToggleAudio(); onClose(); },
    }] : []),
    {
      id: 'action-sim',
      title: 'Open Incident Simulator',
      category: 'Testing',
      icon: <Terminal className="w-4 h-4 text-[#2997ff]" />,
      shortcut: 'S',
      run: () => { onOpenSimulator(); onClose(); },
    },
    {
      id: 'action-audit',
      title: 'View Evidence Log & Chain-of-Custody',
      category: 'Security',
      icon: <Cpu className="w-4 h-4 text-[#bf5af2]" />,
      shortcut: 'L',
      run: () => { onOpenAuditLog(); onClose(); },
    },
    ...(session?.isSuperAdmin && onOpenSuperAdminModal ? [{
      id: 'action-admin',
      title: 'Open Super Admin Governance Console',
      category: 'Administration',
      icon: <Sliders className="w-4 h-4 text-[#ff9f0a]" />,
      shortcut: 'G',
      run: () => { onOpenSuperAdminModal(); onClose(); },
    }] : []),
    ...(onClearAllRecords ? [{
      id: 'action-erase',
      title: 'Reset All Active Records',
      category: 'Maintenance',
      icon: <Trash2 className="w-4 h-4 text-[#ff453a]" />,
      shortcut: '⇧⌫',
      run: () => { onClearAllRecords(); onClose(); },
    }] : []),
  ].filter(a => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));

  // Flattened results list for keyboard navigation
  const flatItems: Array<{ id: string; run: () => void }> = [
    ...matchingCases.map(c => ({ id: c.id, run: () => { onSelectCase(c.id); onClose(); } })),
    ...matchingOfficers.map(o => ({ id: o.userId, run: () => { if (onSelectOfficer) onSelectOfficer(o.userId); onClose(); } })),
    ...matchingDrones.map(d => ({ id: d.id, run: () => { if (onSelectDrone) onSelectDrone(d.id); onClose(); } })),
    ...quickActions.map(a => ({ id: a.id, run: a.run })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, flatItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        flatItems[selectedIndex].run();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xl flex items-start justify-center z-[99999] pt-20 p-4 select-none animate-fadeIn">
      <div className="w-full max-w-2xl apple-glass rounded-3xl shadow-2xl border border-white/[0.12] overflow-hidden flex flex-col">
        {/* Search Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center space-x-3">
          <Search className="w-5 h-5 text-[#2997ff]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, case ID, citizen, or unit..."
            className="w-full bg-transparent text-sm text-white placeholder-[#86868b] focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white transition-all text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[420px] overflow-y-auto p-3 space-y-4 text-xs">
          {flatItems.length === 0 && (
            <div className="py-12 text-center text-[#86868b]">
              No matching incidents, units, or commands
            </div>
          )}

          {/* Matching Cases */}
          {matchingCases.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-[#86868b] px-3 uppercase tracking-wider block mb-1">
                Active Incidents ({matchingCases.length})
              </span>
              <div className="space-y-1">
                {matchingCases.map((c) => {
                  const itemIndex = flatItems.findIndex(item => item.id === c.id);
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={c.id}
                      onClick={() => { onSelectCase(c.id); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                        isSelected ? 'bg-white/[0.12] text-white shadow-sm' : 'hover:bg-white/[0.05] text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <AlertCircle className="w-4 h-4 text-[#ff453a] flex-shrink-0" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-white apple-tabular">{c.id}</span>
                            <span className="text-[11px] font-medium text-white/90">{c.reporterName}</span>
                            <span className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] px-2 py-0.2 rounded-full">
                              Score: {c.severityScore}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#86868b] truncate max-w-md">{c.address}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#86868b] flex items-center space-x-1">
                        <span>Select</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Officers */}
          {matchingOfficers.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-[#86868b] px-3 uppercase tracking-wider block mb-1">
                Patrol Units ({matchingOfficers.length})
              </span>
              <div className="space-y-1">
                {matchingOfficers.map((o) => {
                  const itemIndex = flatItems.findIndex(item => item.id === o.userId);
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={o.userId}
                      onClick={() => { if (onSelectOfficer) onSelectOfficer(o.userId); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                        isSelected ? 'bg-white/[0.12] text-white' : 'hover:bg-white/[0.05] text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Shield className="w-4 h-4 text-[#0a84ff]" />
                        <div>
                          <span className="font-semibold text-white">{o.name}</span>
                          <span className="text-[11px] text-[#86868b] ml-2">Badge {o.badgeId} • {o.vehicle}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${o.onDuty ? 'bg-[#30d158]/20 text-[#30d158]' : 'bg-white/[0.08] text-[#86868b]'}`}>
                        {o.onDuty ? 'On Duty' : 'Off Duty'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Drones */}
          {matchingDrones.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-[#86868b] px-3 uppercase tracking-wider block mb-1">
                Drone Recon Fleet ({matchingDrones.length})
              </span>
              <div className="space-y-1">
                {matchingDrones.map((d) => {
                  const itemIndex = flatItems.findIndex(item => item.id === d.id);
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={d.id}
                      onClick={() => { if (onSelectDrone) onSelectDrone(d.id); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                        isSelected ? 'bg-white/[0.12] text-white' : 'hover:bg-white/[0.05] text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Radio className="w-4 h-4 text-[#bf5af2]" />
                        <div>
                          <span className="font-semibold text-white">{d.name}</span>
                          <span className="text-[11px] text-[#86868b] ml-2">Alt {d.altitudeMeters}m • Battery {d.batteryPct}%</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-white/[0.08] text-white/80 px-2 py-0.5 rounded-full">
                        {d.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-[#86868b] px-3 uppercase tracking-wider block mb-1">
                System Commands
              </span>
              <div className="space-y-1">
                {quickActions.map((action) => {
                  const itemIndex = flatItems.findIndex(item => item.id === action.id);
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={action.id}
                      onClick={action.run}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                        isSelected ? 'bg-white/[0.12] text-white shadow-sm' : 'hover:bg-white/[0.05] text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {action.icon}
                        <span className="font-medium">{action.title}</span>
                      </div>
                      <kbd className="text-[10px] bg-black/40 border border-white/[0.1] px-2 py-0.5 rounded text-[#86868b] font-mono">
                        {action.shortcut}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-5 py-2.5 border-t border-white/[0.06] bg-black/30 flex items-center justify-between text-[11px] text-[#86868b]">
          <div className="flex items-center space-x-3">
            <span><kbd className="bg-black/40 border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px] mr-1">↑↓</kbd>Navigate</span>
            <span><kbd className="bg-black/40 border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px] mr-1">↵</kbd>Select</span>
            <span><kbd className="bg-black/40 border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px] mr-1">Esc</kbd>Dismiss</span>
          </div>
          <span className="text-[10px]">NIRAI Spotlight</span>
        </div>
      </div>
    </div>
  );
};
