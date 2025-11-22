import React from "react";
import { colors } from '../../theme/colors';

export const IconInbound: React.FC<{ size?: number; color?: string }> = ({
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
    {/* Truck receiving a box */}
    <path d="M22 17H2a4 4 0 00-4-4V5h18l4 6v8z" />
    <line x1="12" y1="12" x2="12" y2="20" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <circle cx="7" cy="17" r="1" fill={colors.brandYellow} stroke={color} />
    <circle cx="17" cy="17" r="1" fill={colors.brandYellow} stroke={color} />
  </svg>
);

