export type CaseStatus = 
  | 'raised'
  | 'verifying'
  | 'unit_assigned'
  | 'drone_requested'
  | 'airborne'
  | 'on_scene'
  | 'resolved'
  | 'false_alarm';

export interface Location {
  lat: number;
  lng: number;
}

export interface Case {
  id: string;
  reporterUserId: string;
  reporterName: string;
  reporterPhone: string;
  status: CaseStatus;
  location: Location;
  locationUnavailable?: boolean;
  address: string;
  severityScore: number;
  createdAt: string;
  assignedOfficerUserId: string | null;
  assignedOfficerName: string | null;
  etaSeconds: number | null;
  droneId: string | null;
  verificationNotes?: string;
  mediaUrl?: string;
  reporterPhotoUrl?: string | null;
  cancelledBy?: string | null;
  audioData?: string;
  decibelLevel?: number;
}

export interface Officer {
  userId: string;
  name: string;
  badgeId: string;
  onDuty: boolean;
  vehicle: string;
  location: Location;
  lastHeartbeat: string;
  distanceKm?: number;
  etaSeconds?: number;
}

export interface Drone {
  id: string;
  name: string;
  type: 'mother' | 'child';
  status: 'docked' | 'charging' | 'airborne' | 'returning' | 'maintenance';
  batteryPct: number;
  altitudeMeters: number;
  speedKmh: number;
  location: Location;
  homeLocation?: Location;
  parentMotherId?: string;
  streamUrl?: string | null;
  audioData?: string;
  decibelLevel?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  target: string;
  hash: string;
}
