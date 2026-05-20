"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateOpacity = exports.opacity = exports.borderRadius = exports.typography = exports.spacing = exports.shadows = exports.borderWidth = exports.colors = void 0;
exports.colors = {
    // Primary Brand Colors - iOS Blue
    primary: {
        50: '#E5F0FF',
        100: '#CCE1FF',
        200: '#99C3FF',
        300: '#66A5FF',
        400: '#3387FF',
        500: '#007AFF',
        600: '#0062CC',
        700: '#004999',
        800: '#003166',
        900: '#001833',
    },
    // Background Colors - iOS Dark Mode
    background: '#000000',
    surface: '#1C1C1E',
    surfaceElevated: '#2C2C2E',
    surfaceCard: '#1C1C1E',
    glass: 'rgba(28, 28, 30, 0.85)',
    glassLight: 'rgba(44, 44, 46, 0.82)',
    glassDark: 'rgba(18, 18, 18, 0.88)',
    glassUltra: 'rgba(28, 28, 30, 0.92)',
    // Semantic Colors - iOS System Colors
    success: '#30D158',
    successLight: '#32D74B',
    warning: '#FF9F0A',
    error: '#FF453A',
    errorLight: '#FF6961',
    info: '#007AFF',
    // Text Colors - iOS Dark Mode
    text: {
        primary: '#FFFFFF',
        secondary: 'rgba(255, 255, 255, 0.6)',
        tertiary: 'rgba(255, 255, 255, 0.4)',
        quaternary: 'rgba(255, 255, 255, 0.4)',
        muted: 'rgba(255, 255, 255, 0.5)',
        inverse: '#000000',
    },
    // Border & Dividers - iOS Style
    border: {
        light: 'rgba(84, 84, 88, 0.3)',
        default: 'rgba(84, 84, 88, 0.65)',
        focus: '#007AFF',
    },
    // iOS System Grays
    systemGray: '#8E8E93',
    systemGray2: '#636366',
    systemGray3: '#48484A',
    systemGray4: '#3A3A3C',
    systemGray5: '#2C2C2E',
    systemGray6: '#1C1C1E',
    // Liquid Glass tokens
    liquidGlassBorder: 'rgba(255, 255, 255, 0.22)', // luminous edge highlight
    liquidGlassBorderDim: 'rgba(255, 255, 255, 0.12)', // subtler edge
    liquidGlassSpecular: 'rgba(255, 255, 255, 0.11)', // top shimmer tint
    liquidGlassTint: 'rgba(28, 28, 30, 0.55)', // lighter base for use with BlurView
    liquidGlassSuccess: 'rgba(48, 209, 88, 0.55)', // success tinted border
    liquidGlassCyan: 'rgba(100, 210, 255, 0.45)', // cyan tinted border
    // Basic colors for compatibility
    white: '#FFFFFF',
    black: '#000000',
    // Accessible foreground colors for colored surfaces
    onColor: {
        primary: '#FFFFFF',
        info: '#111111',
        success: '#111111',
        warning: '#111111',
        error: '#111111',
        surface: '#FFFFFF',
    },
};
exports.borderWidth = {
    hairline: 0.5,
    thin: 1,
    medium: 1.5,
};
exports.shadows = {
    sm: {
        shadowColor: exports.colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 1.5,
        elevation: 1,
    },
    md: {
        shadowColor: exports.colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: exports.colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    glow: {
        shadowColor: exports.colors.primary[500],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    successGlow: {
        shadowColor: exports.colors.success,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
        elevation: 6,
    },
    card: {
        shadowColor: exports.colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    // Liquid glass enhanced shadows
    float: {
        shadowColor: exports.colors.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
        elevation: 8,
    },
    panel: {
        shadowColor: exports.colors.black,
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
        elevation: 16,
    },
    glowBlue: {
        shadowColor: exports.colors.primary[500],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
        elevation: 6,
    },
    glowGreen: {
        shadowColor: exports.colors.success,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
        elevation: 6,
    },
    glowCyan: {
        shadowColor: exports.colors.info,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 6,
    },
    glowRed: {
        shadowColor: exports.colors.error,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
};
exports.spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
};
exports.typography = {
    // Headings
    h1: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
    h3: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
    h4: { fontSize: 18, fontWeight: '600', letterSpacing: -0.1 },
    // Body
    bodyLarge: { fontSize: 16, fontWeight: '400', letterSpacing: 0 },
    body: { fontSize: 14, fontWeight: '400', letterSpacing: 0 },
    bodySmall: { fontSize: 12, fontWeight: '400', letterSpacing: 0 },
    // Special
    label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
    caption: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
    button: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
    // Legacy support
    title: { fontSize: 28, fontWeight: '700', color: exports.colors.text.primary },
    subtitle: { fontSize: 18, fontWeight: '500', color: exports.colors.text.secondary },
};
exports.borderRadius = {
    xs: 4,
    sm: 8,
    md: 10,
    lg: 13,
    xl: 16,
    '2xl': 20,
    full: 9999,
};
// Opacity values for different states
exports.opacity = {
    transparent: 0,
    light: 0.1,
    faint: 0.2,
    soft: 0.3,
    medium: 0.5,
    strong: 0.7,
    heavy: 0.8,
    solid: 1,
};
// State-specific opacity values
exports.stateOpacity = {
    disabled: 0.5,
    hover: 0.8,
    pressed: 0.9,
    focus: 1,
    selected: 1,
};
