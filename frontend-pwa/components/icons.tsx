import React from 'react';

export const BoxIcon: React.FC<{ size?: number; color?: string }>=({ size=40, color='#000' })=> (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M21 16V8a2 2 0 0 0-1.106-1.789l-7-3.5a2 2 0 0 0-1.788 0l-7 3.5A2 2 0 0 0 3 8v8a2 2 0 0 0 1.106 1.789l7 3.5a2 2 0 0 0 1.788 0l7-3.5A2 2 0 0 0 21 16Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.27 6.96 12 11l8.73-4.04M12 22V11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TagIcon: React.FC<{ size?: number; color?: string }>=({ size=40, color='#000' })=> (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M20.59 13.41 12 22l-8.59-8.59A2 2 0 0 1 3 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.41.59L20.59 8a2 2 0 0 1 0 2.83Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7.5" cy="7.5" r="1.5" fill={color} />
  </svg>
);

export const TruckIcon: React.FC<{ size?: number; color?: string }>=({ size=40, color='#000' })=> (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M10 17H6a2 2 0 0 1-2-2V7h10v5h3l3 3v2h-2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7.5" cy="17.5" r="1.5" stroke={color} strokeWidth="2" />
    <circle cx="17.5" cy="17.5" r="1.5" stroke={color} strokeWidth="2" />
  </svg>
);

