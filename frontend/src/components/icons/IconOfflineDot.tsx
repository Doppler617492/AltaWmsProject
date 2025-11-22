import React from "react";
import { colors } from '../../theme/colors';

export const IconOfflineDot: React.FC<{ size?: number; color?: string }> = ({
  size = 10,
  color = colors.statusOffline,
}) => (
  <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
    <circle cx="5" cy="5" r="5" fill={color} />
  </svg>
);


