import React, { useState } from 'react';
import type { ItemCardProps, ItemStatus } from '../../types/receiving';
import { calculateRemaining, getItemStatus } from '../../utils/format';

const statusConfig: Record<ItemStatus, { icon: string; color: string; bg: string; border: string; label: string }> = {
  OK: { icon: '✓', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'OK' },
  CRITICAL: { icon: '!', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Kritično' },
  SHORTAGE: { icon: '↓', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Manjak' },
  EXCESS: { icon: '↑', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Višak' },
  CONFIRMED: { icon: '✓', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', label: 'Potvrđeno' },
  UNPROCESSED: { icon: '○', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', label: 'Neobrađeno' },
};

export default function ItemCard({ 
  item, 
  onConfirm, 
  onEdit, 
  isExpanded = false,
  onToggleExpand,
  isLoading = false
}: ItemCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const status = getItemStatus(item);
  const remaining = calculateRemaining(item.requested, item.received);
  const progressPct = item.requested > 0 ? (item.received / item.requested) * 100 : 0;
  const config = statusConfig[status];
  const chevronClass = isExpanded ? 'transform rotate-180' : '';

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoading && status !== 'CONFIRMED') {
      onConfirm(item.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(item);
  };

  return (
    <div
      className={`
        transition-all duration-200 relative group rounded-lg border
        ${config.bg} ${config.border}
        bg-[#171A1D] hover:bg-[#1a1d20]
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main card content */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Left: Code & Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {item.code}
              </span>
              <div className={`flex items-center gap-1 ${config.color} ${config.bg} border ${config.border} px-1.5 py-0.5 rounded-full text-xs font-medium`}>
                <span className="text-xs">{config.icon}</span>
                <span className="text-xs">{config.label}</span>
              </div>
            </div>
            
            <h3 className="font-semibold text-zinc-200 text-sm leading-tight line-clamp-2">
              {item.name}
            </h3>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {status !== 'CONFIRMED' && (
                <button
                  onClick={handleEdit}
                  className="px-2 py-1 text-xs font-medium rounded-full 
                           text-zinc-300 hover:text-zinc-100 
                           bg-zinc-800 hover:bg-zinc-700 
                           transition-colors focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none"
                  aria-label="Uredi stavku"
                >
                  Uredi
                </button>
              )}
              
              <button
                onClick={handleConfirm}
                disabled={isLoading || status === 'CONFIRMED'}
                className={`
                  rounded-full px-3 py-1.5 font-medium text-xs
                  transition-all duration-200 focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none
                  ${status === 'CONFIRMED'
                    ? 'bg-emerald-600 text-white cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black'}
                  ${isLoading ? 'opacity-50 cursor-wait' : ''}
                `}
                aria-label="Potvrdi prijem"
              >
                {isLoading ? 'Spremam...' : status === 'CONFIRMED' ? 'Potvrđeno' : 'Potvrdi'}
              </button>
            </div>
          </div>
        </div>

        {/* Quantities section */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="bg-zinc-900/50 rounded p-2 border border-zinc-800">
            <div className="text-xs text-zinc-400 mb-0.5">Traženo</div>
            <div className="text-base font-bold text-zinc-200">{item.requested}</div>
          </div>
          
          <div className="bg-zinc-900/50 rounded p-2 border border-zinc-800">
            <div className="text-xs text-zinc-400 mb-0.5">Zaprimljeno</div>
            <div className={`text-base font-bold ${item.received > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {item.received}
            </div>
          </div>
          
          <div className="bg-zinc-900/50 rounded p-2 border border-zinc-800">
            <div className="text-xs text-zinc-400 mb-0.5">Preostalo</div>
            <div className={`text-base font-bold ${remaining > 0 ? 'text-orange-400' : 'text-zinc-400'}`}>
              {remaining}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {item.requested > 0 && (
          <div className="mt-2">
            <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

