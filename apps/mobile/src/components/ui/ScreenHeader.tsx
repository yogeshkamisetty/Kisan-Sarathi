import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 52, paddingHorizontal: space.md },
  back: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sunken },
  backText: { fontSize: 24, fontWeight: 'bold', color: colors.ink, marginTop: -2 },
  pressed: { opacity: 0.6 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  right: { flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center' },
});
