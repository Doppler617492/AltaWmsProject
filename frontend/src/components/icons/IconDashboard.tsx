import React from "react";
import { colors } from '../../theme/colors';

export const IconDashboard: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = colors.brandYellow,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Panel grid */}
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="10" y1="3" x2="10" y2="21" />
    {/* Accents */}
    <circle cx="6.5" cy="6.5" r="1.5" fill={colors.brandYellow} stroke="none" />
    <circle cx="15.5" cy="6.5" r="1.5" fill={colors.brandYellow} stroke="none" />
    <circle cx="6.5" cy="15.5" r="1.5" fill={colors.brandYellow} stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.5" fill={colors.brandYellow} stroke="none" />
  </svg>
);

