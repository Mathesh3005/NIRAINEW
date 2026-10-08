import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Header } from './components/Header';
import { LiveMap } from './components/LiveMap';
import { AlertQueue } from './components/AlertQueue';
import { PoliceTracker } from './components/PoliceTracker';
import { DroneControlPanel } from './components/DroneControlPanel';
import { IncidentInspectorCard } from './components/IncidentInspectorCard';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AuditLogModal } from './components/AuditLogModal';
import { SimulatorControls } from './components/SimulatorControls';
import { ConnectedDevicesPanel } from './components/ConnectedDevicesPanel';
import { DashboardAuthScreen, UserSession } from './components/DashboardAuthScreen';
import { SuperAdminModal } from './components/SuperAdminModal';
import { Case, Officer, Drone, AuditLog, Location } from './types';
import { soundFX } from './utils/audioEffects';
import { 
  AlertCircle, 
  Navigation, 
  MapPin, 
  Crosshair, 
  PanelLeft, 
  ShieldCheck, 
  Minimize2, 
  Maximize2, 
  Layers,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4000`;

async function dashboardFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in with an authorized dashboard account to continue.');
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCaseLocation(data: Record<string, unknown>): Location | null {
  if (data.locationUnavailable === true) return null;

  const nestedLocation = data.location;
  const location = nestedLocation && typeof nestedLocation === 'object' && !Array.isArray(nestedLocation)
    ? nestedLocation as Record<string, unknown>
    : {};
  const lat = parseCoordinate(location.lat ?? location.latitude ?? data.lat ?? data.latitude);
  const lng = parseCoordinate(location.lng ?? location.longitude ?? location.lon ?? data.lng ?? data.longitude ?? data.lon);

  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
    return null;
  }
  return { lat, lng };
}

function normalizeCase(caseItem: Case): Case {
  const location = normalizeCaseLocation(caseItem as unknown as Record<string, unknown>);
  return {
    ...caseItem,
    location: location as Case['location'],
    locationUnavailable: location === null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasValidCaseLocation(caseItem: Case): boolean {
  return !caseItem.locationUnavailable &&
    normalizeCaseLocation(caseItem as unknown as Record<string, unknown>) !== null;
}

async function postBackendAction(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await dashboardFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`Backend returned an invalid response (HTTP ${response.status}).`);
  }

  const result = isRecord(payload) ? payload : null;
  if (!response.ok || result?.success !== true) {
    const reason = typeof result?.error === 'string' && result.error.trim()
      ? result.error
      : `Backend rejected the request (HTTP ${response.status}).`;
    throw new Error(reason);
  }
  return result;
}

function confirmCaseActionResponse(result: Record<string, unknown>, caseId: string, expectedStatus: Case['status']) {
  if (!isRecord(result.case) || result.case.id !== caseId || result.case.status !== expectedStatus) {
    throw new Error('Backend response did not confirm the expected case status.');
  }
}

function reportBackendActionFailure(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${action} failed:`, error);
  window.alert(`${action} failed. ${message}`);
}

// Picture-in-Picture Drone Optical HUD Window (Liquid Glass)
const FloatingDronePiP: React.FC<{
  drone: Drone;
  onClose?: () => void;
}> = ({ drone, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden shadow-2xl border border-white/[0.14] transition-all select-none animate-slideInRight">
      <div className="px-3 py-1.5 bg-black/40 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff453a] animate-apple-pulse"></span>
          <span className="text-[11px] font-semibold text-white tracking-tight">Recon Feed</span>
          <span className="text-[10px] text-[#2997ff] apple-tabular">{drone.name}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-5 h-5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white text-xs transition-colors"
            title={isMinimized ? "Expand PiP" : "Minimize PiP"}
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-5 h-5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#86868b] hover:text-white text-xs transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {!isMinimized && (
        <div className="relative w-64 h-36 bg-black">
          {drone.streamUrl?.startsWith('data:image') ? (
            <img src={drone.streamUrl} alt="Drone Feed" className="w-full h-full object-cover" />
          ) : (
            <video src={drone.streamUrl || undefined} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          )}
          <div className="absolute top-2 left-2 text-[9px] bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[#30d158] border border-white/10 apple-tabular flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]"></span>
            <span>1080p • {drone.batteryPct}% BAT</span>
          </div>
          <div className="absolute bottom-2 right-2 text-[9px] bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-white/90 border border-white/10 apple-tabular">
            {drone.location.lat.toFixed(4)}°, {drone.location.lng.toFixed(4)}°
          </div>
        </div>
      )}
    </div>
  );
};

const DEFAULT_CASES: Case[] = [
  {
    id: 'case-101',
    reporterUserId: 'usr-c1',
    reporterName: 'Priya Sharma',
    reporterPhone: '+919876543210',
    status: 'raised',
    location: { lat: 13.0875, lng: 80.2790 },
    address: 'Near Central Railway Station, Gate 3, Chennai',
    severityScore: 7,
    createdAt: new Date(Date.now() - 180000).toISOString(),
    assignedOfficerUserId: 'usr-p1',
    assignedOfficerName: 'Insp. R. Arumugam',
    etaSeconds: 180,
    droneId: null,
    verificationNotes: 'Distress call initiated. Live optical uplink available.',
    mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=60',
    decibelLevel: 68
  }
];

