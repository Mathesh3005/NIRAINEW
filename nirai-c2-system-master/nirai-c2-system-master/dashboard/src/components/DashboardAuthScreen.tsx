import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Mail, User, LogIn, UserPlus, AlertCircle, MapPin, Navigation, Compass } from 'lucide-react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, getIdTokenResult, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export interface UserSession {
  email: string;
  name: string;
  role: 'SUPER ADMIN' | 'OPERATOR' | 'FIELD COMMANDER';
  isSuperAdmin: boolean;
  photoUrl?: string;
  createdAt: number;
  expiresAt: number; // 24 hours (86,400,000 ms) from login
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
    address?: string;
  };
}

interface DashboardAuthScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type GpsStatus = 'acquiring' | 'locked' | 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getGeolocationError(error: GeolocationPositionError): { status: GpsStatus; message: string } {
  const browserDetail = error.message ? ` Browser detail: ${error.message}` : '';

  if (!window.isSecureContext) {
    return {
      status: 'insecure',
      message: 'Location access requires a secure origin (HTTPS or localhost). Open the Dashboard using a secure connection.'
    };
  }

  if (error.code === error.PERMISSION_DENIED) {
    return {
      status: 'denied',
      message: `The browser denied location access. Check this site’s location permission and any device or browser policy.${browserDetail}`
    };
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return {
      status: 'unavailable',
      message: `The device could not determine a location. Check device location services and try again.${browserDetail}`
    };
  }
  if (error.code === error.TIMEOUT) {
    return {
      status: 'timeout',
      message: `The location request timed out before a fix was available. Try again when location services are ready.${browserDetail}`
    };
  }

  return {
    status: 'unavailable',
    message: `The browser could not provide a location (error code ${error.code}).${browserDetail}`
  };
}

function isValidGpsLocation(location: { lat: number; lng: number }): boolean {
  return Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180 &&
    (location.lat !== 0 || location.lng !== 0);
}

async function createAuthorizedSession(
  user: FirebaseUser,
  liveCoords: { lat: number; lng: number; accuracy?: number; timestamp?: number },
  fallbackName: string
): Promise<UserSession> {
  const tokenResult = await getIdTokenResult(user, true);
  const claimRole = tokenResult.claims.niraiRole;
  const role = claimRole === 'super_admin'
    ? 'SUPER ADMIN'
    : claimRole === 'operator'
      ? 'OPERATOR'
      : claimRole === 'field_commander'
        ? 'FIELD COMMANDER'
        : null;

  if (!role) {
    throw new Error('Your account is authenticated but has no NIRAI operator role. Contact a system administrator for access.');
  }

  const now = Date.now();
  return {
    email: user.email || '',
    name: user.displayName || fallbackName,
    role,
    isSuperAdmin: role === 'SUPER ADMIN',
    photoUrl: user.photoURL || undefined,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    location: {
      lat: liveCoords.lat,
      lng: liveCoords.lng,
      accuracy: liveCoords.accuracy,
      timestamp: liveCoords.timestamp
    }
  };
}

