import React from "react";
import { colors } from '../../theme/colors';

export const IconCapacity: React.FC<{ size?: number; color?: string }> = ({
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
    <path d="M3 3h18v18H3z" />
    <path d="M3 8h18M8 3v18M16 3v18" />
    <path d="M3 13h6v6H3z" />
    <path d="M15 13h6v6h-6z" />
  </svg>
);

