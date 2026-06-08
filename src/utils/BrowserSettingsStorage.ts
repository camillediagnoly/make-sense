import type { ClassSanityCheckSettings, ShortcutItem } from "../store/general/types";
import { CLASS_SANITY_CHECK_COUNT_OPTIONS } from "./ClassSanityCheckUtil";

type MakeSenseSettings = {
  shortcut_settings?: Record<string, string[]>;
  class_sanity_check_settings?: ClassSanityCheckSettings;
};

const DEFAULT_CLASS_SANITY_CHECK_SETTINGS: ClassSanityCheckSettings = {
  enabled: true,
  simultaneous: false,
  rules: [],
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

  public static loadClassSanityCheckSettings(): ClassSanityCheckSettings {
    const settings = BrowserSettingsStorage.readSettings();
    const savedSettings = settings?.class_sanity_check_settings;

    if (!BrowserSettingsStorage.isClassSanityCheckSettings(savedSettings)) {
      return DEFAULT_CLASS_SANITY_CHECK_SETTINGS;
    }

    return {
      enabled: savedSettings.enabled,
      simultaneous: false,
      rules: BrowserSettingsStorage.normalizeClassSanityCheckRules(
        savedSettings.rules
      ),
    };
  }

  public static saveClassSanityCheckSettings(
    classSanityCheckSettings: ClassSanityCheckSettings
  ): void {
    BrowserSettingsStorage.writeSettings({
      ...BrowserSettingsStorage.readSettings(),
      class_sanity_check_settings: {
        enabled: classSanityCheckSettings.enabled,
        simultaneous: false,
        rules: BrowserSettingsStorage.normalizeClassSanityCheckRules(
          classSanityCheckSettings.rules
        ),
      },
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

  private static isClassSanityCheckSettings(
    value: any
  ): value is ClassSanityCheckSettings {
    return (
      !!value &&
      typeof value === "object" &&
      typeof value.enabled === "boolean" &&
      typeof value.simultaneous === "boolean" &&
      Array.isArray(value.rules)
    );
  }

  private static normalizeClassSanityCheckRules(
    value: any
  ): ClassSanityCheckSettings["rules"] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(
        (rule) =>
          !!rule &&
          typeof rule === "object" &&
          typeof rule.labelName === "string" &&
          Array.isArray(rule.allowedCounts)
      )
      .map((rule) => {
        const allowedCounts = rule.allowedCounts.filter(
          (count: any): count is number =>
            CLASS_SANITY_CHECK_COUNT_OPTIONS.includes(count)
        );

        return {
          labelName: rule.labelName,
          allowedCounts: Array.from(new Set<number>(allowedCounts)).sort(
            (first, second) => first - second
          ),
        };
      })
      .filter((rule) => rule.allowedCounts.length > 0);
  }

  private static areKeyCombosEqual(first: string[], second: string[]): boolean {
    return (
      first.length === second.length &&
      first.every((key, index) => key === second[index])
    );
  }
}
