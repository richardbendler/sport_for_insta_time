import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import iosScreenTime, { AppSelectionSheet } from "./index";

const AUTH_APPROVED = 2;
const AUTH_DENIED = 1;

const readStatus = () => ({
  authorization: iosScreenTime.getAuthorizationStatus(),
  selection: iosScreenTime.getSelectionSummary(),
  blocked: iosScreenTime.isBlocked(),
});

// Settings panel for the iOS Screen Time block: authorization, app picker
// and the current shield state.
const IosScreenTimePanel = ({ t, colors, remainingSeconds, onChanged }) => {
  const [status, setStatus] = useState(readStatus);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    await iosScreenTime.syncNow();
    setStatus(readStatus());
    onChanged?.();
  }, [onChanged]);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const authorize = async () => {
    setBusy(true);
    setError(null);
    try {
      await iosScreenTime.requestAuthorization();
    } catch (requestError) {
      setError(t("label.iosScreenTimeAuthError"));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const closePicker = async () => {
    setPickerVisible(false);
    await refresh();
  };

  const styles = createStyles(colors);
  const approved = status.authorization === AUTH_APPROVED;
  const selection = status.selection;
  const hasSelection = selection.total > 0;
  const minutes = Math.floor(Math.max(0, remainingSeconds || 0) / 60);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("label.iosScreenTimeTitle")}</Text>
      <Text style={styles.text}>{t("label.iosScreenTimeIntro")}</Text>
      {!approved ? (
        <>
          <Text style={styles.warning}>
            {status.authorization === AUTH_DENIED
              ? t("label.iosScreenTimeAuthDenied")
              : t("label.iosScreenTimeAuthMissing")}
          </Text>
          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={authorize}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.buttonText}>
                {t("label.iosScreenTimeAuthorize")}
              </Text>
            )}
          </Pressable>
          {status.authorization === AUTH_DENIED ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.linkText}>{t("label.iosScreenTimeOpen")}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {hasSelection
              ? t("label.iosScreenTimeSelection", {
                  apps: selection.applicationCount,
                  categories: selection.categoryCount,
                  domains: selection.webDomainCount,
                })
              : t("label.iosScreenTimeNoApps")}
          </Text>
          {hasSelection ? (
            <Text style={[styles.status, status.blocked ? styles.statusBlocked : styles.statusOpen]}>
              {status.blocked
                ? t("label.iosScreenTimeBlocked")
                : t("label.iosScreenTimeUnlocked", { minutes })}
            </Text>
          ) : null}
          <Pressable style={styles.button} onPress={() => setPickerVisible(true)}>
            <Text style={styles.buttonText}>
              {hasSelection
                ? t("label.iosScreenTimeChangeApps")
                : t("label.iosScreenTimeSelectApps")}
            </Text>
          </Pressable>
        </>
      )}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {pickerVisible && AppSelectionSheet ? (
        <AppSelectionSheet
          style={styles.sheetAnchor}
          familyActivitySelectionId={iosScreenTime.SELECTION_ID}
          headerText={t("label.iosScreenTimePickerHeader")}
          footerText={t("label.iosScreenTimePickerFooter")}
          onDismissRequest={closePicker}
        />
      ) : null}
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
      gap: 10,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    text: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    warning: {
      color: colors.accent,
      fontSize: 14,
      lineHeight: 20,
    },
    status: {
      fontSize: 14,
      fontWeight: "600",
    },
    statusBlocked: {
      color: colors.ember,
    },
    statusOpen: {
      color: colors.olive,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.ink,
      fontWeight: "700",
      fontSize: 15,
    },
    linkButton: {
      alignSelf: "flex-start",
    },
    linkText: {
      color: colors.accent,
      fontSize: 14,
      textDecorationLine: "underline",
    },
    sheetAnchor: {
      width: 1,
      height: 1,
      position: "absolute",
    },
  });

export default IosScreenTimePanel;