const DEFAULT_OFFICERS: Officer[] = [
  {
    userId: 'usr-p1',
    name: 'Insp. R. Arumugam',
    badgeId: 'TNP-4091',
    onDuty: true,
    vehicle: 'Interceptor PCR-04',
    location: { lat: 13.0845, lng: 80.2740 },
    lastHeartbeat: new Date().toISOString()
  },
  {
    userId: 'usr-p2',
    name: 'Sub-Insp. S. Muthu',
    badgeId: 'TNP-5820',
    onDuty: true,
    vehicle: 'Swift Patrol Bike #12',
    location: { lat: 13.0780, lng: 80.2850 },
    lastHeartbeat: new Date().toISOString()
  }
];

const DEFAULT_DRONES: Drone[] = [
  {
    id: 'drone-m1',
    name: 'Mother Alpha (Airborne Command)',
    type: 'mother',
    status: 'airborne',
    batteryPct: 98,
    altitudeMeters: 65,
    speedKmh: 48,
    location: { lat: 13.0850, lng: 80.2760 },
    homeLocation: { lat: 13.0827, lng: 80.2707 }
  },
  {
    id: 'drone-c1',
    name: 'Recon Scout 01',
    type: 'child',
    status: 'docked',
    batteryPct: 95,
    altitudeMeters: 0,
    speedKmh: 0,
    location: { lat: 13.0850, lng: 80.2760 },
    parentMotherId: 'drone-m1',
    streamUrl: null
  },
  {
    id: 'drone-c2',
    name: 'Recon Scout 02',
    type: 'child',
    status: 'charging',
    batteryPct: 82,
    altitudeMeters: 0,
    speedKmh: 0,
    location: { lat: 13.0850, lng: 80.2760 },
    parentMotherId: 'drone-m1',
    streamUrl: null
  }
];

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-1',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    action: 'SOS_TRIGGERED',
    actor: 'Priya Sharma (+919876543210)',
    target: 'case-101',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },
  {
    id: 'aud-2',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    action: 'OFFICER_ASSIGNED',
    actor: 'Operator #4 (SPMCR)',
    target: 'case-101 (Assigned: Insp. R. Arumugam)',
    hash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'
  }
];

