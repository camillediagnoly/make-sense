import type { ShortcutItem } from "../store/general/types";

type MakeSenseSettings = {
  shortcut_settings?: Record<string, string[]>;
};

export class BrowserSettingsStorage {
  public static readonly STORAGE_KEY = "make-sense-settings";

  public static loadKeyboardShortcuts(
    defaultShortcuts: ShortcutItem[]
  ): ShortcutItem[] {
    const settings = BrowserSettingsStorage.readSettings();
    const savedShortcuts = settings?.shortcut_settings;
    if (!savedShortcuts) {
      return defaultShortcuts;
    }

    return defaultShortcuts.map((shortcut) => {
      const keyCombo = savedShortcuts[shortcut.id];
      return BrowserSettingsStorage.isKeyCombo(keyCombo)
        ? { ...shortcut, keyCombo }
        : shortcut;
    });
  }

  public static saveKeyboardShortcuts(shortcuts: ShortcutItem[]): void {
    const shortcutSettings = shortcuts.reduce<Record<string, string[]>>(
      (result, shortcut) => {
        if (
          !BrowserSettingsStorage.areKeyCombosEqual(
            shortcut.keyCombo,
            shortcut.defaultKeyCombo
          )
        ) {
          result[shortcut.id] = shortcut.keyCombo;
        }
        return result;
      },
      {}
    );

    BrowserSettingsStorage.writeSettings({
      ...BrowserSettingsStorage.readSettings(),
      shortcut_settings: shortcutSettings,
    });
  }

  private static readSettings(): MakeSenseSettings | null {
    try {
      if (!BrowserSettingsStorage.isStorageAvailable()) {
        return null;
      }

      const value = window.localStorage.getItem(
        BrowserSettingsStorage.STORAGE_KEY
      );
      if (!value) {
        return null;
      }

      const parsed = JSON.parse(value);
      return BrowserSettingsStorage.isSettings(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private static writeSettings(settings: MakeSenseSettings): void {
    try {
      if (BrowserSettingsStorage.isStorageAvailable()) {
        window.localStorage.setItem(
          BrowserSettingsStorage.STORAGE_KEY,
          JSON.stringify(settings)
        );
      }
    } catch {
      // Browser storage can be disabled or full. Shortcuts still work for the current session.
    }
  }

  private static isStorageAvailable(): boolean {
    return typeof window !== "undefined" && !!window.localStorage;
  }

  private static isSettings(value: any): value is MakeSenseSettings {
    return !!value && typeof value === "object";
  }

  private static isKeyCombo(value: any): value is string[] {
    return (
      Array.isArray(value) && value.every((key) => typeof key === "string")
    );
  }

  private static areKeyCombosEqual(first: string[], second: string[]): boolean {
    return (
      first.length === second.length &&
      first.every((key, index) => key === second[index])
    );
  }
}
