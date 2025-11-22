import React from "react";
import { colors } from '../../theme/colors';

export const IconMap: React.FC<{ size?: number; color?: string }> = ({
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
    <path d="M3 3v18h18V3L3 3Z" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <circle cx="16" cy="16" r="3" fill={colors.brandYellow} stroke="none" />
    <line x1="16" y1="13" x2="16" y2="1" stroke={colors.brandYellow} />
  </svg>
);

