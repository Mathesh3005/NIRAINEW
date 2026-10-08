import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Activity, 
  Terminal, 
  Trash2, 
  LogOut, 
  UserCheck, 
  Sliders, 
  Navigation, 
  Clock, 
  Cpu, 
  Search, 
  Volume2, 
  VolumeX, 
  PanelLeftClose, 
  PanelLeft,
  MoreHorizontal
} from 'lucide-react';
import { Case } from '../types';
import { UserSession } from './DashboardAuthScreen';
import { soundFX } from '../utils/audioEffects';

interface HeaderProps {
  cases: Case[];
  isConnected: boolean;
  onOpenAuditLog: () => void;
  onOpenSimulator: () => void;
  onClearAllRecords: () => void;
  onOpenSuperAdminModal?: () => void;
  onOpenCommandPalette?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  session?: UserSession | null;
  onLogout?: () => void;
  operatorLocation?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  gpsStatus?: 'acquiring' | 'locked' | 'denied' | 'unsupported' | 'manual_pick';
  onForceRequestGps?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  isConnected,
  onOpenAuditLog,
  onOpenSimulator,
  onClearAllRecords,
  onOpenSuperAdminModal,
  onOpenCommandPalette,
  sidebarCollapsed = false,
  onToggleSidebar,
  isAudioMuted = false,
  onToggleAudio,
  session,
  onLogout,
  operatorLocation,
  gpsStatus = 'acquiring',
  onForceRequestGps
}) => {
  const [sessionRemaining, setSessionRemaining] = useState<string>('24h');
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsSystemMenuOpen(false);
      }
    };
    if (isSystemMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSystemMenuOpen]);

  useEffect(() => {
    const updateTimers = () => {
      if (session?.expiresAt) {
        const diff = session.expiresAt - Date.now();
        if (diff <= 0) {
          setSessionRemaining('Expired');
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setSessionRemaining(`${hours}h ${mins.toString().padStart(2, '0')}m`);
        }
      }
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');

  return (
    <header className="liquid-glass-nav h-14 px-4 flex items-center justify-between z-40 relative select-none border-b border-white/[0.08]">
      {/* Left Section: Brand & Sidebar Control + Search */}
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            onClick={() => {
              soundFX.playClickTick();
              onToggleSidebar();
            }}
            title={sidebarCollapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-center text-[#86868b] hover:text-white transition-all"
          >
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4 text-[#2997ff]" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}

        <div className="flex items-center space-x-2.5 mr-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#2997ff]/20 to-[#0071e3]/30 border border-[#2997ff]/30 flex items-center justify-center shadow-[0_2px_10px_rgba(0,113,227,0.25)]">
            <Shield className="w-3.5 h-3.5 text-[#2997ff]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="apple-headline text-sm font-semibold text-white tracking-tight">NIRAI C2</span>
              <span className="bg-white/[0.08] text-white/90 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-white/[0.1]">
                Pro
              </span>
            </div>
          </div>
        </div>

        {/* Global Spotlight Search Pill */}
        {onOpenCommandPalette && (
          <button
            onClick={() => {
              soundFX.playClickTick();
              onOpenCommandPalette();
            }}
            className="liquid-glass-pill h-8 px-3 rounded-full hidden sm:inline-flex items-center space-x-2 text-xs text-[#86868b] hover:text-white group"
            title="Open Command Palette (⌘K / Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-[#2997ff] group-hover:scale-110 transition-transform" />
            <span className="text-[11px]">Command or search...</span>
            <kbd className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded border border-white/10 font-mono text-white/50">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Center Section: Sleek Unified Telemetry Capsule */}
      <div className="hidden lg:flex items-center">
        <div className="liquid-glass-pill px-4 py-1.5 rounded-full flex items-center space-x-3 text-xs">
          {/* HQ GPS Status */}
          <button
            onClick={onForceRequestGps}
            className="flex items-center space-x-1.5 hover:text-white transition-colors"
            title="HQ GPS fix — click to re-acquire"
          >
            {gpsStatus === 'locked' ? (
              <span className="w-2 h-2 rounded-full bg-[#30d158]" />
            ) : (
              <Navigation className="w-3 h-3 text-[#ff9f0a] animate-spin" />
            )}
            <span className="text-[11px] text-[#86868b]">HQ:</span>
            <span className="text-[11px] font-medium text-white/90 apple-tabular">
              {operatorLocation ? `${operatorLocation.lat.toFixed(3)}°, ${operatorLocation.lng.toFixed(3)}°` : 'Acquiring...'}
            </span>
          </button>

          <span className="w-px h-3 bg-white/15" />

          {/* Incidents Count */}
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${activeCases.length > 0 ? 'bg-[#ff453a] animate-apple-pulse' : 'bg-[#30d158]'}`} />
            <span className="text-[11px] text-[#86868b]">Incidents:</span>
            <span className={`text-[11px] font-semibold apple-tabular ${activeCases.length > 0 ? 'text-[#ff453a]' : 'text-[#30d158]'}`}>
              {activeCases.length}
            </span>
          </div>

          <span className="w-px h-3 bg-white/15" />

          {/* Gateway Status */}
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3 h-3 text-[#30d158]" />
            <span className="text-[11px] text-[#30d158] font-medium">
              {isConnected ? 'Online' : 'Standby'}
            </span>
          </div>

          <span className="w-px h-3 bg-white/15" />

          {/* Session TTL */}
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-[#2997ff]" />
            <span className="text-[10px] text-[#86868b] apple-tabular">{sessionRemaining}</span>
          </div>
        </div>
      </div>

      {/* Right Section: Sensory Toggle + User Capsule + Action Popover */}
      <div className="flex items-center space-x-2">
        {/* Audio Cue Mute/Unmute Toggle */}
        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-center text-[#86868b] hover:text-white transition-all"
            title={isAudioMuted ? "Unmute Audio Cues" : "Mute Audio Cues"}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-[#ff453a]" /> : <Volume2 className="w-3.5 h-3.5 text-[#30d158]" />}
          </button>
        )}

        {/* User Profile Capsule */}
        {session && (
          <div className="liquid-glass-pill h-8 px-2.5 rounded-full flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-[#2997ff]/20 border border-[#2997ff]/30 flex items-center justify-center">
              <UserCheck className="w-3 h-3 text-[#2997ff]" />
            </div>
            <span className="text-[11px] font-medium text-white/90 max-w-[100px] truncate">{session.name}</span>
            <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded-full ${
              session.isSuperAdmin
                ? 'bg-[#ff9f0a]/20 text-[#ff9f0a] border border-[#ff9f0a]/30'
                : 'bg-white/[0.08] text-[#86868b]'
            }`}>
              {session.role}
            </span>
          </div>
        )}

        {/* Consolidated System Actions Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              soundFX.playClickTick();
              setIsSystemMenuOpen(!isSystemMenuOpen);
            }}
            className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center ${
              isSystemMenuOpen 
                ? 'bg-[#2997ff]/20 border-[#2997ff]/50 text-[#2997ff]' 
                : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#86868b] hover:text-white'
            }`}
            title="System Controls & Tools"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Liquid Glass Dropdown Popover */}
          {isSystemMenuOpen && (
            <div className="absolute right-0 top-10 w-56 liquid-glass rounded-2xl p-1.5 shadow-2xl border border-white/[0.12] z-50 animate-scaleUp text-xs space-y-0.5">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">
                System Controls
              </div>

              <button
                onClick={() => {
                  soundFX.playClickTick();
                  setIsSystemMenuOpen(false);
                  onOpenSimulator();
                }}
                className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-white/90 hover:bg-white/[0.08] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-[#2997ff]" />
                  <span>Simulator</span>
                </div>
                <kbd className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-[#86868b]">S</kbd>
              </button>

              <button
                onClick={() => {
                  soundFX.playClickTick();
                  setIsSystemMenuOpen(false);
                  onOpenAuditLog();
                }}
                className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-white/90 hover:bg-white/[0.08] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Cpu className="w-3.5 h-3.5 text-[#bf5af2]" />
                  <span>Audit Evidence Log</span>
                </div>
                <kbd className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-[#86868b]">L</kbd>
              </button>

              {session?.isSuperAdmin && onOpenSuperAdminModal && (
                <button
                  onClick={() => {
                    soundFX.playClickTick();
                    setIsSystemMenuOpen(false);
                    onOpenSuperAdminModal();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-[#ff9f0a] hover:bg-[#ff9f0a]/10 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Admin Governance</span>
                  </div>
                  <kbd className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-[#86868b]">G</kbd>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.06]" />

              <button
                onClick={() => {
                  soundFX.playClickTick();
                  setIsSystemMenuOpen(false);
                  onClearAllRecords();
                }}
                className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2 text-[#ff453a] hover:bg-[#ff453a]/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset All Records</span>
              </button>

              {onLogout && (
                <button
                  onClick={() => {
                    soundFX.playClickTick();
                    setIsSystemMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2 text-[#86868b] hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
