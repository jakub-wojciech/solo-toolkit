import { Plugin, WorkspaceLeaf } from "obsidian";
import { registerIcons, unregisterIcons } from "./icons";
import {
  SoloToolkitSettingTab,
  SoloToolkitSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import { SoloToolkitView, VIEW_TYPE } from "./view";
import { soloToolkitExtension } from "./inline/live";
import { soloToolkitPostprocessor } from "./inline/read";
import { backwardCompatibleFixes } from "./utils/backwardfixes";
import { DICE_REGEX_G, DiceWidgetBase } from "./inline/base/dice";

export default class SoloToolkitPlugin extends Plugin {
  settings: SoloToolkitSettings;

  async onload() {
    await this.loadSettings();

    registerIcons();
    backwardCompatibleFixes(this.app.vault);

    this.registerView(
      VIEW_TYPE,
      (leaf) =>
        new SoloToolkitView(leaf, this.settings, this.saveSetting.bind(this))
    );

    this.registerMarkdownPostProcessor(soloToolkitPostprocessor(this));
    this.registerEditorExtension(soloToolkitExtension(this));

    this.addRibbonIcon("srt-ribbon", "Solo RPG Toolkit", () => this.openView());

    this.addCommand({
      id: "open-toolkit",
      name: "Open toolkit",
      callback: () => this.openView(),
    });

    this.addCommand({
      id: "roll-dice-at-cursor",
      name: "Roll dice at cursor",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);

        const matches = [...lineText.matchAll(DICE_REGEX_G)];
        
        // Find matches before cursor, reverse them (closest first), take max 10, find first unlocked
        const targetMatch = matches
          .filter(
            (m) => m.index !== undefined && m.index + m[0].length <= cursor.ch
          )
          .reverse()
          .slice(0, 10)
          .find((m) => !m[0].includes("!"));

        if (targetMatch && targetMatch.index !== undefined) {
          const originalText = targetMatch[0];

          const dice = new DiceWidgetBase({ originalText });
          dice.roll();
          dice.disabled = true;
          const newText = dice.getText("`");

          editor.replaceRange(
            newText,
            { line: cursor.line, ch: targetMatch.index },
            { line: cursor.line, ch: targetMatch.index + originalText.length }
          );
        }
      },
    });

    this.addSettingTab(new SoloToolkitSettingTab(this.app, this));
  }

  onunload() {
    unregisterIcons();
  }

  async openView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSetting(setting: Partial<SoloToolkitSettings>) {
    Object.assign(this.settings, setting);
    return this.saveSettings();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
