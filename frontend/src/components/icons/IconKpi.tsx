import React from "react";
import { colors } from '../../theme/colors';

export const IconKpi: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = colors.brandYellow }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {/* Upward trending bar chart */}
    <path d="M12 20V10" />
    <path d="M18 20V4" />
    <path d="M6 20v-4" />
    <line x1="1" y1="20" x2="23" y2="20" />
    <polyline points="15 8 18 4 23 8" fill={colors.brandYellow} stroke={colors.brandYellow} />
  </svg>
);

