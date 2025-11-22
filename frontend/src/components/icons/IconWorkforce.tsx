import React from "react";
import { colors } from '../../theme/colors';

export const IconWorkforce: React.FC<{ size?: number; color?: string }> = ({
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
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M17 11l2 2 4-4" stroke={color} fill="none" strokeWidth="3" />
    <path d="M20 18v-1a4 4 0 00-4-4H9a4 4 0 00-4 4v1" opacity="0.5" />
    <circle cx="16" cy="7" r="3" opacity="0.5" />
  </svg>
);

