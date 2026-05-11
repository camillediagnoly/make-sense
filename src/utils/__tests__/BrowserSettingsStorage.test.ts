import { ShortcutItem } from "../../store/general/types";
import { BrowserSettingsStorage } from "../BrowserSettingsStorage";

const defaultShortcuts: ShortcutItem[] = [
  {
    id: "next-image",
    name: "Next Image",
    keyCombo: ["d"],
    defaultKeyCombo: ["d"],
  },
  {
    id: "previous-image",
    name: "Previous Image",
    keyCombo: ["a"],
    defaultKeyCombo: ["a"],
  },
];

describe("BrowserSettingsStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("should load saved shortcut customizations from make-sense-settings", () => {
    window.localStorage.setItem(
      BrowserSettingsStorage.STORAGE_KEY,
      JSON.stringify({
        shortcut_settings: {
          "next-image": ["ArrowRight"],
        },
      })
    );

    expect(
      BrowserSettingsStorage.loadKeyboardShortcuts(defaultShortcuts)
    ).toEqual([
      {
        ...defaultShortcuts[0],
        keyCombo: ["ArrowRight"],
      },
      defaultShortcuts[1],
    ]);
  });

  it("should save only shortcuts customized away from their defaults", () => {
    BrowserSettingsStorage.saveKeyboardShortcuts([
      {
        ...defaultShortcuts[0],
        keyCombo: ["ArrowRight"],
      },
      defaultShortcuts[1],
    ]);

    expect(
      JSON.parse(
        window.localStorage.getItem(BrowserSettingsStorage.STORAGE_KEY)
      )
    ).toEqual({
      shortcut_settings: {
        "next-image": ["ArrowRight"],
      },
    });
  });

  it("should ignore invalid stored shortcut data", () => {
    window.localStorage.setItem(
      BrowserSettingsStorage.STORAGE_KEY,
      JSON.stringify({
        shortcut_settings: {
          "next-image": "ArrowRight",
        },
      })
    );

    expect(
      BrowserSettingsStorage.loadKeyboardShortcuts(defaultShortcuts)
    ).toEqual(defaultShortcuts);
  });
});
