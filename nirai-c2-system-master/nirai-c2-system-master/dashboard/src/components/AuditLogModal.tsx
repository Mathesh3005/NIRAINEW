import React from 'react';
import { Cpu, Lock, X } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLog[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 select-none">
      <div className="apple-glass rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#bf5af2]/15 border border-[#bf5af2]/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-[#bf5af2]" />
            </div>
            <div>
              <h3 className="apple-headline font-semibold text-base text-white">Evidence Log & Chain-of-Custody</h3>
              <p className="text-xs text-[#86868b]">Immutable cryptographic incident trail</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/70 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-2.5 text-xs">
          {logs.length === 0 ? (
            <p className="text-center text-[#86868b] py-12">No audit entries logged</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="apple-card p-3.5 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#2997ff]">
                  <span className="font-semibold text-white/90">{log.action}</span>
                  <span className="text-[#86868b] apple-tabular">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-white/80 text-xs">
                  <span className="text-[#86868b]">Actor: </span>{log.actor} • <span className="text-[#86868b]">Target: </span>{log.target}
                </div>
                <div className="text-[10px] text-[#86868b] flex items-center space-x-1.5 truncate pt-1.5 border-t border-white/[0.06] font-mono">
                  <Lock className="w-3 h-3 text-[#bf5af2] flex-shrink-0" />
                  <span className="truncate">SHA-256: {log.hash}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-white/[0.08] text-right bg-black/30 flex justify-end">
          <button
            onClick={onClose}
            className="apple-btn-secondary text-xs py-1.5 px-4"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
