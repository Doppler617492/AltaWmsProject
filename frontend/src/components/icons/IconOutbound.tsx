import React from "react";
import { colors } from '../../theme/colors';

export const IconOutbound: React.FC<{ size?: number; color?: string }> = ({
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
    {/* Box leaving the warehouse */}
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
    <path d="M8 12h8" />
    <path d="M12 7v15" />
    <polyline points="10 4 14 4" />
    <polyline points="14 4 18 8" />
    <path d="M16 8 L 18 10 L 16 12 L 14 10 L 16 8 Z" fill={colors.brandYellow} stroke={colors.brandYellow} />
  </svg>
);

