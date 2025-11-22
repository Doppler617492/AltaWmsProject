import React from "react";
import { colors } from '../../theme/colors';

export const IconReceiving: React.FC<{ size?: number; color?: string }> = ({
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
    <path d="M3 3h18v2H3z" />
    <path d="M5 7h14v12H5z" />
    <path d="M8 11h8M8 15h4" />
    <path d="M12 7v-4M9 5h6" />
  </svg>
);

