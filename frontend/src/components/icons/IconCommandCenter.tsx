import React from "react";
import { colors } from '../../theme/colors';

export const IconCommandCenter: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = colors.brandYellow }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {/* Central control point with radiating signals */}
    <circle cx="12" cy="12" r="3" fill={colors.textPrimary} stroke="none" />
    <line x1="12" y1="2" x2="12" y2="6" stroke={color} />
    <line x1="12" y1="18" x2="12" y2="22" stroke={color} />
    <line x1="22" y1="12" x2="18" y2="12" stroke={color} />
    <line x1="6" y1="12" x2="2" y2="12" stroke={color} />
    <line x1="19" y1="5" x2="16.5" y2="7.5" stroke={color} />
    <line x1="5" y1="19" x2="7.5" y2="16.5" stroke={color} />
  </svg>
);
