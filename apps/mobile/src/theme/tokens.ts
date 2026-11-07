import { Platform } from 'react-native';

/**
 * Kisan Sarathi design tokens — light theme inspired by Sovece's production architecture.
 * Single source of truth for every screen and component.
 */
export const colors = {
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  sunken: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  ink: '#0F172A', // headings, numbers, critical IDs
  body: '#475569',
  muted: '#94A3B8', // micro-labels, timestamps

  /** Agricultural Green / PMFBY Verification */
  primary: '#059669',
  primaryPressed: '#047857',
  primarySoft: '#ECFDF5',

  /** Statutory GovTech Blue */
  govBlue: '#2563EB',
  govBluePressed: '#1D4ED8',
  govBlueSoft: '#EFF6FF',

  /** Verified Doppler Radar / Official Approval */
  verified: '#059669',
  verifiedSoft: '#ECFDF5',

  /** Critical Loss Alert / Urgent 72h SLA Deadline */
  live: '#DC2626',
  liveSoft: '#FEF2F2',

  /** Pending Surveyor Review / Caution */
  warn: '#B45309',
  warnSoft: '#FFFBEB',
} as const;

/** 4pt base; layout sticks to the 16 / 20 grid. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 12, lg: 16, pill: 999 } as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.body },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.body },
  micro: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.muted },
  data: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.body, fontVariant: ['tabular-nums'] as const },
  stat: { fontFamily: fonts.monoBold, fontSize: 16, lineHeight: 22, color: colors.ink, fontVariant: ['tabular-nums'] as const },
  brandCaps: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 12 * 0.14, textTransform: 'uppercase' as const, color: colors.ink },
} as const;

export const elevation = {
  card: { boxShadow: '0px 1px 2px rgba(15, 23, 42, 0.04), 0px 8px 24px rgba(15, 23, 42, 0.05)' },
  raised: { boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.10)' },
} as const;

export const hairline = { borderWidth: 1, borderColor: colors.border } as const;

export const inputReset = Platform.select({ web: { outlineWidth: 0 }, default: {} });
