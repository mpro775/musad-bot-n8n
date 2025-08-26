// src/common/constants/brand.ts
export const ALLOWED_DARK_BRANDS = [
    '#0B1220', // Midnight
    '#111827', // Slate 900
    '#1F2937', // Slate 800/900
    '#1E1B4B', // Indigo 950
    '#312E81', // Indigo 900
    '#3B0764', // Violet 950
    '#3F1D2B', // Rosewood
    '#052E2B', // Teal 950
    '#064E3B', // Emerald 900
    '#7F1D1D', // Red 900
  ] as const;
  export type AllowedDarkBrand = typeof ALLOWED_DARK_BRANDS[number];
  