export const DashboardAuthScreen: React.FC<DashboardAuthScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Live GPS Acquisition State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('acquiring');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const hasGpsFixRef = useRef(false);

  // Request high-accuracy GPS coordinates immediately on component mount
  useEffect(() => {
    if (!window.isSecureContext) {
      setGpsStatus('insecure');
      setGpsErrorMsg('Location access requires a secure origin (HTTPS or localhost). Open the Dashboard using a secure connection.');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      setGpsErrorMsg('The Geolocation API is unavailable in this browser or browsing context. Real-time location is required for C2 access.');
      return;
    }

    setGpsStatus('acquiring');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp
        };
        if (!isValidGpsLocation(location)) {
          setGpsLocation(null);
          setGpsStatus('acquiring');
          setGpsErrorMsg('The browser returned an invalid GPS location. Waiting for a valid fix.');
          return;
        }
        hasGpsFixRef.current = true;
        setGpsLocation(location);
        setGpsStatus('locked');
        setGpsErrorMsg(null);
      },
      (err) => {
        const failure = getGeolocationError(err);
        console.warn('Geolocation acquisition failed:', { code: err.code, message: err.message });
        if (!hasGpsFixRef.current) {
          setGpsStatus(failure.status);
          setGpsErrorMsg(failure.message);
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const requestGpsNow = (): Promise<{ lat: number; lng: number; accuracy?: number; timestamp?: number }> => {
    return new Promise((resolve, reject) => {
      if (!window.isSecureContext) {
        const message = 'Location access requires a secure origin (HTTPS or localhost). Open the Dashboard using a secure connection.';
        setGpsStatus('insecure');
        setGpsErrorMsg(message);
        reject(new Error(message));
        return;
      }

      if (!navigator.geolocation) {
        const message = 'The Geolocation API is unavailable in this browser or browsing context.';
        setGpsStatus('unsupported');
        setGpsErrorMsg(message);
        reject(new Error(message));
        return;
      }

      setGpsStatus('acquiring');
      setGpsErrorMsg(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: pos.timestamp
          };
          if (!isValidGpsLocation(loc)) {
            const message = 'The browser returned an invalid GPS location. Retry when a valid fix is available.';
            setGpsLocation(null);
            setGpsStatus('acquiring');
            setGpsErrorMsg(message);
            reject(new Error(message));
            return;
          }
          hasGpsFixRef.current = true;
          setGpsLocation(loc);
          setGpsStatus('locked');
          setGpsErrorMsg(null);
          resolve(loc);
        },
        (error) => {
          const failure = getGeolocationError(error);
          console.warn('Geolocation request failed:', { code: error.code, message: error.message });
          setGpsStatus(failure.status);
          setGpsErrorMsg(failure.message);
          reject(new Error(failure.message));
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    // Acquire or confirm real-time GPS coordinate fix before granting session
    let liveCoords = gpsLocation;
    if (!liveCoords) {
      try {
        liveCoords = await requestGpsNow();
      } catch (locErr: unknown) {
        setLoading(false);
        setError(getErrorMessage(locErr, 'Real-time GPS coordinates required for login.'));
        return;
      }
    }

    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const session = await createAuthorizedSession(res.user, liveCoords, cleanEmail.split('@')[0]);
      setLoading(false);
      onLoginSuccess(session);
    } catch (err: unknown) {
      setLoading(false);
      setError(getErrorMessage(err, 'Authentication failed. Please verify credentials.'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    // Acquire real-time GPS coordinate fix
    let liveCoords = gpsLocation;
    if (!liveCoords) {
      try {
        liveCoords = await requestGpsNow();
      } catch (locErr: unknown) {
        setLoading(false);
        setError(getErrorMessage(locErr, 'Real-time GPS coordinates required for registration.'));
        return;
      }
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const session = await createAuthorizedSession(res.user, liveCoords, name || cleanEmail.split('@')[0]);
      setLoading(false);
      onLoginSuccess(session);
    } catch (err: unknown) {
      setLoading(false);
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    }
  };

  const handleGoogleOAuth = async () => {
    setError(null);
    setLoading(true);

    let liveCoords = gpsLocation;
    if (!liveCoords) {
      try {
        liveCoords = await requestGpsNow();
      } catch (locErr: unknown) {
        setLoading(false);
        setError(getErrorMessage(locErr, 'Real-time GPS coordinates required for login.'));
        return;
      }
    }

    try {
      const res = await signInWithPopup(auth, googleProvider);
      const session = await createAuthorizedSession(res.user, liveCoords, 'Authorized Operator');
      setLoading(false);
      onLoginSuccess(session);
    } catch (err: unknown) {
      setLoading(false);
      setError(getErrorMessage(err, 'Google authentication failed.'));
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#000000] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#0071e3]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-[#bf5af2]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md apple-glass rounded-3xl p-8 relative z-10">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-b from-[#2997ff] to-[#0071e3] rounded-2xl flex items-center justify-center shadow-[0_4px_20px_rgba(0,113,227,0.35)] mb-3 border border-white/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold apple-headline text-white tracking-tight">NIRAI C2</h1>
          <p className="text-xs text-[#86868b] mt-0.5">Emergency Command & Control Hub</p>
          <div className="mt-2.5 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] text-[#2997ff] apple-tabular">
            <span>Session: 24 Hours</span>
          </div>
        </div>

        {/* Real-time GPS Access Verification Box */}
        <div className={`mb-5 p-3 rounded-2xl border text-xs transition-all ${
          gpsStatus === 'locked' && gpsLocation
            ? 'bg-[#30d158]/10 border-[#30d158]/20 text-[#30d158]'
            : gpsStatus === 'denied' || gpsStatus === 'unavailable' || gpsStatus === 'timeout' || gpsStatus === 'unsupported' || gpsStatus === 'insecure'
            ? 'bg-[#ff453a]/15 border-[#ff453a]/30 text-[#ff453a]'
            : 'bg-[#2997ff]/10 border-[#2997ff]/20 text-[#2997ff]'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              {gpsStatus === 'locked' ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30d158]"></span>
                </span>
              ) : gpsStatus === 'acquiring' ? (
                <Navigation className="w-3.5 h-3.5 text-[#2997ff] animate-spin" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span className="font-semibold text-[11px]">
                {gpsStatus === 'locked'
                  ? 'GPS Telemetry Fixed'
                  : gpsStatus === 'acquiring'
                    ? 'GPS Verification Required'
                    : gpsStatus === 'insecure'
                      ? 'Secure Connection Required'
                      : gpsStatus === 'unsupported'
                        ? 'Location API Unavailable'
                        : 'GPS Verification Required'}
              </span>
            </div>
            {(gpsStatus === 'denied' || gpsStatus === 'unavailable' || gpsStatus === 'timeout') && (
              <button
                type="button"
                onClick={() => requestGpsNow().catch(console.error)}
                className="text-[10px] bg-[#ff453a] text-white px-2.5 py-0.5 rounded-full font-medium"
              >
                {gpsStatus === 'denied' ? 'Grant Access' : 'Retry Location'}
              </button>
            )}
          </div>

          {gpsStatus === 'locked' && gpsLocation ? (
            <div className="text-[11px] space-y-0.5 text-white/80 apple-tabular">
              <div className="flex items-center justify-between">
                <span>Location:</span>
                <span className="font-medium text-white">
                  {gpsLocation.lat.toFixed(5)}°, {gpsLocation.lng.toFixed(5)}°
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#86868b]">
                <span>Accuracy: ±{gpsLocation.accuracy}m</span>
                <span className="text-[#30d158] font-medium">Live GPS Sensor</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-white/70">
              {gpsErrorMsg || 'Acquiring satellite GPS coordinates from device sensor...'}
            </div>
          )}
        </div>

        {/* Tab Switcher (Apple Segmented Capsule) */}
        <div className="flex bg-black/40 p-1 rounded-full mb-5 border border-white/[0.08]">
          <button
            onClick={() => { setActiveTab('login'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'login'
                ? 'bg-white/[0.15] text-white shadow-sm'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'register'
                ? 'bg-white/[0.15] text-white shadow-sm'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#ff453a]/15 border border-[#ff453a]/30 rounded-xl flex items-center space-x-2 text-[#ff453a] text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={activeTab === 'login' ? handleLogin : handleRegister} className="space-y-3.5">
          {activeTab === 'register' && (
            <div>
              <label className="block text-[11px] font-medium text-[#86868b] mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#86868b] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Officer / Operator Name"
                  className="w-full bg-black/50 border border-white/[0.1] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#6e6e73] focus:outline-none focus:border-[#2997ff] transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[#86868b] mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#86868b] absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@c2.gov.in"
                className="w-full bg-black/50 border border-white/[0.1] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#6e6e73] focus:outline-none focus:border-[#2997ff] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#86868b] mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#86868b] absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/50 border border-white/[0.1] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#6e6e73] focus:outline-none focus:border-[#2997ff] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full apple-btn-primary font-medium py-2.5 px-4 text-xs tracking-normal transition-all disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : activeTab === 'login' ? 'Sign In with Live GPS' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.08]" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-[#1c1c1e] px-3 text-[#86868b]">or</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleOAuth}
          disabled={loading}
          className="w-full apple-btn-secondary text-xs py-2 px-4 rounded-full flex items-center justify-center space-x-2 font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  );
};
