import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radius } from "../theme/tokens";
import { TRACKED_RECORD_TYPES, RECORD_TYPE_LABELS } from "../health/recordTypes";

const REASONS: Partial<Record<(typeof TRACKED_RECORD_TYPES)[number], string>> = {
  HeartRate: "To show heart-rate trends alongside your logged workouts.",
  RestingHeartRate: "As a baseline signal for recovery context.",
  HeartRateVariabilityRmssd: "As an additional recovery signal, where your device provides it.",
  Steps: "For daily activity context around your training.",
  ActiveCaloriesBurned: "For daily activity context around your training.",
  SleepSession: "To connect sleep with training load and recovery.",
  ExerciseSession: "To cross-reference workouts recorded by your watch with those logged in Repvyn.",
};

interface Props {
  onContinue?: () => void;
  onClose?: () => void;
}

// Required by Health Connect policy: an in-app screen explaining why each
// permission is requested, reachable both proactively (before requesting
// permissions) and via the system's own "why does this app want my health
// data" flow (the ViewPermissionUsageActivity alias registered by the
// react-native-health-connect config plugin targets this app's MainActivity,
// which routes here — see App.tsx's initial-intent handling).
export function PermissionRationaleScreen({ onContinue, onClose }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Why Repvyn asks for this</Text>
        <Text style={styles.intro}>
          Repvyn reads your health data to provide training and recovery insights. Nothing is
          shared publicly, sold, or sent to third-party analytics. You can disconnect and delete
          this data at any time from the app.
        </Text>

        {TRACKED_RECORD_TYPES.map((type) => (
          <View key={type} style={styles.row}>
            <Text style={styles.rowLabel}>{RECORD_TYPE_LABELS[type]}</Text>
            <Text style={styles.rowReason}>{REASONS[type]}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        {onContinue && (
          <Pressable style={styles.primaryButton} onPress={onContinue}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        )}
        {onClose && (
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xxl },
  heading: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: spacing.md },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.xxl },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  rowReason: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  actions: {
    padding: spacing.xxl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.bg, fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.text, fontWeight: "600", fontSize: 15 },
});
