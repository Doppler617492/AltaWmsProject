import React from "react";
import { colors } from '../../theme/colors';

export const IconStock: React.FC<{ size?: number; color?: string }> = ({
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
    <path d="M21 8l-7.9 4.9V20" />
    <polyline points="21 8 13 3 5 8" />
    <polyline points="5 8 5 20 13 20" />
    <path d="M17 17l4 4" stroke={colors.brandYellow} />
    <circle cx="15" cy="15" r="5" stroke={colors.brandYellow} fill="none" />
    <circle cx="15" cy="15" r="3" fill={colors.brandYellow} stroke="none" />
  </svg>
);

