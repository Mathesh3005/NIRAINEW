import React, { useState } from 'react';
import { Shield, Cpu, Users, MapPin, AlertOctagon, Radio, X, Check } from 'lucide-react';
import { Drone, Officer, Case } from '../types';
import { UserSession } from './DashboardAuthScreen';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
  drones: Drone[];
  officers: Officer[];
  cases: Case[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  onRecallAllDrones: () => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({
  isOpen,
  onClose,
  session,
  drones,
  officers,
  selectedZone,
  onSelectZone,
  onRecallAllDrones
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'users' | 'zones' | 'overrides'>('devices');
  const [revokedNodeIds, setRevokedNodeIds] = useState<Set<string>>(new Set());

  const [dashboardUsers, setDashboardUsers] = useState([
    { id: 'usr-admin', name: 'Senthil Akilan', email: 'senthilakilan47@gmail.com', role: 'SUPER ADMIN', zone: 'ALL SECTORS', status: 'ACTIVE' },
    { id: 'usr-op1', name: 'Insp. R. Arumugam', email: 'arumugam@police.tn.gov.in', role: 'OPERATOR', zone: 'Zone 1 — Central', status: 'ACTIVE' },
    { id: 'usr-op2', name: 'Sub-Insp. K. Valli', email: 'valli@police.tn.gov.in', role: 'FIELD COMMANDER', zone: 'Zone 2 — T. Nagar', status: 'ACTIVE' },
    { id: 'usr-op3', name: 'Drone Pilot Alpha', email: 'pilot.alpha@nirai.app', role: 'DRONE OPERATOR', zone: 'Zone 1 — Central', status: 'ACTIVE' }
  ]);

  if (!isOpen) return null;

  const toggleNodeRevocation = (id: string) => {
    setRevokedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUserStatus = (id: string) => {
    setDashboardUsers(prev => prev.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 select-none">
      <div className="apple-glass rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center shadow-[0_2px_12px_rgba(245,158,11,0.25)]">
              <Shield className="w-5 h-5 text-[#ff9f0a]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="apple-headline text-base font-semibold text-white">Administration Console</h2>
                <span className="bg-[#ff9f0a]/20 text-[#ff9f0a] text-[10px] px-2 py-0.5 rounded-full font-medium border border-[#ff9f0a]/30">
                  Root
                </span>
              </div>
              <p className="text-xs text-[#86868b] mt-0.5">{session.name} ({session.email})</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Console Navigation Tabs (Apple Segmented Bar) */}
        <div className="p-3 bg-black/30 border-b border-white/[0.06] flex justify-center">
          <div className="flex bg-black/50 p-1 rounded-full border border-white/[0.08] space-x-1">
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all ${
                activeTab === 'devices'
                  ? 'bg-white/[0.16] text-white shadow-sm'
                  : 'text-[#86868b] hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#2997ff]" />
              <span>Hardware Nodes</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all ${
                activeTab === 'users'
                  ? 'bg-white/[0.16] text-white shadow-sm'
                  : 'text-[#86868b] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#30d158]" />
              <span>Operators</span>
            </button>

            <button
              onClick={() => setActiveTab('zones')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all ${
                activeTab === 'zones'
                  ? 'bg-white/[0.16] text-white shadow-sm'
                  : 'text-[#86868b] hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#ff9f0a]" />
              <span>City Sectors</span>
            </button>

            <button
              onClick={() => setActiveTab('overrides')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all ${
                activeTab === 'overrides'
                  ? 'bg-white/[0.16] text-white shadow-sm'
                  : 'text-[#86868b] hover:text-white'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-[#ff453a]" />
              <span>Overrides</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: Connected Devices & Access Revocation */}
          {activeTab === 'devices' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#86868b]">Active Hardware & Mobile Registry</span>
                <span className="text-xs text-[#30d158] apple-tabular">{drones.length + officers.length} Registered</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Drones */}
                {drones.map(d => {
                  const isRevoked = revokedNodeIds.has(d.id);
                  return (
                    <div key={d.id} className="apple-card p-3.5 rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Radio className={`w-3.5 h-3.5 ${isRevoked ? 'text-[#ff453a]' : 'text-[#bf5af2]'}`} />
                          <span className="text-xs font-semibold text-white/90">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-[#86868b] block mt-0.5 apple-tabular">
                          ID: {d.id} • Type: {d.type} • Battery: {d.batteryPct}%
                        </span>
                      </div>
                      <button
                        onClick={() => toggleNodeRevocation(d.id)}
                        className={`text-[11px] py-1 px-3 apple-pill-btn font-medium ${
                          isRevoked
                            ? 'bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 hover:bg-[#30d158]/25'
                            : 'apple-btn-destructive'
                        }`}
                      >
                        {isRevoked ? 'Restore Access' : 'Revoke Node'}
                      </button>
                    </div>
                  );
                })}

                {/* Officers */}
                {officers.map(o => {
                  const isRevoked = revokedNodeIds.has(o.userId);
                  return (
                    <div key={o.userId} className="apple-card p-3.5 rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Shield className={`w-3.5 h-3.5 ${isRevoked ? 'text-[#ff453a]' : 'text-[#0a84ff]'}`} />
                          <span className="text-xs font-semibold text-white/90">{o.name}</span>
                        </div>
                        <span className="text-[10px] text-[#86868b] block mt-0.5 apple-tabular">
                          Badge: {o.badgeId} • Vehicle: {o.vehicle}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleNodeRevocation(o.userId)}
                        className={`text-[11px] py-1 px-3 apple-pill-btn font-medium ${
                          isRevoked
                            ? 'bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 hover:bg-[#30d158]/25'
                            : 'apple-btn-destructive'
                        }`}
                      >
                        {isRevoked ? 'Restore Access' : 'Revoke Access'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: User Role & Access Management */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-[#86868b] block">Command Roster</span>

              <div className="space-y-2.5">
                {dashboardUsers.map(u => (
                  <div key={u.id} className="apple-card p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-white">{u.name}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          u.role === 'SUPER ADMIN'
                            ? 'bg-[#ff9f0a]/20 text-[#ff9f0a] border border-[#ff9f0a]/30'
                            : 'bg-[#2997ff]/20 text-[#2997ff] border border-[#2997ff]/30'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <span className="text-xs text-[#86868b] block mt-1">{u.email} • {u.zone}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {u.role !== 'SUPER ADMIN' && (
                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={`text-xs py-1.5 px-3.5 apple-pill-btn font-medium ${
                            u.status === 'ACTIVE'
                              ? 'apple-btn-destructive'
                              : 'bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 hover:bg-[#30d158]/25'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Suspend Operator' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: City Sector & Zoning Access */}
          {activeTab === 'zones' && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-[#86868b] block">Geographic Sector Filtering</span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { name: 'All Sectors (Global)', desc: 'View all metropolitan units & incidents', id: 'ALL' },
                  { name: 'Zone 1 — Chennai Central', desc: 'Central Railway, Mount Road, Harbour', id: 'ZONE_1' },
                  { name: 'Zone 2 — T. Nagar / South', desc: 'Ranganathan St, Guindy, Velachery', id: 'ZONE_2' },
                  { name: 'Zone 3 — Anna Nagar / North', desc: 'Tower Park, Koyambedu, Red Hills', id: 'ZONE_3' }
                ].map(zone => {
                  const isSelected = selectedZone === zone.id;
                  return (
                    <div
                      key={zone.id}
                      onClick={() => onSelectZone(zone.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#ff9f0a]/10 border-[#ff9f0a]/60 shadow-apple-card ring-1 ring-[#ff9f0a]/30'
                          : 'apple-card apple-card-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white">{zone.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#ff9f0a]" />}
                      </div>
                      <p className="text-[11px] text-[#86868b]">{zone.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Master Emergency Overrides */}
          {activeTab === 'overrides' && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-[#ff453a] block">Emergency Overrides</span>

              <div className="apple-card p-4 rounded-2xl flex items-center justify-between border border-[#ff453a]/25 bg-[#ff453a]/5">
                <div>
                  <h4 className="text-xs font-semibold text-[#ff453a]">Emergency Fleet Grounding</h4>
                  <p className="text-[11px] text-[#86868b] mt-0.5">Force recall all airborne reconnaissance drones back to dock immediately.</p>
                </div>
                <button
                  onClick={onRecallAllDrones}
                  className="apple-pill-btn bg-[#ff453a] hover:bg-[#ff5147] text-white text-xs font-medium px-4 py-2 shadow-lg shadow-[#ff453a]/30"
                >
                  Ground All Drones
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
