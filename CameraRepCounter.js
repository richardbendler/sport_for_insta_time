import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useRunOnJS } from "react-native-worklets-core";
import { detectPose } from "vision-camera-pose-detector";

// Push-up rep detection: tracks the elbow angle (shoulder-elbow-wrist) and
// counts a rep whenever it cycles from "down" (arms bent) back to "up"
// (arms extended). Hysteresis between the two thresholds absorbs landmark
// jitter from frame to frame.
const UP_ANGLE_DEG = 155;
const DOWN_ANGLE_DEG = 95;
const MIN_CONFIDENCE = 0.5;

function angleAtPoint(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const magAB = Math.sqrt(abx * abx + aby * aby);
  const magCB = Math.sqrt(cbx * cbx + cby * cby);
  if (magAB === 0 || magCB === 0) {
    return null;
  }
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function pickArmAngle(landmarks) {
  if (!landmarks) {
    return null;
  }
  const rightOk =
    (landmarks.rightShoulder?.confidence ?? 0) >= MIN_CONFIDENCE &&
    (landmarks.rightElbow?.confidence ?? 0) >= MIN_CONFIDENCE &&
    (landmarks.rightWrist?.confidence ?? 0) >= MIN_CONFIDENCE;
  const leftOk =
    (landmarks.leftShoulder?.confidence ?? 0) >= MIN_CONFIDENCE &&
    (landmarks.leftElbow?.confidence ?? 0) >= MIN_CONFIDENCE &&
    (landmarks.leftWrist?.confidence ?? 0) >= MIN_CONFIDENCE;
  if (rightOk) {
    return angleAtPoint(
      landmarks.rightShoulder,
      landmarks.rightElbow,
      landmarks.rightWrist
    );
  }
  if (leftOk) {
    return angleAtPoint(
      landmarks.leftShoulder,
      landmarks.leftElbow,
      landmarks.leftWrist
    );
  }
  return null;
}

// The native camera-device list can still be populating (CameraX init runs
// asynchronously) right after permission is granted, especially on the
// first open after install. Give it a moment before showing a terminal
// "no camera found" error instead of flashing it immediately.
const DEVICE_WAIT_TIMEOUT_MS = 3000;

export default function CameraRepCounter({ visible, onClose, onRep, labels, colors }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const backDevice = useCameraDevice("back");
  const frontDevice = useCameraDevice("front");
  const device = backDevice || frontDevice;
  const [reps, setReps] = useState(0);
  const [angleDebug, setAngleDebug] = useState(null);
  const [deviceWaitElapsed, setDeviceWaitElapsed] = useState(false);
  const phaseRef = useRef("up");
  const repsRef = useRef(0);
  const styles = createStyles(colors);

  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  useEffect(() => {
    if (!visible || !hasPermission || device) {
      return;
    }
    setDeviceWaitElapsed(false);
    const timer = setTimeout(
      () => setDeviceWaitElapsed(true),
      DEVICE_WAIT_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [visible, hasPermission, device]);

  useEffect(() => {
    if (visible) {
      setReps(0);
      repsRef.current = 0;
      phaseRef.current = "up";
      setAngleDebug(null);
    }
  }, [visible]);

  const handleLandmarks = useCallback(
    (landmarks) => {
      const angle = pickArmAngle(landmarks);
      if (angle == null) {
        return;
      }
      setAngleDebug(Math.round(angle));
      if (phaseRef.current === "up" && angle < DOWN_ANGLE_DEG) {
        phaseRef.current = "down";
      } else if (phaseRef.current === "down" && angle > UP_ANGLE_DEG) {
        phaseRef.current = "up";
        repsRef.current += 1;
        setReps(repsRef.current);
        onRep?.();
      }
    },
    [onRep]
  );

  const onLandmarksJS = useRunOnJS(handleLandmarks, [handleLandmarks]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const landmarks = detectPose(frame);
      if (landmarks) {
        onLandmarksJS(landmarks);
      }
    },
    [onLandmarksJS]
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!hasPermission ? (
          <View style={styles.centerBox}>
            <Text style={styles.hint}>{labels.permissionHint}</Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>{labels.grantPermission}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>{labels.close}</Text>
            </Pressable>
          </View>
        ) : !device && !deviceWaitElapsed ? (
          <View style={styles.centerBox}>
            <Text style={styles.hint}>{labels.searchingDevice || labels.hint}</Text>
          </View>
        ) : !device ? (
          <View style={styles.centerBox}>
            <Text style={styles.hint}>{labels.noDevice}</Text>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>{labels.close}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={visible}
              frameProcessor={frameProcessor}
              pixelFormat="yuv"
            />
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.repBadge}>
                <Text style={styles.repValue}>{reps}</Text>
                <Text style={styles.repLabel}>{labels.reps}</Text>
              </View>
              {__DEV__ && angleDebug != null ? (
                <Text style={styles.debugAngle}>{angleDebug}°</Text>
              ) : null}
              <Text style={styles.hintOverlay}>{labels.hint}</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>{labels.done}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.ink,
    },
    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 16,
    },
    hint: {
      color: colors.text,
      textAlign: "center",
      fontSize: 15,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 48,
      paddingHorizontal: 20,
    },
    repBadge: {
      backgroundColor: colors.cardDark,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 32,
      alignItems: "center",
    },
    repValue: {
      color: colors.text,
      fontSize: 56,
      fontWeight: "800",
    },
    repLabel: {
      color: colors.muted,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    debugAngle: {
      color: colors.muted,
      fontSize: 13,
    },
    hintOverlay: {
      color: colors.text,
      textAlign: "center",
      backgroundColor: colors.cardDark,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 14,
      overflow: "hidden",
    },
    closeButton: {
      backgroundColor: colors.ember,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    closeButtonText: {
      color: colors.ink,
      fontWeight: "700",
      fontSize: 16,
    },
    primaryButton: {
      backgroundColor: colors.ember,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    primaryButtonText: {
      color: colors.ink,
      fontWeight: "700",
    },
    secondaryButton: {
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "600",
    },
  });
