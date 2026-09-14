// The leaderboard's DOM: the board panel and the name prompt that appears on a
// new personal best. Kept out of game.ts, which only tells it when a record
// falls and which circuit is active.
//
// Every value that came from the database is written with textContent or
// through a form control's value, never as markup — the schema's charset assert
// already makes a name harmless, and this keeps it that way regardless.

import { formatLapTime } from "./format";
import {
  BOARD_LIMIT,
  isConfigured,
  listScores,
  loadGhost,
  MAX_NAME_LENGTH,
  submitScore,
  validateName,
  type ScoreRow,
} from "./leaderboard";
import { getItem, storeItem } from "./storage";

const NAME_STORAGE_KEY = "player-name";

type PanelOptions = {
  // Hands the game a decoded ghost to race against, or null to go back to the
  // player's own recording.
  onGhost: (ghost: Array<IGhost> | null, label: string | null) => void;
  fixedStep: number;
};

export default class LeaderboardPanel {
  private $panel: HTMLElement | null;

  private $list: HTMLOListElement | null;

  private $status: HTMLElement | null;

  private $ghostLabel: HTMLElement | null;

  private $ownGhost: HTMLButtonElement | null;

  private $entry: HTMLFormElement | null;

  private $entryTime: HTMLElement | null;

  private $input: HTMLInputElement | null;

  private $error: HTMLElement | null;

  private options: PanelOptions;

  private circuit: string | null = null;

  // The run awaiting a name. Held here rather than in the game because the
  // game's tempGhost is cleared the instant the lap closes.
  private pending: { circuit: string; lapMs: number; ghost: Array<IGhost> } | null = null;

  // Guards against a slow list request for circuit A landing after the player
  // has already switched to circuit B.
  private requestToken = 0;

  constructor(el: ShadowRoot, options: PanelOptions) {
    this.options = options;
    this.$panel = el.querySelector("#leaderboard");
    this.$list = el.querySelector("#board-list");
    this.$status = el.querySelector("#board-status");
    this.$ghostLabel = el.querySelector("#ghost-label");
    this.$ownGhost = el.querySelector("#ghost-own");
    this.$entry = el.querySelector("#name-entry");
    this.$entryTime = el.querySelector("#name-entry-time");
    this.$input = el.querySelector("#name-input");
    this.$error = el.querySelector("#name-error");

    // With no database configured there is nothing to show, so the panel stays
    // out of the HUD entirely instead of sitting there failing.
    if (!isConfigured()) return;
    if (this.$panel) this.$panel.hidden = false;
    if (this.$input) this.$input.maxLength = MAX_NAME_LENGTH;

    this.$entry?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });
    el.querySelector("#name-skip")?.addEventListener("click", () => this.closeEntry());
    el.querySelector("#board-refresh")?.addEventListener("click", () => {
      if (this.circuit) void this.refresh(this.circuit);
    });
    this.$ownGhost?.addEventListener("click", () => this.useOwnGhost());
    this.$input?.addEventListener("input", () => this.setError(""));
  }

  private setStatus(text: string) {
    if (this.$status) this.$status.textContent = text;
  }

  private setError(text: string) {
    if (this.$error) this.$error.textContent = text;
  }

  async refresh(circuit: string) {
    this.circuit = circuit;
    if (!isConfigured() || !this.$list) return;

    this.requestToken += 1;
    const token = this.requestToken;
    this.setStatus("Loading…");

    let rows: Array<ScoreRow>;
    try {
      rows = await listScores(circuit);
    } catch (error) {
      console.warn("[leaderboard] list failed", error);
      if (token === this.requestToken) this.setStatus("Leaderboard unavailable");
      return;
    }
    if (token !== this.requestToken) return;

    this.$list.replaceChildren();
    if (rows.length === 0) {
      this.setStatus("No times yet — set one!");
      return;
    }
    this.setStatus(rows.length >= BOARD_LIMIT ? `Top ${BOARD_LIMIT}` : "");
    rows.forEach((row) => this.$list?.appendChild(this.buildRow(row)));
  }

  private buildRow(row: ScoreRow) {
    const item = document.createElement("li");

    const name = document.createElement("span");
    name.className = "board-name";
    name.textContent = row.name;

    const time = document.createElement("span");
    time.className = "board-time";
    time.textContent = formatLapTime(row.lapMs);

    const race = document.createElement("button");
    race.type = "button";
    race.className = "board-race";
    race.textContent = "ghost";
    race.title = `Race ${row.name}'s ghost`;
    race.addEventListener("click", () => void this.raceGhost(row, race));

    item.append(name, time, race);
    return item;
  }

  private async raceGhost(row: ScoreRow, button: HTMLButtonElement) {
    button.disabled = true;
    try {
      const ghost = await loadGhost(row.id, this.options.fixedStep);
      if (ghost.length === 0) {
        this.setStatus("That ghost could not be loaded");
        return;
      }
      this.options.onGhost(ghost, row.name);
      this.setGhostLabel(`Racing ${row.name} · ${formatLapTime(row.lapMs)}`);
    } finally {
      button.disabled = false;
    }
  }

  private useOwnGhost() {
    this.options.onGhost(null, null);
    this.setGhostLabel(null);
  }

  setGhostLabel(text: string | null) {
    if (this.$ghostLabel) this.$ghostLabel.textContent = text ?? "";
    if (this.$ownGhost) this.$ownGhost.hidden = text === null;
  }

  // Called by the game when a lap beats the player's stored best.
  onNewRecord(circuit: string, lapMs: number, ghost: Array<IGhost>) {
    if (!isConfigured() || !this.$entry) return;
    this.pending = { circuit, lapMs, ghost };
    if (this.$entryTime) this.$entryTime.textContent = formatLapTime(lapMs);
    if (this.$input) this.$input.value = getItem<string>(NAME_STORAGE_KEY) ?? "";
    this.setError("");
    this.$entry.hidden = false;
    this.$input?.focus();
    this.$input?.select();
  }

  private closeEntry() {
    this.pending = null;
    if (this.$entry) this.$entry.hidden = true;
    this.$input?.blur();
  }

  private async submit() {
    const pending = this.pending;
    const name = this.$input?.value ?? "";
    if (!pending) return;

    const nameError = validateName(name);
    if (nameError) {
      this.setError(nameError);
      return;
    }

    const submitButton = this.$entry?.querySelector("button[type=submit]") as
      | HTMLButtonElement
      | null;
    if (submitButton) submitButton.disabled = true;
    this.setError("Saving…");

    const result = await submitScore({
      circuit: pending.circuit,
      name,
      lapMs: pending.lapMs,
      ghost: pending.ghost,
    });

    if (submitButton) submitButton.disabled = false;
    if (!result.ok) {
      this.setError(result.error);
      return;
    }

    storeItem(NAME_STORAGE_KEY, name.trim());
    this.closeEntry();
    // Only refresh if the player is still on the circuit they just set a time on.
    if (this.circuit === pending.circuit) void this.refresh(pending.circuit);
  }
}
