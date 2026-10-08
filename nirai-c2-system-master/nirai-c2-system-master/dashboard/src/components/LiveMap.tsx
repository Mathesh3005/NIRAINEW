import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Case, Officer, Drone } from '../types';
import { theme } from '../theme';
import { Navigation, Crosshair, Radio, Shield, MapPin } from 'lucide-react';

interface LiveMapProps {
  cases: Case[];
  officers: Officer[];
  drones: Drone[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  operatorLocation?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  gpsStatus?: 'acquiring' | 'locked' | 'denied' | 'unsupported' | 'manual_pick';
  onForceRequestGps?: () => void;
}

// Utility to check Red Zone collision
export const checkRedZoneCollision = (lat: number, lng: number): boolean => {
  // Red zone covers longitude 80.275 to 80.300 and latitude 13.085 to 13.105
  return lat >= 13.085 && lat <= 13.105 && lng >= 80.275 && lng <= 80.300;
};

// Custom Leaflet Icons using Apple design tokens
const createSvgIcon = (bgColor: string, accentColor: string, symbol: string, isPulsing: boolean = false) => {
  const pulseHtml = isPulsing 
    ? `<div style="position:absolute; inset:-4px; border-radius:9999px; background-color:${accentColor}; opacity:0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` 
    : '';
  const svg = `
    <div style="position:relative; display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9999px; background-color:${bgColor}; border:2px solid ${accentColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 10px ${accentColor}40; color:white; font-weight:600; font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:10px;">
      ${pulseHtml}
      <span style="position:relative; z-index:10; letter-spacing:-0.02em;">${symbol}</span>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-map-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

// Operator Live GPS HQ Icon (Apple Action Blue Pin)
const operatorGpsIcon = L.divIcon({
  html: `
    <div style="position:relative; display:flex; align-items:center; justify-content:center; width:40px; height:40px;">
      <div style="position:absolute; inset:0; border-radius:9999px; background-color:#0071e3; opacity:0.3; animation: ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position:relative; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:9999px; background:linear-gradient(135deg, #2997ff, #0071e3); border:2px solid #ffffff; box-shadow: 0 4px 14px rgba(0,113,227,0.45); color:white; font-weight:700; font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:10px;">
        <span style="position:relative; z-index:10;">HQ</span>
      </div>
    </div>
  `,
  className: 'custom-operator-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Distinct Map Markers using Apple theme colors
const caseIconUnassigned = createSvgIcon('#1c1c1e', '#ff453a', 'SOS', true);
const caseIconAssigned = createSvgIcon('#1c1c1e', '#ff9f0a', 'SOS');
const caseIconAirborne = createSvgIcon('#1c1c1e', '#2997ff', 'AIR');
const officerIcon = createSvgIcon('#1c1c1e', '#0a84ff', 'POL');
const motherDroneIcon = createSvgIcon('#1c1c1e', '#bf5af2', 'MD');
const childDroneIcon = createSvgIcon('#1c1c1e', '#30d158', 'CD');

// Resize handle icon (Apple Blue dot)
const resizeHandleIcon = L.divIcon({
  html: `<div style="width: 12px; height: 12px; background-color: #0071e3; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
  className: 'resize-handle-icon',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Custom component to manage map centering
// Priority: recenter button > selected case > operator GPS
const MapRecenter = ({
  caseItem,
  operatorLocation,
  recenterTrigger
}: {
  caseItem: Case | null;
  operatorLocation?: { lat: number; lng: number } | null;
  recenterTrigger: number;
}) => {
  const map = useMap();
  const hasInitialized = useRef(false);

  // On first operator location arrival, center the map there
  useEffect(() => {
    if (operatorLocation && !hasInitialized.current) {
      hasInitialized.current = true;
      map.flyTo([operatorLocation.lat, operatorLocation.lng], 15, { animate: true, duration: 1.2 });
    }
  }, [operatorLocation, map]);

  // When user clicks "recenter" button, always go to operator location
  useEffect(() => {
    if (recenterTrigger > 0 && operatorLocation) {
      map.flyTo([operatorLocation.lat, operatorLocation.lng], 15, { animate: true, duration: 1.0 });
    }
  }, [recenterTrigger, map]);

  // When a case is selected, fly to it
  useEffect(() => {
    if (caseItem?.location && !caseItem.locationUnavailable) {
      map.flyTo([caseItem.location.lat, caseItem.location.lng], 15, { animate: true, duration: 1.2 });
    }
  }, [caseItem?.id, caseItem?.location?.lat, caseItem?.location?.lng, caseItem?.locationUnavailable, map]);

  return null;
};

// Helper to generate a multi-segment mock route
const generateMockRoute = (start: [number, number], end: [number, number]): [number, number][] => {
  const mid1: [number, number] = [start[0], start[1] + (end[1] - start[1]) * 0.4];
  const mid2: [number, number] = [end[0] - (end[0] - start[0]) * 0.3, mid1[1]];
  const points: [number, number][] = [start, mid1, mid2, end];
  
  // Interpolate more coordinates for smooth polyline animation
  const interpolated: [number, number][] = [];
  const segments = points.length - 1;
  const stepsPerSegment = 5;

  for (let s = 0; s < segments; s++) {
    const sStart = points[s];
    const sEnd = points[s + 1];
    for (let i = 0; i < stepsPerSegment; i++) {
      const t = i / stepsPerSegment;
      interpolated.push([
        sStart[0] + (sEnd[0] - sStart[0]) * t,
        sStart[1] + (sEnd[1] - sStart[1]) * t
      ]);
    }
  }
  interpolated.push(end);
  return interpolated;
};

export const LiveMap: React.FC<LiveMapProps> = ({
  cases,
  officers,
  drones,
  selectedCaseId,
  onSelectCase,
  operatorLocation,
  gpsStatus = 'acquiring',
  onForceRequestGps
}) => {
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [recenterCounter, setRecenterCounter] = useState(0);

  const activeCases = cases.filter(c => c.status !== 'resolved' && c.status !== 'false_alarm');
  // Only render map markers for cases with a valid, non-null GPS location
  const mappableCases = activeCases.filter(c =>
    !c.locationUnavailable &&
    c.location &&
    typeof c.location.lat === 'number' &&
    typeof c.location.lng === 'number' &&
    Number.isFinite(c.location.lat) &&
    Number.isFinite(c.location.lng) &&
    c.location.lat >= -90 && c.location.lat <= 90 &&
    c.location.lng >= -180 && c.location.lng <= 180 &&
    !(c.location.lat === 0 && c.location.lng === 0)
  );
  const selectedCase = mappableCases.find(c => c.id === selectedCaseId) ||
    (mappableCases.length > 0 ? mappableCases[0] : null);
  const activeDrones = drones.filter(d => d.status === 'airborne');
  const hasActiveCases = activeCases.length > 0;

  // Overlay visibility toggles
  const [showRedZone, setShowRedZone] = useState(true);
  const [showYellowZone, setShowYellowZone] = useState(true);
  const [showGreenZone, setShowGreenZone] = useState(true);

  // Dynamic state for active geofence sizes
  const [geofenceRadii, setGeofenceRadii] = useState<Record<string, number>>({});
  
  // Animated Polyline paths map: key = droneId
  const [animatedPaths, setAnimatedPaths] = useState<Record<string, [number, number][]>>({});
  const animationIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Debounced server broadcast helper
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const triggerDebouncedQuery = (caseId: string, radius: number) => {
    if (debounceTimers.current[caseId]) {
      clearTimeout(debounceTimers.current[caseId]);
    }
    debounceTimers.current[caseId] = setTimeout(() => {
      console.log(`Server Broadcast: Proximity query recalculated for case ${caseId} at radius ${Math.round(radius)}m`);
    }, 800);
  };

  // Polyline drawing animation logic
  useEffect(() => {
    if (!selectedCase) return;

    activeDrones.forEach(d => {
      const targetRoute = generateMockRoute(
        [d.location.lat, d.location.lng],
        [selectedCase.location.lat, selectedCase.location.lng]
      );
      
      let stepIndex = 0;
      if (animationIntervals.current[d.id]) {
        clearInterval(animationIntervals.current[d.id]);
      }

      const interval = setInterval(() => {
        if (stepIndex <= targetRoute.length) {
          setAnimatedPaths(prev => ({
            ...prev,
            [d.id]: targetRoute.slice(0, stepIndex + 1)
          }));
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 50);

      animationIntervals.current[d.id] = interval;
    });

    return () => {
      Object.values(animationIntervals.current).forEach(clearInterval);
    };
  }, [selectedCaseId, drones]);

  // Airspace Zone definitions
  const airspaceZones = {
    red: {
      bounds: [[13.085, 80.275], [13.105, 80.275], [13.105, 80.300], [13.085, 80.300]] as [number, number][],
      name: 'Chennai Port Air Command (Z-RED-04)',
      authority: 'AAI & Indian Navy (INS Adyar)',
      ceiling: '0m AGL (Strict No-Fly Zone)'
    },
    yellow: {
      bounds: [[13.060, 80.220], [13.080, 80.220], [13.080, 80.255], [13.060, 80.255]] as [number, number][],
      name: 'AAI Controlled Airspace (Z-YEL-12)',
      authority: 'Chennai ATC (MADRAS RADIO)',
      ceiling: '60m AGL'
    },
    green: {
      bounds: [[13.045, 80.260], [13.060, 80.260], [13.060, 80.285], [13.045, 80.285]] as [number, number][],
      name: 'Chennai Central Recreational airspace (Z-GRN-09)',
      authority: 'DGCA Digital Sky Autopilot Portal',
      ceiling: '120m AGL'
    }
  };

  // Determine REAL initial center — NO hardcoded fallback
  // If no real location available yet, show a loading state instead of rendering the map
  const hasRealCenter = !!operatorLocation || !!selectedCase;
  const initialMapCenter: [number, number] = operatorLocation
    ? [operatorLocation.lat, operatorLocation.lng]
    : selectedCase
    ? [selectedCase.location.lat, selectedCase.location.lng]
    : [0, 0]; // never used — map won't render without hasRealCenter

  // If we have no real coordinates yet, show a GPS acquisition overlay instead of the map
  if (!hasRealCenter) {
    return (
      <div className="relative w-full h-full bg-slate-950 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center">
            <Navigation className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
          <div className="text-sm font-mono text-cyan-300 font-bold uppercase tracking-wider">Acquiring Real-Time GPS Position...</div>
          <p className="text-xs font-mono text-slate-400 max-w-xs">The live map will render once your device GPS sensor provides accurate coordinates. No default or assumed location data is used.</p>
          {(gpsStatus === 'denied' || gpsStatus === 'unsupported') && onForceRequestGps && (
            <button
              onClick={onForceRequestGps}
              className="mt-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg uppercase transition-all"
            >
              Grant GPS Access / Pick Location
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-950">
      <MapContainer
        center={initialMapCenter}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter
          caseItem={selectedCase}
          operatorLocation={operatorLocation}
          recenterTrigger={recenterCounter}
        />

        {/* DGCA Airspace Overlays */}
        {showRedZone && (
          <Polygon
            positions={airspaceZones.red.bounds}
            pathOptions={{ color: theme.colors.status.critical, fillColor: theme.colors.status.critical, fillOpacity: 0.15, weight: 1.5 }}
          >
            <Tooltip sticky>
              <div className="p-1 font-mono text-[11px] text-slate-100 bg-slate-900 border border-slate-700 rounded shadow-md">
                <span className="font-bold text-rose-400 block">{airspaceZones.red.name}</span>
                <span>Auth: {airspaceZones.red.authority}</span>
                <span className="block font-bold mt-1 text-red-500">Ceiling: {airspaceZones.red.ceiling}</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {showYellowZone && (
          <Polygon
            positions={airspaceZones.yellow.bounds}
            pathOptions={{ color: theme.colors.status.warning, fillColor: theme.colors.status.warning, fillOpacity: 0.12, weight: 1.5 }}
          >
            <Tooltip sticky>
              <div className="p-1 font-mono text-[11px] text-slate-100 bg-slate-900 border border-slate-700 rounded shadow-md">
                <span className="font-bold text-amber-400 block">{airspaceZones.yellow.name}</span>
                <span>Auth: {airspaceZones.yellow.authority}</span>
                <span className="block font-bold mt-1 text-amber-500">Ceiling: {airspaceZones.yellow.ceiling}</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {showGreenZone && (
          <Polygon
            positions={airspaceZones.green.bounds}
            pathOptions={{ color: theme.colors.status.nominal, fillColor: theme.colors.status.nominal, fillOpacity: 0.08, weight: 1.5 }}
          >
            <Tooltip sticky>
              <div className="p-1 font-mono text-[11px] text-slate-100 bg-slate-900 border border-slate-700 rounded shadow-md">
                <span className="font-bold text-emerald-400 block">{airspaceZones.green.name}</span>
                <span>Auth: {airspaceZones.green.authority}</span>
                <span className="block font-bold mt-1 text-emerald-500">Ceiling: {airspaceZones.green.ceiling}</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* Real-time Operator C2 Command Node Marker & Accuracy Ring */}
        {operatorLocation && (
          <React.Fragment>
            <Marker
              position={[operatorLocation.lat, operatorLocation.lng]}
              icon={operatorGpsIcon}
            >
              <Popup>
                <div className="p-2.5 font-sans w-64 bg-slate-900 text-slate-100 rounded-xl border border-cyan-500/40 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
                    <span className="font-mono text-xs font-bold text-cyan-400 flex items-center space-x-1">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>C2 COMMAND POST</span>
                    </span>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                      LIVE GPS FIX
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white">C2 Command Center Station</p>
                  <div className="mt-2 text-[11px] font-mono space-y-1 bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lat:</span>
                      <span className="text-cyan-300 font-bold">{operatorLocation.lat.toFixed(6)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lng:</span>
                      <span className="text-cyan-300 font-bold">{operatorLocation.lng.toFixed(6)}°</span>
                    </div>
                    {operatorLocation.accuracy && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Accuracy:</span>
                        <span className="font-bold">±{operatorLocation.accuracy}m</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setRecenterCounter(prev => prev + 1)}
                    className="mt-2.5 w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono py-1.5 rounded transition-all flex items-center justify-center space-x-1.5"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>CENTER COMMAND CENTER</span>
                  </button>
                </div>
              </Popup>
            </Marker>

            {operatorLocation.accuracy && (
              <Circle
                center={[operatorLocation.lat, operatorLocation.lng]}
                radius={Math.max(operatorLocation.accuracy, 25)}
                pathOptions={{
                  color: '#06b6d4',
                  fillColor: '#06b6d4',
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: '3, 6'
                }}
              />
            )}
          </React.Fragment>
        )}

        {/* SOS Cases — only render markers for cases with valid GPS coordinates */}
        {mappableCases.map((c) => {
          let icon = caseIconUnassigned;
          if (c.status === 'airborne' || c.status === 'on_scene') icon = caseIconAirborne;
          else if (c.status === 'unit_assigned' || c.status === 'verifying') icon = caseIconAssigned;

          const currentRadius = geofenceRadii[c.id] || 300;
          const insideRedZone = checkRedZoneCollision(c.location.lat, c.location.lng);

          // Draggable edge handle: Positioned east of circle center
          const lngOffset = currentRadius / (111320 * Math.cos(c.location.lat * Math.PI / 180));
          const handlePosition: [number, number] = [c.location.lat, c.location.lng + lngOffset];

          return (
            <React.Fragment key={c.id}>
              <Marker
                position={[c.location.lat, c.location.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectCase(c.id),
                }}
              >
                <Popup>
                  <div className="p-2 font-sans w-64 bg-slate-900 text-slate-100 rounded border border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
                      <span className="font-mono text-xs font-bold text-rose-400">{c.id}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase font-mono">{c.status}</span>
                    </div>
                    <p className="text-xs font-semibold text-white">{c.reporterName}</p>
                    <p className="text-[11px] text-slate-300 mb-2">{c.address}</p>
                    
                    {insideRedZone && (
                      <div className="mb-2 bg-red-950/70 border border-red-500/40 text-red-300 font-mono text-[10px] px-2 py-1 rounded flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                        <span>Blocked: Restricted Airspace</span>
                      </div>
                    )}

                    <button
                      onClick={() => onSelectCase(c.id)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono py-1 rounded transition-all"
                    >
                      Inspect Case Details
                    </button>
                  </div>
                </Popup>
              </Marker>

              {/* Draggable Geofence Circle */}
              <Circle
                center={[c.location.lat, c.location.lng]}
                radius={currentRadius}
                pathOptions={{
                  color: insideRedZone 
                    ? theme.colors.status.critical 
                    : (c.id === selectedCaseId ? theme.colors.telemetry.droneCyan : theme.colors.status.critical),
                  fillColor: insideRedZone 
                    ? theme.colors.status.critical 
                    : (c.id === selectedCaseId ? theme.colors.telemetry.droneCyan : theme.colors.status.critical),
                  fillOpacity: 0.12,
                  dashArray: insideRedZone ? '2, 4' : '4, 8'
                }}
              >
                <Tooltip permanent direction="top" opacity={0.8} className="custom-radius-tooltip">
                  <span className="font-mono font-bold text-[9px] bg-slate-950/90 text-cyan-300 border border-slate-700 px-1.5 py-0.5 rounded">
                    {Math.round(currentRadius)}m Proximity Geofence
                  </span>
                </Tooltip>
              </Circle>

              {/* Draggable Handle on Geofence Edge (Only for selected case) */}
              {c.id === selectedCaseId && (
                <Marker
                  position={handlePosition}
                  icon={resizeHandleIcon}
                  draggable={true}
                  eventHandlers={{
                    drag: (e) => {
                      const markerLatLng = e.target.getLatLng();
                      const distance = L.latLng(c.location.lat, c.location.lng).distanceTo(markerLatLng);
                      // Constrain radius between 100m and 1200m
                      const constrained = Math.max(100, Math.min(1200, distance));
                      setGeofenceRadii(prev => ({
                        ...prev,
                        [c.id]: constrained
                      }));
                    },
                    dragend: () => {
                      triggerDebouncedQuery(c.id, currentRadius);
                    }
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Police Officers */}
        {officers.map((o) => (
          <Marker
            key={o.userId}
            position={[o.location.lat, o.location.lng]}
            icon={officerIcon}
          >
            <Popup>
              <div className="p-1 font-mono">
                <span className="text-xs font-bold text-blue-400 block">{o.badgeId} • {o.name}</span>
                <p className="text-[10px] text-slate-300">{o.vehicle}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Drones */}
        {drones.map((d) => {
          const icon = d.type === 'mother' ? motherDroneIcon : childDroneIcon;
          return (
            <Marker
              key={d.id}
              position={[d.location.lat, d.location.lng]}
              icon={icon}
            >
              <Popup>
                <div className="p-1 font-mono text-xs">
                  <span className="font-bold text-cyan-300 block">{d.name}</span>
                  <span className="text-slate-300 text-[10px]">Alt: {d.altitudeMeters}m | Batt: {d.batteryPct}%</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Animated Trajectory lines from Mother Drone to Active Case */}
        {selectedCase && activeDrones.map(d => {
          const pathCoords = animatedPaths[d.id] || [[d.location.lat, d.location.lng]];
          return (
            <Polyline
              key={`poly-${d.id}`}
              positions={pathCoords}
              pathOptions={{ 
                color: theme.colors.telemetry.droneCyan, 
                weight: 3, 
                dashArray: '3, 4'
              }}
            />
          );
        })}
      </MapContainer>

      {/* Floating GPS Snap Button (Apple Pill Capsule) */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col space-y-2">
        <button
          onClick={() => setRecenterCounter(prev => prev + 1)}
          className="apple-glass apple-pill-btn text-white hover:bg-white/[0.12] px-4 py-2 shadow-apple-glass transition-all flex items-center space-x-2 text-xs font-medium"
          title="Pan to live C2 Station GPS position"
        >
          <Crosshair className="w-3.5 h-3.5 text-[#2997ff]" />
          <span>Recenter HQ</span>
        </button>
      </div>

      {/* Control Room Map HUD Overlay — Apple Glass Card */}
      <div className={`absolute top-4 left-4 apple-glass rounded-2xl z-[1000] text-xs shadow-apple-glass transition-all ${hudCollapsed ? 'w-auto' : 'w-64'}`}>
        <div
          className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none hover:bg-white/[0.04] rounded-t-2xl"
          onClick={() => setHudCollapsed(!hudCollapsed)}
        >
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-[#2997ff]" />
            <span className="apple-headline text-xs font-semibold text-white">Map Telemetry</span>
          </div>
          <span className="text-[#86868b] text-[10px]">{hudCollapsed ? '▶' : '▼'}</span>
        </div>

        {!hudCollapsed && (
          <div className="px-3.5 pb-3.5 space-y-3">
            {/* Live GPS Telemetry Status */}
            <div className={`p-2.5 rounded-xl border text-[11px] ${
              gpsStatus === 'locked' && operatorLocation
                ? 'bg-[#30d158]/10 border-[#30d158]/20 text-[#30d158]'
                : 'bg-[#ff9f0a]/10 border-[#ff9f0a]/20 text-[#ff9f0a]'
            }`}>
              <div className="flex items-center justify-between font-medium mb-1">
                <span>Station GPS</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 font-medium">
                  {gpsStatus === 'locked' ? 'Locked' : 'Acquiring'}
                </span>
              </div>
              {operatorLocation ? (
                <div className="apple-tabular text-[11px] text-white/90">
                  <span className="block">{operatorLocation.lat.toFixed(5)}°, {operatorLocation.lng.toFixed(5)}°</span>
                  <span className="text-[10px] text-[#86868b]">Accuracy: ±{operatorLocation.accuracy || 5}m</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px]">
                  <span>Searching...</span>
                  {onForceRequestGps && (
                    <button
                      onClick={onForceRequestGps}
                      className="text-[10px] bg-[#ff9f0a] text-black px-2 py-0.5 rounded-full font-medium"
                    >
                      Fix
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Color codes */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#0071e3] shadow-[0_0_6px_#0071e3]" />
                <span className="text-white/90 font-medium">Command Station (You)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff453a] shadow-[0_0_6px_#ff453a]" />
                  <span className="text-white/90 font-medium">SOS Incident</span>
                </div>
                {selectedCase && checkRedZoneCollision(selectedCase.location.lat, selectedCase.location.lng) && (
                  <span className="text-[9px] bg-[#ff453a]/20 text-[#ff453a] px-1.5 py-0.5 rounded-full font-medium">
                    Conflict
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#0a84ff] shadow-[0_0_6px_#0a84ff]" />
                <span className="text-white/90 font-medium">Police Unit</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#bf5af2] shadow-[0_0_6px_#bf5af2]" />
                <span className="text-white/90 font-medium">Mother Drone</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#30d158] shadow-[0_0_6px_#30d158]" />
                <span className="text-white/90 font-medium">Child Drone</span>
              </div>
            </div>

            {/* Airspace Overlay Toggles */}
            <div className="border-t border-white/[0.06] pt-2.5 space-y-1.5">
              <span className="text-[#86868b] text-[10px] block font-medium">Airspace Boundaries</span>
              <label className="flex items-center space-x-2 text-white/80 cursor-pointer hover:text-white">
                <input type="checkbox" checked={showRedZone} onChange={() => setShowRedZone(!showRedZone)} className="rounded bg-black/60 border-white/20 text-[#ff453a] focus:ring-0 w-3.5 h-3.5" />
                <span className="text-[#ff453a] font-medium text-[11px]">Red Restricted Zone</span>
              </label>
              <label className="flex items-center space-x-2 text-white/80 cursor-pointer hover:text-white">
                <input type="checkbox" checked={showYellowZone} onChange={() => setShowYellowZone(!showYellowZone)} className="rounded bg-black/60 border-white/20 text-[#ff9f0a] focus:ring-0 w-3.5 h-3.5" />
                <span className="text-[#ff9f0a] font-medium text-[11px]">Yellow Regulated Zone</span>
              </label>
              <label className="flex items-center space-x-2 text-white/80 cursor-pointer hover:text-white">
                <input type="checkbox" checked={showGreenZone} onChange={() => setShowGreenZone(!showGreenZone)} className="rounded bg-black/60 border-white/20 text-[#30d158] focus:ring-0 w-3.5 h-3.5" />
                <span className="text-[#30d158] font-medium text-[11px]">Green Permitted Zone</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
