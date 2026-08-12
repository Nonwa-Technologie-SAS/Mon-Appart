export const Brand = {
  primary: '#1565c0',
  primaryForeground: '#ffffff',
  secondary: '#ffc107',
  secondaryForeground: '#212121',
} as const;

/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1a1a1a',
    background: '#f5f7fb',
    backgroundElement: '#ffffff',
    backgroundSelected: '#e3f2fd',
    textSecondary: '#6b7280',
    primary: Brand.primary,
    primaryForeground: Brand.primaryForeground,
    secondary: Brand.secondary,
    secondaryForeground: Brand.secondaryForeground,
    border: '#e5e7eb',
    danger: '#dc2626',
  },
  dark: {
    text: '#f5f5f5',
    background: '#0f1419',
    backgroundElement: '#1a222d',
    backgroundSelected: '#1e3a5f',
    textSecondary: '#9ca3af',
    primary: Brand.primary,
    primaryForeground: Brand.primaryForeground,
    secondary: Brand.secondary,
    secondaryForeground: Brand.secondaryForeground,
    border: '#2a3441',
    danger: '#f87171',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
