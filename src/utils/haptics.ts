import { Platform, Vibration } from 'react-native';
import {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

// ── 类型重导出 ────────────────────────────────────────

export { ImpactFeedbackStyle, NotificationFeedbackType };
export type VibratePattern = number | number[];

const { Light, Medium, Heavy, Soft, Rigid } = ImpactFeedbackStyle;
const { Success, Warning, Error } = NotificationFeedbackType;

// ── 核心 API ──────────────────────────────────────────

/** 触感冲击（强度可控），iOS/Android 均支持 */
export function impact(intensity: ImpactFeedbackStyle = Light) {
  void impactAsync(intensity);
}

/** 触感通知（成功/警告/错误），iOS/Android 均支持 */
export function notification(type: NotificationFeedbackType = Success) {
  void notificationAsync(type);
}

/** 选择器反馈（picker/switch 等场景），iOS/Android 均支持 */
export function selection() {
  void selectionAsync();
}

/**
 * 定时震动（毫秒）或模式震动。
 * Android 支持单次时长震动；iOS 仅支持触感，忽略时长参数。
 */
export function vibrate(pattern: VibratePattern = 50) {
  if (Platform.OS === 'android') {
    Vibration.vibrate(pattern);
  } else {
    void impactAsync(Light);
  }
}

/** 停止震动（Android） */
export function vibrateCancel() {
  Vibration.cancel();
}

// ── 便捷预设 ──────────────────────────────────────────

/** 极轻反馈（按钮点击等） */
export const tap = () => impact(Light);

/** 中等反馈（确认操作等） */
export const confirm = () => impact(Medium);

/** 强调反馈（删除等破坏性操作） */
export const heavy = () => impact(Heavy);

/** 切换开关反馈 */
export const toggle = () => selection();

/** 短震 ~50ms */
export const short = () => vibrate(50);

/** 长震 ~300ms */
export const long = () => vibrate(300);
