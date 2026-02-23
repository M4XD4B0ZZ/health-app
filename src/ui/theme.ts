export const tokens = {
  colors: {
    // Warm-Neutral Palette
    background: '#FAF9F7', // Off-white with a slight warm tint
    surface: '#F2EFE9',    // Slightly deeper grouped area tint
    textPrimary: '#2A2825',// Deep warm charcoal (avoids harsh pure black)
    textMuted: '#736B63',  // Subdued warm gray
    divider: '#E5E0D8',    // Very subtle warm structural line
    accent: '#D97757',     // Muted terracotta / warm clay (calm but clear)
    danger: '#D15B5B',     // Restrained dusty red
    transparent: 'transparent',
    inverse: '#FAF9F7',
  },
  typography: {
    title: { fontSize: 24, fontWeight: '700' as const, color: '#2A2825', letterSpacing: -0.5 },
    body: { fontSize: 16, fontWeight: '400' as const, color: '#2A2825', lineHeight: 24 },
    meta: { fontSize: 13, fontWeight: '500' as const, color: '#736B63', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    // Use tabular-nums in RN style for numeric to prevent juddering during updates
    numeric: { fontSize: 20, fontWeight: '600' as const, color: '#2A2825', fontVariant: ['tabular-nums'] },
  },
  spacing: {
    xs: 8,
    s: 16,
    m: 24,
    l: 32,
    xl: 48, // Added for major section spacing
  },
  radius: {
    small: 8,
    medium: 16,
  }
};