export function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  // Real-time GPS state
  const [operatorLocation, setOperatorLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'denied' | 'unsupported' | 'manual_pick'>('acquiring');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Core Data States (Initialized with rich situational baselines)
  const [cases, setCases] = useState<Case[]>(DEFAULT_CASES);
  const [officers, setOfficers] = useState<Officer[]>(DEFAULT_OFFICERS);
  const [drones, setDrones] = useState<Drone[]>(DEFAULT_DRONES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(DEFAULT_AUDIT_LOGS);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>('case-101');
  const [isConnected, setIsConnected] = useState(false);

  // Spatial Dashboard Controls
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [showPoliceUnitsDrawer, setShowPoliceUnitsDrawer] = useState(false);
  const [showConnectedNodes, setShowConnectedNodes] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(soundFX.getMuted());
  const [showPiPVideo, setShowPiPVideo] = useState(true);

  // Modals
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [dispatchModalCaseId, setDispatchModalCaseId] = useState<string | null>(null);

  // Refs
  const sessionRef = useRef(userSession);
  useEffect(() => { sessionRef.current = userSession; }, [userSession]);

  const operatorLocationRef = useRef(operatorLocation);
  useEffect(() => { operatorLocationRef.current = operatorLocation; }, [operatorLocation]);

  const knownCaseIdsRef = useRef<Set<string>>(new Set());
  const backendCaseIdsRef = useRef<Set<string>>(new Set());
  const suppressedFirebaseCaseIdsRef = useRef<Set<string>>(new Set());

  // GPS acquisition
  const acquireLiveGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setGpsStatus('acquiring');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp
        };
        setOperatorLocation(loc);
        setGpsStatus('locked');
        setShowLocationPicker(false);

        const sess = sessionRef.current;
        if (sess) {
          const updated = { ...sess, location: loc };
          setUserSession(updated);
          try { localStorage.setItem('nirai_c2_session', JSON.stringify(updated)); } catch (e) {}
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          if (!operatorLocationRef.current) {
            setShowLocationPicker(true);
          }
        } else {
          setGpsStatus('acquiring');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Continuous GPS watcher + session TTL checker
  useEffect(() => {
    const sessionTimer = setInterval(() => {
      const sess = sessionRef.current;
      if (sess?.expiresAt && Date.now() > sess.expiresAt) {
        setUserSession(null);
        setOperatorLocation(null);
        try { localStorage.removeItem('nirai_c2_session'); } catch (e) {}
      }
    }, 30000);

    acquireLiveGps();

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: pos.timestamp
          };
          setOperatorLocation(loc);
          setGpsStatus('locked');
          setShowLocationPicker(false);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus('denied');
            if (!operatorLocationRef.current) {
              setShowLocationPicker(true);
            }
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    return () => {
      clearInterval(sessionTimer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [acquireLiveGps]);

  // Handler for manual location pick
  const handleManualLocationPick = (lat: number, lng: number) => {
    const loc = { lat, lng, accuracy: 0, timestamp: Date.now() };
    setOperatorLocation(loc);
    setGpsStatus('manual_pick');
    setShowLocationPicker(false);

    const sess = sessionRef.current;
    if (sess) {
      const updated = { ...sess, location: loc };
      setUserSession(updated);
      try { localStorage.setItem('nirai_c2_session', JSON.stringify(updated)); } catch (e) {}
    }
  };

  // Firestore + WebSocket listeners
  useEffect(() => {
    if (!userSession) return;
    let unsubscribeCases: () => void = () => {};
    let unsubscribeAudit: () => void = () => {};

      try {
        const casesQuery = query(collection(db, 'cases'));
        unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
          const fbCases: Case[] = snapshot.docs.map(d => {
              const data = d.data();

              const resolvedLocation = normalizeCaseLocation(data);

              return {
                id: data.id || d.id,
                reporterUserId: data.reporterUserId || 'usr-mobile',
                reporterName: data.reporterName || 'Civilian User',
                reporterPhone: data.reporterPhone || '+919876543210',
                status: data.status || 'raised',
                location: resolvedLocation as Case['location'],
                locationUnavailable: !resolvedLocation,
                address: data.address || 'Emergency SOS Location',
                severityScore: data.severityScore || 5,
                createdAt: data.createdAt || new Date().toISOString(),
                assignedOfficerUserId: data.assignedOfficerUserId || null,
                assignedOfficerName: data.assignedOfficerName || null,
                etaSeconds: data.etaSeconds || null,
                droneId: data.droneId || null,
                verificationNotes: data.verificationNotes || 'Pending operator verification call.',
                mediaUrl: data.mediaUrl || undefined,
                audioData: data.audioData || undefined,
                decibelLevel: data.decibelLevel || undefined
              } as Case;
          });
          // Keep cases without valid coordinates in the queue; LiveMap excludes them from markers.

          // Sensory chime on newly arrived SOS
          fbCases.forEach(c => {
            if (!knownCaseIdsRef.current.has(c.id) && c.status === 'raised') {
              soundFX.playSosChime();
            }
            knownCaseIdsRef.current.add(c.id);
          });

          setCases(prev => {
            const fbMap = new Map<string, Case>();
            fbCases.forEach(c => {
              if (!suppressedFirebaseCaseIdsRef.current.has(c.id)) fbMap.set(c.id, c);
            });
            prev.forEach(c => {
              if (backendCaseIdsRef.current.has(c.id) || !fbMap.has(c.id)) fbMap.set(c.id, c);
            });
            return Array.from(fbMap.values());
          });
      }, (err) => console.warn('Firebase Cases Sync Warning:', err.message));

      const auditQuery = query(collection(db, 'auditLogs'));
      unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
        if (!snapshot.empty) {
          const fbLogs: AuditLog[] = snapshot.docs.map(d => d.data() as AuditLog);
          setAuditLogs(prev => {
            const m = new Map<string, AuditLog>();
            prev.forEach(l => m.set(l.id, l));
            fbLogs.forEach(l => m.set(l.id, l));
            return Array.from(m.values());
          });
        }
      }, (err) => console.warn('Firebase Audit Sync Warning:', err.message));
    } catch (e) {
      console.warn('Firebase listener initialization:', e);
    }

    dashboardFetch(`${API_BASE}/v1/drones/fleet`).then(r => r.json()).then(d => {
      if (d.success) setDrones(d.drones);
      else throw new Error(d.error || 'Could not load the drone fleet.');
    }).catch(console.error);
    dashboardFetch(`${API_BASE}/v1/officers/nearby`).then(r => r.json()).then(d => {
      if (d.success) setOfficers(d.officers);
      else throw new Error(d.error || 'Could not load nearby officers.');
    }).catch(console.error);

    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 16000;
    let shouldReconnect = true;

    async function connectWs() {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('No Firebase ID token is available for the dashboard connection.');
        const socketUrl = new URL(WS_URL);
        socketUrl.searchParams.set('token', token);
        ws = new WebSocket(socketUrl.toString());
      } catch (error) {
        console.error('Dashboard realtime authentication failed:', error);
        setIsConnected(false);
        if (shouldReconnect) {
          setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
            void connectWs();
          }, reconnectDelay);
        }
        return;
      }
      ws.onopen = () => { setIsConnected(true); reconnectDelay = 1000; };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'INITIAL_STATE') {
            const initialCases = (msg.payload.cases as Case[]).map(normalizeCase);
            const initialCaseIds = new Set(initialCases.map(caseItem => caseItem.id));
            backendCaseIdsRef.current.forEach(caseId => {
              if (!initialCaseIds.has(caseId)) suppressedFirebaseCaseIdsRef.current.add(caseId);
            });
            initialCases.forEach(caseItem => suppressedFirebaseCaseIdsRef.current.delete(caseItem.id));
            backendCaseIdsRef.current = initialCaseIds;
            setCases(prev => {
              const merged = new Map(initialCases.map(caseItem => [caseItem.id, caseItem]));
              prev.forEach(caseItem => {
                if (!initialCaseIds.has(caseItem.id) && !suppressedFirebaseCaseIdsRef.current.has(caseItem.id)) {
                  merged.set(caseItem.id, normalizeCase(caseItem));
                }
              });
              return Array.from(merged.values());
            });
            setOfficers(msg.payload.officers);
            setDrones(msg.payload.drones);
            setAuditLogs(msg.payload.auditLogs);
          } else if (msg.type === 'CASE_CREATED') {
            soundFX.playSosChime();
            const normalizedCase = normalizeCase(msg.payload as Case);
            backendCaseIdsRef.current.add(normalizedCase.id);
            suppressedFirebaseCaseIdsRef.current.delete(normalizedCase.id);
            setCases(prev => prev.some(c => c.id === normalizedCase.id)
              ? prev.map(c => c.id === normalizedCase.id ? normalizedCase : c)
              : [normalizedCase, ...prev]);
            setSelectedCaseId(normalizedCase.id);
            // Fly to SOS location on map if coordinates are valid
            if (!normalizedCase.locationUnavailable) {
              console.log(`[WS] New SOS case ${normalizedCase.id} at lat=${normalizedCase.location.lat}, lng=${normalizedCase.location.lng}`);
            } else {
              console.warn(`[WS] New SOS case ${normalizedCase.id} has no valid location — showing in queue without map marker`);
            }
          } else if (msg.type === 'CASE_UPDATED') {
            const updatedCase = normalizeCase(msg.payload as Case);
            backendCaseIdsRef.current.add(updatedCase.id);
            suppressedFirebaseCaseIdsRef.current.delete(updatedCase.id);
            setCases(prev => prev.some(c => c.id === updatedCase.id)
              ? prev.map(c => c.id === updatedCase.id ? updatedCase : c)
              : [updatedCase, ...prev]);
          } else if (msg.type === 'OFFICER_LOCATION_UPDATED') {
            setOfficers(prev => prev.map(o => o.userId === msg.payload.userId ? msg.payload : o));
          } else if (msg.type === 'DRONES_UPDATED') {
            setDrones(msg.payload);
          } else if (msg.type === 'DRONE_FRAME_UPDATED') {
            setDrones(prev => prev.map(d => d.id === msg.payload.droneId ? { ...d, streamUrl: msg.payload.streamUrl } : d));
          } else if (msg.type === 'DRONE_AUDIO_CHUNK') {
            setDrones(prev => prev.map(d => d.id === msg.payload.droneId ? {
              ...d,
              audioData: msg.payload.audioChunk,
              decibelLevel: msg.payload.decibelLevel !== undefined ? msg.payload.decibelLevel : d.decibelLevel
            } : d));
          } else if (msg.type === 'CASE_FRAME_UPDATED') {
            setCases(prev => prev.map(c => c.id === msg.payload.caseId ? {
              ...c,
              mediaUrl: msg.payload.mediaUrl,
              audioData: msg.payload.audioData || c.audioData,
              decibelLevel: msg.payload.decibelLevel !== undefined ? msg.payload.decibelLevel : c.decibelLevel
            } : c));
          } else if (msg.type === 'CASE_AUDIO_CHUNK') {
            setCases(prev => prev.map(c => c.id === msg.payload.caseId ? {
              ...c,
              audioData: msg.payload.audioChunk,
              decibelLevel: msg.payload.decibelLevel !== undefined ? msg.payload.decibelLevel : c.decibelLevel
            } : c));
          } else if (msg.type === 'DRONE_TELEMETRY_STREAM') {
            setDrones(prev => prev.map(d => {
              if (d.id === msg.payload.mother.id) return { ...d, location: msg.payload.mother.location, batteryPct: msg.payload.mother.batteryPct, speedKmh: msg.payload.mother.speedKmh, altitudeMeters: msg.payload.mother.altitude };
              if (d.id === msg.payload.child.id) return { ...d, location: msg.payload.child.location, batteryPct: msg.payload.child.batteryPct, speedKmh: msg.payload.child.speedKmh, altitudeMeters: msg.payload.child.altitude };
              return d;
            }));
          } else if (msg.type === 'AUDIT_LOG_ADDED') {
            setAuditLogs(prev => [msg.payload, ...prev]);
          }
        } catch (err) { console.error('WS Parse Error:', err); }
      };
      ws.onclose = () => { setIsConnected(false); if (shouldReconnect) { setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY); void connectWs(); }, reconnectDelay); } };
      ws.onerror = () => { ws?.close(); };
    }
    connectWs();

    return () => { shouldReconnect = false; ws?.close(); unsubscribeCases(); unsubscribeAudit(); };
  }, [userSession?.email]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Command + K or Ctrl + K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        soundFX.playClickTick();
        return;
      }

      // [ -> Toggle Left Drawer
      if (e.key === '[') {
        e.preventDefault();
        setIsLeftSidebarOpen(prev => !prev);
        soundFX.playClickTick();
        return;
      }

      // Esc -> Deselect incident or close open modal
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        else if (isAuditModalOpen) setIsAuditModalOpen(false);
        else if (isSimulatorOpen) setIsSimulatorOpen(false);
        else if (isSuperAdminModalOpen) setIsSuperAdminModalOpen(false);
        else if (showPoliceUnitsDrawer) setShowPoliceUnitsDrawer(false);
        else if (dispatchModalCaseId) setDispatchModalCaseId(null);
        else if (selectedCaseId) setSelectedCaseId(null);
        return;
      }

      // J -> Next incident
      if (e.key.toLowerCase() === 'j') {
        const active = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
        if (active.length > 0) {
          const idx = active.findIndex(c => c.id === selectedCaseId);
          const nextIdx = (idx + 1) % active.length;
          setSelectedCaseId(active[nextIdx].id);
          soundFX.playClickTick();
        }
        return;
      }

      // K -> Previous incident
      if (e.key.toLowerCase() === 'k') {
        const active = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
        if (active.length > 0) {
          const idx = active.findIndex(c => c.id === selectedCaseId);
          const prevIdx = (idx - 1 + active.length) % active.length;
          setSelectedCaseId(active[prevIdx].id);
          soundFX.playClickTick();
        }
        return;
      }

      // D -> Dispatch drone
      if (e.key.toLowerCase() === 'd' && selectedCaseId) {
        setDispatchModalCaseId(selectedCaseId);
        soundFX.playClickTick();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cases, selectedCaseId, isCommandPaletteOpen, isAuditModalOpen, isSimulatorOpen, isSuperAdminModalOpen, showPoliceUnitsDrawer, dispatchModalCaseId]);

  const selectedCase = cases.find(c => c.id === selectedCaseId && hasValidCaseLocation(c)) || null;
  const activeAirborneDrone = drones.find(d => (d.status === 'airborne' || d.streamUrl) && d.type === 'child');

  const handleVerifyCase = async (caseId: string, isFalseAlarm: boolean) => {
    try {
      const result = await postBackendAction(`/v1/cases/${encodeURIComponent(caseId)}/verify`, {
        isFalseAlarm,
        notes: 'Verified by operator call.'
      });
      confirmCaseActionResponse(result, caseId, isFalseAlarm ? 'false_alarm' : 'verifying');
      setCases(prev => prev.map(caseItem => caseItem.id === caseId
        ? {
            ...caseItem,
            status: isFalseAlarm ? 'false_alarm' : 'verifying',
            verificationNotes: 'Verified by operator call.'
          }
        : caseItem));
      soundFX.playClickTick();
    } catch (error) {
      reportBackendActionFailure('Case verification', error);
    }
  };

  const handleAssignOfficer = async (caseId: string, officerUserId: string) => {
    try {
      const result = await postBackendAction(`/v1/cases/${encodeURIComponent(caseId)}/assign`, { officerUserId });
      confirmCaseActionResponse(result, caseId, 'unit_assigned');
      const officer = officers.find(item => item.userId === officerUserId);
      setCases(prev => prev.map(caseItem => caseItem.id === caseId
        ? {
            ...caseItem,
            status: 'unit_assigned',
            assignedOfficerUserId: officerUserId,
            assignedOfficerName: officer?.name ?? caseItem.assignedOfficerName,
            etaSeconds: null
          }
        : caseItem));
      soundFX.playDispatchConfirm();
    } catch (error) {
      reportBackendActionFailure('Officer assignment', error);
    }
  };

  const handleConfirmDispatch = async (caseId: string, motherDroneId: string, airspaceConfirmed: boolean) => {
    try {
      const result = await postBackendAction(`/v1/cases/${encodeURIComponent(caseId)}/dispatch-drone`, {
        motherDroneId,
        operatorId: 'Op-#4',
        airspaceConfirmed
      });
      confirmCaseActionResponse(result, caseId, 'airborne');
      setCases(prev => prev.map(caseItem => caseItem.id === caseId
        ? { ...caseItem, status: 'airborne', droneId: motherDroneId }
        : caseItem));
      setDrones(prev => prev.map(drone => drone.id === motherDroneId || drone.id === 'drone-c1'
        ? { ...drone, status: 'airborne' }
        : drone));
      soundFX.playDispatchConfirm();
      setDispatchModalCaseId(null);
    } catch (error) {
      reportBackendActionFailure('Drone dispatch', error);
    }
  };

  const handleResolveCase = async (caseId: string) => {
    try {
      const result = await postBackendAction(`/v1/cases/${encodeURIComponent(caseId)}/resolve`);
      confirmCaseActionResponse(result, caseId, 'resolved');
      setCases(prev => prev.map(caseItem => caseItem.id === caseId
        ? { ...caseItem, status: 'resolved' }
        : caseItem));
      soundFX.playResolveChime();
    } catch (error) {
      reportBackendActionFailure('Case resolution', error);
    }
  };

  const handleTriggerSOS = async (reporterName: string, address: string, lat: number, lng: number) => {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      window.alert('SOS was not sent because the selected location is invalid.');
      return;
    }

    const caseId = `case-${crypto.randomUUID()}`;
    const newCase: Case = {
      id: caseId,
      reporterUserId: 'usr-mobile',
      reporterName,
      reporterPhone: '+919876543210',
      status: 'raised',
      location: { lat, lng },
      address,
      severityScore: 7,
      createdAt: new Date().toISOString(),
      assignedOfficerUserId: null,
      assignedOfficerName: null,
      etaSeconds: null,
      droneId: null,
      verificationNotes: 'Triggered via C2 Simulator.',
      mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=60',
      decibelLevel: 68
    };

    try {
      const result = await postBackendAction('/v1/sos', { caseId, reporterName, address, lat, lng });
      const confirmedCaseId = typeof result.caseId === 'string'
        ? result.caseId
        : result.case && typeof result.case === 'object' && !Array.isArray(result.case)
          ? (result.case as Record<string, unknown>).id
          : null;
      if (confirmedCaseId !== caseId) {
        throw new Error('Backend did not confirm the requested SOS case ID.');
      }

      soundFX.playSosChime();
      setCases(prev => [newCase, ...prev.filter(c => c.id !== caseId)]);
      setSelectedCaseId(caseId);
    } catch (error) {
      reportBackendActionFailure('SOS creation', error);
    }
  };

  const handleSimulateOfficerMove = () => {
    if (!operatorLocation) return;
    const lat = operatorLocation.lat + (Math.random() - 0.5) * 0.01;
    const lng = operatorLocation.lng + (Math.random() - 0.5) * 0.01;
    setOfficers(prev => prev.map(o => o.userId === 'usr-p1' ? { ...o, location: { lat, lng }, lastHeartbeat: new Date().toISOString() } : o));
    dashboardFetch(`${API_BASE}/v1/officers/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-p1', lat, lng, onDuty: true }) }).catch(console.error);
  };

  const handleSimulateMediaStream = async (targetCaseId?: string) => {
    let targetId = targetCaseId || selectedCaseId || cases[0]?.id;
    if (!targetId) {
      targetId = 'case-101';
      setSelectedCaseId(targetId);
    }

    soundFX.playClickTick();

    let frameCount = 0;
    const interval = setInterval(async () => {
      frameCount++;
      const timeStr = new Date().toLocaleTimeString();
      const decibel = Math.floor(Math.random() * 28) + 55;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0a192f"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#g)"/>
        <line x1="0" y1="${(frameCount * 25) % 360}" x2="640" y2="${(frameCount * 25) % 360}" stroke="#00f2ff" stroke-width="1.5" opacity="0.45"/>
        <circle cx="320" cy="180" r="100" stroke="#38bdf8" stroke-width="1" fill="none" opacity="0.4"/>
        <circle cx="320" cy="180" r="40" stroke="#ff453a" stroke-width="1" fill="none" opacity="0.6"/>
        <line x1="320" y1="60" x2="320" y2="300" stroke="#38bdf8" stroke-width="1" opacity="0.3"/>
        <line x1="200" y1="180" x2="440" y2="180" stroke="#38bdf8" stroke-width="1" opacity="0.3"/>
        <circle cx="320" cy="180" r="4" fill="#ff453a"/>
        <rect x="20" y="20" width="230" height="36" rx="6" fill="#000000" opacity="0.75"/>
        <circle cx="35" cy="38" r="5" fill="#ff453a"/>
        <text x="48" y="42" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff">LIVE FEED • ${targetId.toUpperCase()}</text>
        <rect x="20" y="305" width="280" height="35" rx="6" fill="#000000" opacity="0.75"/>
        <text x="32" y="327" font-family="monospace" font-size="11" fill="#30d158">LIVE REC ${timeStr} • ${decibel} dB</text>
        <rect x="460" y="20" width="160" height="36" rx="6" fill="#000000" opacity="0.75"/>
        <text x="475" y="42" font-family="monospace" font-size="12" fill="#38bdf8">1080P • 30 FPS</text>
      </svg>`;

      const base64Frame = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

      // Instant local state update
      setCases(prev => prev.map(c => c.id === targetId ? {
        ...c,
        mediaUrl: base64Frame,
        decibelLevel: decibel
      } : c));

      // Direct Firestore update (every ~1s)
      if (frameCount % 4 === 1) {
        try {
          await updateDoc(doc(db, 'cases', targetId), {
            mediaUrl: base64Frame,
            decibelLevel: decibel
          });
        } catch (e) {}
      }

      // Backend call if reachable
      dashboardFetch(`${API_BASE}/v1/cases/${targetId}/stream-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameData: base64Frame,
          audioData: 'data:audio/pcm;base64,AAAA//8=',
          decibelLevel: decibel
        })
      }).catch(console.error);

      if (frameCount >= 40) {
        clearInterval(interval);
      }
    }, 250);
  };
  const handleClearAllRecords = async () => {
    if (window.confirm('Erase all active cases, audit logs, and hardware telemetry from both Cloud Firestore and server?')) {
      let snapshots;
      try {
        snapshots = await Promise.all([
          getDocs(collection(db, 'cases')),
          getDocs(collection(db, 'auditLogs')),
          getDocs(collection(db, 'drones'))
        ]);
      } catch (error) {
        reportBackendActionFailure('Loading records for cleanup', error);
        return;
      }

      try {
        await postBackendAction('/v1/cases/clear-all');
      } catch (error) {
        reportBackendActionFailure('Clear all records', error);
        return;
      }

      const [caseSnapshot] = snapshots;
      caseSnapshot.docs.forEach(item => suppressedFirebaseCaseIdsRef.current.add(item.id));
      cases.forEach(caseItem => suppressedFirebaseCaseIdsRef.current.add(caseItem.id));
      setCases([]);
      setSelectedCaseId(null);
      setDrones(prev => prev.map(drone => ({
        ...drone,
        status: 'docked',
        altitudeMeters: 0,
        speedKmh: 0,
        location: drone.homeLocation ? { ...drone.homeLocation } : drone.location
      })));

      try {
        const [caseSnapshot, auditSnapshot, droneSnapshot] = snapshots;
        await Promise.all([
          ...caseSnapshot.docs.map(item => deleteDoc(doc(db, 'cases', item.id))),
          ...auditSnapshot.docs.map(item => deleteDoc(doc(db, 'auditLogs', item.id))),
          ...droneSnapshot.docs.map(item => deleteDoc(doc(db, 'drones', item.id)))
        ]);
      } catch (error) {
        console.error('Backend records were cleared, but Firebase cleanup failed:', error);
        window.alert('Backend records were cleared, but some Firebase records could not be removed. Check the browser console and Firebase permissions.');
      }
    }
  };
  const handleCancelCase = async (caseId: string) => {
    if (window.confirm(`Cancel case ${caseId}? This will mark it as false alarm and recall dispatched units.`)) {
      try {
        const result = await postBackendAction(`/v1/cases/${encodeURIComponent(caseId)}/cancel`, { cancelledBy: 'operator-c2' });
        confirmCaseActionResponse(result, caseId, 'false_alarm');
        setCases(prev => prev.map(caseItem => caseItem.id === caseId
          ? { ...caseItem, status: 'false_alarm', cancelledBy: 'operator-c2' }
          : caseItem));
      } catch (error) {
        reportBackendActionFailure('Case cancellation', error);
      }
    }
  };

  const handleToggleAudio = () => {
    const isMuted = soundFX.toggleMute();
    setIsAudioMuted(isMuted);
    if (!isMuted) soundFX.playClickTick();
  };

  if (!userSession) {
    return (
      <DashboardAuthScreen
        onLoginSuccess={(session) => {
          setUserSession(session);
          if (session.location) {
            setOperatorLocation(session.location);
            setGpsStatus('locked');
          }
          try { localStorage.setItem('nirai_c2_session', JSON.stringify(session)); } catch (e) {}
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-[#f5f5f7] select-none">
      {/* Liquid Glass Navigation Bar */}
      <Header
        cases={cases}
        isConnected={isConnected}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onClearAllRecords={handleClearAllRecords}
        onOpenSuperAdminModal={() => setIsSuperAdminModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        sidebarCollapsed={!isLeftSidebarOpen}
        onToggleSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        session={userSession}
        operatorLocation={operatorLocation}
        gpsStatus={gpsStatus}
        onForceRequestGps={acquireLiveGps}
        onLogout={() => {
          setUserSession(null);
          setOperatorLocation(null);
          try { localStorage.removeItem('nirai_c2_session'); } catch (e) {}
        }}
      />

      {/* GPS denied alert banner */}
      {(gpsStatus === 'denied' || gpsStatus === 'unsupported') && !operatorLocation && (
        <div className="bg-[#ff453a]/15 border-b border-[#ff453a]/25 px-6 py-2 flex items-center justify-between text-xs text-[#f5f5f7] z-30">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#ff453a]" />
            <span>GPS access denied. Enable device location or pick station location on map.</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={acquireLiveGps} className="apple-btn-secondary text-[11px] py-1 px-3 font-medium">Retry GPS</button>
            <button onClick={() => setShowLocationPicker(true)} className="apple-btn-primary text-[11px] py-1 px-3 font-medium">Pick On Map</button>
          </div>
        </div>
      )}

      {/* Full-Bleed Spatial Map Canvas */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* Layer 0: Map Canvas */}
        <div className="absolute inset-0 z-0">
          <LiveMap
            cases={cases}
            officers={officers}
            drones={drones}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => {
              setSelectedCaseId(id);
              setShowPoliceUnitsDrawer(false);
            }}
            operatorLocation={operatorLocation}
            gpsStatus={gpsStatus}
            onForceRequestGps={acquireLiveGps}
          />
        </div>

        {/* Floating Left Drawer: Incident Queue (320px, Liquid Glass) */}
        <aside
          className={`absolute top-3 left-3 bottom-3 z-20 w-80 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ease-out ${
            isLeftSidebarOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[115%] opacity-0 pointer-events-none'
          }`}
        >
          <AlertQueue
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => {
              setSelectedCaseId(id);
              setShowPoliceUnitsDrawer(false);
            }}
            onVerifyCase={handleVerifyCase}
            onOpenDispatchModal={(id) => setDispatchModalCaseId(id)}
            onCancelCase={handleCancelCase}
          />
        </aside>

        {/* Floating Left Drawer Open Pill (When Drawer is Collapsed) */}
        {!isLeftSidebarOpen && (
          <button
            onClick={() => {
              soundFX.playClickTick();
              setIsLeftSidebarOpen(true);
            }}
            className="absolute top-3 left-3 z-20 liquid-glass-pill rounded-full px-3.5 py-2 shadow-xl flex items-center space-x-2 hover:border-[#2997ff]/60 transition-all cursor-pointer group"
            title="Open Incident Queue ([)"
          >
            <PanelLeft className="w-4 h-4 text-[#2997ff] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-white">Incidents</span>
            <span className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] px-2 py-0.5 rounded-full font-semibold apple-tabular">
              {cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm').length}
            </span>
          </button>
        )}

        {/* Top Floating Action Pill: Mesh Nodes & Patrol Units */}
        <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
          {/* Patrol Units Toggle Pill */}
          <button
            onClick={() => {
              soundFX.playClickTick();
              setShowPoliceUnitsDrawer(!showPoliceUnitsDrawer);
            }}
            className={`liquid-glass-pill rounded-full px-3.5 py-1.5 shadow-xl flex items-center space-x-2 text-xs font-medium transition-all ${
              showPoliceUnitsDrawer ? 'bg-[#0a84ff]/20 border-[#0a84ff]/50 text-white' : 'text-white/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0a84ff]" />
            <span>Patrol Units</span>
            <span className="bg-white/[0.08] text-white/90 text-[10px] px-1.5 py-0.2 rounded-full font-medium apple-tabular">
              {officers.filter(o => o.onDuty).length}
            </span>
          </button>

          {/* Connected Mesh Nodes Pill */}
          <button
            onClick={() => setShowConnectedNodes(!showConnectedNodes)}
            className="liquid-glass-pill rounded-full px-3 py-1.5 shadow-xl flex items-center space-x-1.5 text-xs font-medium text-white/80 hover:text-white transition-all"
            title="Mesh Nodes"
          >
            <Layers className="w-3.5 h-3.5 text-[#2997ff]" />
            <span className="hidden sm:inline">Mesh</span>
          </button>
        </div>

        {/* Expandable Connected Nodes Modal */}
        {showConnectedNodes && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 animate-scaleUp">
            <ConnectedDevicesPanel
              cases={cases}
              officers={officers}
              drones={drones}
              isConnected={isConnected}
              onClearAll={handleClearAllRecords}
              operatorLocation={operatorLocation}
              gpsStatus={gpsStatus}
            />
          </div>
        )}

        {/* Floating Right Drawer: Patrol Units Tracker (Only when explicitly opened) */}
        {showPoliceUnitsDrawer && (
          <aside className="absolute top-12 right-3 bottom-3 z-20 w-80 md:w-84 rounded-3xl overflow-hidden shadow-2xl animate-slideInRight">
            <div className="relative h-full">
              <PoliceTracker
                officers={officers}
                selectedCase={selectedCase}
                onAssignOfficer={handleAssignOfficer}
              />
              <button
                onClick={() => setShowPoliceUnitsDrawer(false)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-[#86868b] hover:text-white transition-all z-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>
        )}

        {/* Floating Right Inspector: Incident Inspector Card (Only when an incident is selected) */}
        {selectedCase && !showPoliceUnitsDrawer && (
          <aside className="absolute top-12 right-3 bottom-3 z-20 pointer-events-auto">
            <IncidentInspectorCard
              selectedCase={selectedCase}
              officers={officers}
              drones={drones}
              onClose={() => setSelectedCaseId(null)}
              onVerifyCase={handleVerifyCase}
              onOpenDispatchModal={(id) => setDispatchModalCaseId(id)}
              onAssignOfficer={handleAssignOfficer}
              onResolveCase={handleResolveCase}
              onCancelCase={handleCancelCase}
              onSimulateMediaStream={handleSimulateMediaStream}
            />
          </aside>
        )}

        {/* Floating PiP Live Recon Video Feed */}
        {showPiPVideo && activeAirborneDrone && (
          <div className="absolute bottom-20 right-4 z-30">
            <FloatingDronePiP
              drone={activeAirborneDrone}
              onClose={() => setShowPiPVideo(false)}
            />
          </div>
        )}

        {/* Floating Bottom Center: Autonomous Drone Fleet Dock */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 pointer-events-auto">
          <DroneControlPanel
            drones={drones}
            selectedCase={selectedCase}
            dispatchModalCaseId={dispatchModalCaseId}
            onCloseDispatchModal={() => setDispatchModalCaseId(null)}
            onConfirmDispatch={handleConfirmDispatch}
            onResolveCase={handleResolveCase}
          />
        </div>
      </main>

      {/* Command Palette (⌘K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        cases={cases}
        officers={officers}
        drones={drones}
        onSelectCase={(id) => setSelectedCaseId(id)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSuperAdminModal={userSession?.isSuperAdmin ? () => setIsSuperAdminModalOpen(true) : undefined}
        onClearAllRecords={handleClearAllRecords}
        onToggleAudio={handleToggleAudio}
        isMuted={isAudioMuted}
      />

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={handleManualLocationPick}
          onCancel={() => setShowLocationPicker(false)}
          onRetryGps={acquireLiveGps}
        />
      )}

      {/* Tactical Modals */}
      <AuditLogModal isOpen={isAuditModalOpen} onClose={() => setIsAuditModalOpen(false)} logs={auditLogs} />
      <SimulatorControls
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onTriggerSOS={handleTriggerSOS}
        onSimulateOfficerMove={handleSimulateOfficerMove}
        onSimulateMediaStream={() => handleSimulateMediaStream()}
      />

      {userSession?.isSuperAdmin && (
        <SuperAdminModal
          isOpen={isSuperAdminModalOpen}
          onClose={() => setIsSuperAdminModalOpen(false)}
          session={userSession}
          drones={drones}
          officers={officers}
          cases={cases}
          selectedZone={selectedZone}
          onSelectZone={(zone) => setSelectedZone(zone)}
          onRecallAllDrones={() => {
            void postBackendAction('/v1/drones/ground-all').then(() => {
              setDrones(prev => prev.map(d => ({ ...d, status: 'docked', altitudeMeters: 0, speedKmh: 0 })));
              alert('Grounding command confirmed by the backend.');
            }).catch(error => reportBackendActionFailure('Ground all drones', error));
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Manual Location Picker Modal (SVG Map Pin, No Emojis)
// ============================================================
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const pickerIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#0071e3;border:2px solid #ffffff;box-shadow:0 0 16px rgba(0,113,227,0.7);color:#ffffff;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'picker-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function LocationPickerModal({ onConfirm, onCancel, onRetryGps }: { onConfirm: (lat: number, lng: number) => void; onCancel: () => void; onRetryGps: () => void }) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl liquid-glass rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-[#2997ff]" />
            <h2 className="apple-headline font-semibold text-sm text-white">Select Station Location</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRetryGps}
              className="apple-btn-secondary text-[11px] py-1 px-3 flex items-center space-x-1"
            >
              <Navigation className="w-3 h-3 text-[#2997ff]" />
              <span>Retry GPS</span>
            </button>
            <button onClick={onCancel} className="text-[#86868b] hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-black/40 border-b border-white/[0.06]">
          <p className="text-xs text-white/80">
            Click on the map to set your C2 station location for dispatch distance calculations.
          </p>
        </div>

        <div style={{ height: 420 }}>
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={(lat, lng) => setPicked({ lat, lng })} />
            {picked && <Marker position={[picked.lat, picked.lng]} icon={pickerIcon} />}
          </MapContainer>
        </div>

        <div className="px-5 py-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between">
          {picked ? (
            <div className="text-xs text-[#30d158] apple-tabular">
              <span className="text-[#86868b] mr-1">Selected:</span>
              {picked.lat.toFixed(6)}°N, {picked.lng.toFixed(6)}°E
            </div>
          ) : (
            <div className="text-xs text-[#ff9f0a]">
              Click anywhere on the map to set position...
            </div>
          )}
          <button
            disabled={!picked}
            onClick={() => { if (picked) onConfirm(picked.lat, picked.lng); }}
            className="apple-btn-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs py-2 px-5 flex items-center space-x-1.5"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
