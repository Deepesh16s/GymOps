import { useState } from "react";
import { View, ActivityIndicator, StyleSheet, Modal } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PermissionRationaleScreen } from "./src/screens/PermissionRationaleScreen";
import { colors } from "./src/theme/tokens";

function Root() {
  const { isLoading, isAuthenticated } = useAuth();
  const [rationale, setRationale] = useState<{ onContinue: () => void } | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <HomeScreen onRequestRationale={(onContinue) => setRationale({ onContinue })} />
      ) : (
        <LoginScreen />
      )}

      <Modal visible={!!rationale} animationType="slide" onRequestClose={() => setRationale(null)}>
        <PermissionRationaleScreen
          onContinue={() => {
            rationale?.onContinue();
            setRationale(null);
          }}
          onClose={() => setRationale(null)}
        />
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
