import React from "react";
import { colors } from '../../theme/colors';

export const IconSla: React.FC<{ size?: number; color?: string }> = ({
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
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
    <path d="M8 15 L 10 17 L 16 11" stroke={color} fill="none" strokeWidth="3" />
  </svg>
);
