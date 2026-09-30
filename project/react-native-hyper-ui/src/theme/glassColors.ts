/** Stable foreground contrast roles for surfaces that use the Glass renderer. */
export const liquidGlassForegroundColors = {
    light: {
        onGlass: '#162235',
        onGlassSecondary: 'rgba(22,34,53,0.72)',
        onGlassMuted: 'rgba(22,34,53,0.52)',
    },
    dark: {
        onGlass: '#EDF3FB',
        onGlassSecondary: 'rgba(237,243,251,0.76)',
        onGlassMuted: 'rgba(237,243,251,0.55)',
    },
} as const;
