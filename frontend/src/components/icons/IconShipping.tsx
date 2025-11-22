import React from "react";
import { colors } from '../../theme/colors';

export const IconShipping: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
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
    <path d="M2 12h20M5 8h14v8H5z" />
    <circle cx="8" cy="12" r="1.5" fill={color} />
    <circle cx="16" cy="12" r="1.5" fill={color} />
    <path d="M3 12h18M8 12v4M16 12v4" />
  </svg>
);

