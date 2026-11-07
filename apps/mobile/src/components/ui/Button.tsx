import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type PressableProps } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: string;
  onPress?: (e: GestureResponderEvent) => unknown;
}

export function Button({ label, variant = 'primary', loading = false, disabled, icon, onPress, ...rest }: ButtonProps) {
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);

  useEffect(() => () => { mounted.current = false; }, []);

  const busy = loading || pending;
  const inactive = disabled || busy;
  const onFill = variant === 'primary' || variant === 'destructive';
  const contentColor = onFill ? colors.surface : variant === 'danger' ? colors.live : colors.ink;

  const handlePress = (e: GestureResponderEvent) => {
    if (inFlight.current || inactive || !onPress) return;
    const result = onPress(e);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      inFlight.current = true;
      setPending(true);
      void (result as Promise<unknown>)
        .catch(() => {})
        .finally(() => {
          inFlight.current = false;
          if (mounted.current) setPending(false);
        });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy }}
      disabled={inactive}
      hitSlop={4}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressedScale,
        disabled && !busy && styles.disabled,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={onFill ? colors.surface : colors.primary} />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.label, { color: contentColor }]} numberOfLines={1}>
            {icon ? `${icon}  ${label}` : label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.live },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#FECACA' },
  label: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.1 },
  pressedScale: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
