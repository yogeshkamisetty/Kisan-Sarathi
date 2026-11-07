import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';

export type ClaimStatus =
  | 'DRAFT'
  | 'INTIMATION_RECORDED'
  | 'VERIFIED_DOPPLER'
  | 'SURVEYOR_DISPATCHED'
  | 'SETTLED'
  | 'CRITICAL_URGENT';

const STYLE: Record<ClaimStatus, { label: string; fg: string; bg: string; dot?: boolean }> = {
  DRAFT: { label: 'ड्राफ्ट (Draft)', fg: colors.body, bg: colors.sunken },
  INTIMATION_RECORDED: { label: 'सूचना दर्ज (Recorded)', fg: colors.govBlue, bg: colors.govBlueSoft, dot: true },
  VERIFIED_DOPPLER: { label: 'रडार सत्यापित (97% Match)', fg: colors.verified, bg: colors.verifiedSoft, dot: true },
  SURVEYOR_DISPATCHED: { label: 'सर्वेक्षक सक्रिय (SLA 24h)', fg: colors.warn, bg: colors.warnSoft, dot: true },
  SETTLED: { label: 'निपटाया गया (Settled)', fg: colors.verified, bg: colors.verifiedSoft },
  CRITICAL_URGENT: { label: 'अति-आवश्यक (<72h सीमा)', fg: colors.live, bg: colors.liveSoft, dot: true },
};

export function StatusPill({ status }: { status: ClaimStatus }) {
  const s = STYLE[status] || STYLE.DRAFT;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} accessibilityLabel={`Status: ${s.label}`}>
      {s.dot && <View style={[styles.dot, { backgroundColor: s.fg }]} />}
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.semibold, fontSize: 12 },
});
