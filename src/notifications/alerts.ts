import { exec } from 'child_process';
import os from 'os';

// Cooldown tracker: maps key (e.g. 'provider-id') to timestamp of last alert
const alertCooldowns: Record<string, number> = {};
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Triggers a native desktop notification on macOS, with fallbacks.
 */
export function triggerSystemNotification(
  title: string,
  message: string,
  subtitle?: string,
  cooldownKey?: string
): void {
  const now = Date.now();

  // Handle Cooldown
  if (cooldownKey) {
    const lastAlert = alertCooldowns[cooldownKey];
    if (lastAlert && now - lastAlert < COOLDOWN_MS) {
      console.log(`[Notification] Cooldown active for key "${cooldownKey}". Alert suppressed.`);
      return;
    }
    alertCooldowns[cooldownKey] = now;
  }

  const platform = os.platform();
  console.log(`[Notification] [${title}] ${subtitle ? subtitle + ': ' : ''}${message}`);

  if (platform === 'darwin') {
    // Escape single quotes for AppleScript
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedMessage = message.replace(/'/g, "\\'");
    const escapedSubtitle = subtitle ? subtitle.replace(/'/g, "\\'") : '';

    const script = escapedSubtitle
      ? `display notification "${escapedMessage}" with title "${escapedTitle}" subtitle "${escapedSubtitle}"`
      : `display notification "${escapedMessage}" with title "${escapedTitle}"`;

    exec(`osascript -e '${script}'`, (err) => {
      if (err) {
        console.error('Failed to trigger macOS notification via osascript:', err);
      }
    });
  } else {
    // If not macOS, we could log it or support notify-send (Linux)
    if (platform === 'linux') {
      const escapedTitle = title.replace(/"/g, '\\"');
      const escapedMessage = message.replace(/"/g, '\\"');
      exec(`notify-send "${escapedTitle}" "${escapedMessage}"`, (err) => {
        if (err) console.error('Failed to trigger Linux notification:', err);
      });
    }
  }
}
