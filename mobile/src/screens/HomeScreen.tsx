import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useHealthConnection } from "../health/useHealthConnection";
import { openHealthConnectInPlayStore } from "../health/healthConnectClient";
import { colors, spacing, radius } from "../theme/tokens";

interface Props {
  onRequestRationale: (onContinue: () => void) => void;
}

export function HomeScreen({ onRequestRationale }: Props) {
  const { user, logout } = useAuth();
  const health = useHealthConnection();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnectPress = () => {
    // Show the rationale before the OS permission prompt, per Health Connect's
    // requirement that apps explain each permission rather than firing the
    // system dialog cold.
    onRequestRationale(() => health.connect());
  };

  const handleDisconnect = (deleteData: boolean) => {
    Alert.alert(
      deleteData ? "Delete health data?" : "Disconnect health data?",
      deleteData
        ? "This permanently deletes all health data Repvyn has synced. This cannot be undone."
        : "Repvyn will stop syncing. Previously synced data stays until you delete it separately. To fully revoke access, also remove the permission from Health Connect settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: deleteData ? "Delete" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setDisconnecting(true);
            try {
              await health.disconnect({ deleteData });
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Repvyn Health</Text>
          <Text style={styles.greeting}>Hi{user?.name ? `, ${user.name}` : ""}</Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {health.phase === "checking" && (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {health.phase === "unsupported" && (
          <>
            <Text style={styles.cardTitle}>Health Connect isn't available</Text>
            <Text style={styles.cardBody}>
              Install Health Connect from the Play Store to bring heart rate, sleep, and activity
              into Repvyn.
            </Text>
            <Pressable style={styles.primaryButton} onPress={openHealthConnectInPlayStore}>
              <Text style={styles.primaryButtonText}>Get Health Connect</Text>
            </Pressable>
          </>
        )}

        {health.phase === "update_required" && (
          <>
            <Text style={styles.cardTitle}>Health Connect needs an update</Text>
            <Pressable style={styles.primaryButton} onPress={openHealthConnectInPlayStore}>
              <Text style={styles.primaryButtonText}>Update Health Connect</Text>
            </Pressable>
          </>
        )}

        {health.phase === "not_connected" && (
          <>
            <Text style={styles.cardTitle}>Connect your health data</Text>
            <Text style={styles.cardBody}>
              Bring heart rate, sleep, and activity into Repvyn to understand how your training
              fits into your recovery.
            </Text>
            {health.error && <Text style={styles.error}>{health.error}</Text>}
            <Pressable style={styles.primaryButton} onPress={handleConnectPress}>
              <Text style={styles.primaryButtonText}>Connect Health</Text>
            </Pressable>
          </>
        )}

        {health.phase === "connecting" && (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.cardBody}>Requesting permissions…</Text>
          </View>
        )}

        {health.phase === "permission_revoked" && (
          <>
            <Text style={styles.cardTitle}>Health access was revoked</Text>
            <Text style={styles.cardBody}>
              Permission was removed from Health Connect settings. Reconnect to resume syncing.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleConnectPress}>
              <Text style={styles.primaryButtonText}>Reconnect</Text>
            </Pressable>
          </>
        )}

        {(health.phase === "connected" || health.phase === "syncing") && (
          <>
            <Text style={styles.cardTitle}>Health data connected</Text>
            {health.lastSyncResult && (
              <Text style={styles.cardBody}>
                Last sync: {health.lastSyncResult.mode === "historical" ? "imported" : "updated"}{" "}
                {health.lastSyncResult.upserted} record
                {health.lastSyncResult.upserted === 1 ? "" : "s"}
                {health.lastSyncResult.deleted > 0 ? `, removed ${health.lastSyncResult.deleted}` : ""}.
              </Text>
            )}
            {health.error && <Text style={styles.error}>{health.error}</Text>}

            <Pressable
              style={[styles.primaryButton, health.phase === "syncing" && styles.buttonDisabled]}
              onPress={health.sync}
              disabled={health.phase === "syncing"}
            >
              {health.phase === "syncing" ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.primaryButtonText}>Sync Now</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => onRequestRationale(() => {})}
            >
              <Text style={styles.secondaryButtonText}>What data does Repvyn read?</Text>
            </Pressable>

            <Pressable
              style={styles.dangerButton}
              onPress={() => handleDisconnect(false)}
              disabled={disconnecting}
            >
              <Text style={styles.dangerButtonText}>Disconnect</Text>
            </Pressable>
            <Pressable
              style={styles.dangerButton}
              onPress={() => handleDisconnect(true)}
              disabled={disconnecting}
            >
              <Text style={styles.dangerButtonText}>Delete synced health data</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xxl, paddingTop: spacing.xxxl * 1.5 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  greeting: { color: colors.text, fontSize: 24, fontWeight: "800" },
  logout: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xxl,
  },
  centered: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: spacing.xs },
  cardBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
  primaryButton: {
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.bg, fontWeight: "700", fontSize: 14 },
  secondaryButton: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  secondaryButtonText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  dangerButton: { height: 40, alignItems: "center", justifyContent: "center" },
  dangerButtonText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
});
