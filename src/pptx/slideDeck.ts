import type {
  SlideDeck, SlideContent, IllustrationIcon, FontPairKey, SlideTone, ChartSeries, TableCell, DeckMetaItem,
  CanvasElement, FillRole, TextRole, FontRole, CanvasTextSize, PresenterInfo,
  StatItem, CoverPillar, TierItem, TimelineStep, InsightBanner, ComparisonColumn,
  RecapExample, GlossaryTerm, RoadmapStep,
  MatrixCell, FlowchartNode, CalendarEvent, GalleryItem, QuoteItem, AdvancedTableCell,
} from "./presentationBuilder.js";
import { getLayout } from "./layoutRegistry.js";

const ILLUSTRATION_ICONS: readonly IllustrationIcon[] = [
  "idea", "growth", "team", "target", "rocket", "chart", "book", "checklist", "globe", "gear",
  "calendar", "shield", "money", "clock", "warning", "celebration", "star", "heart",
  "thumbs_up", "thumbs_down", "eye", "email", "phone", "location", "map", "home", "building",
  "factory", "shopping", "cart", "credit_card", "wallet", "bank", "stock", "trending_down",
  "pulse", "activity", "network", "cloud", "server", "database", "code", "terminal", "bug",
  "security", "lock", "unlock", "key", "user", "users", "person", "people", "child", "family",
  "handshake", "award", "trophy", "medal", "flag", "bookmark", "tag", "label", "price",
  "discount", "percent", "calculator", "graph", "analytics", "insights", "report", "document",
  "file", "folder", "archive", "download", "upload", "share", "link", "connect", "sync",
  "refresh", "loop", "replay", "undo", "redo", "edit", "delete", "trash", "filter", "search",
  "sort", "list", "grid", "menu", "settings", "tune", "dashboard", "widgets", "apps",
  "extension", "plugin", "api", "integration", "automation", "robot", "smart_toy",
  "psychology", "lightbulb", "auto_awesome", "bolt", "flash_on", "power", "battery", "wifi",
  "signal", "bluetooth", "usb", "print", "camera", "image", "video", "audio", "mic",
  "speaker", "headphones", "volume", "mute", "play", "pause", "stop", "skip_next",
  "skip_previous", "fast_forward", "rewind", "shuffle", "repeat", "playlist", "library",
  "favorite", "like", "dislike", "comment", "chat", "message", "notification", "alarm",
  "timer", "hourglass", "snooze", "watch", "access_time", "event", "today", "date_range",
  "schedule", "calendar_month", "update", "new_releases", "whatshot", "local_fire_department",
  "water_drop", "air", "terrain", "landscape", "nature", "eco", "recycling", "energy",
  "electric_bolt", "solar", "battery_charging", "ev_station", "gas", "oil", "mining",
  "agriculture", "grass", "forest", "spa", "healing", "medical", "health", "hospital",
  "pharmacy", "science", "biotech", "genetics", "atom", "chemistry", "physics", "math",
  "calculate", "functions", "data", "storage", "backup", "cloud_upload", "cloud_download",
  "sync_alt", "swap", "compare", "compare_arrows", "open_in", "open_out", "exit_to_app",
  "login", "logout", "how_to_reg", "app_registration", "admin_panel", "manage_accounts",
  "supervisor_account", "support_agent", "contact", "help", "info", "error", "check_circle",
  "cancel", "priority_high", "low_priority", "layers", "view", "visibility", "visibility_off",
  "zoom_in", "zoom_out", "fullscreen", "aspect_ratio", "fit_screen", "expand", "minimize",
  "close", "arrow_forward", "arrow_back", "arrow_up", "arrow_down", "arrow_left",
  "arrow_right", "open_in_new", "external_link", "language", "translate", "public",
  "verified", "workspace_premium", "diamond", "stars", "auto_awesome_mosaic", "gradient",
  "palette", "color", "brush", "format", "text", "title", "heading", "paragraph", "list_alt",
  "check_box", "radio_button", "toggle_on", "toggle_off", "switch", "slider", "dial", "knob",
  "progress", "spinner", "loading", "hourglass_empty", "hourglass_top", "sandglass",
  "history", "history_edu", "update_history", "time", "stopwatch", "speed", "speedometer",
  "tachometer", "alt_route", "route", "navigation", "explore", "place", "pin_drop",
  "location_on", "location_city", "location_searching", "my_location", "directions",
  "directions_car", "directions_bike", "directions_walk", "directions_transit", "flight",
  "train", "bus", "car", "taxi", "ship", "sailing", "surfing", "pool", "hot_tub",
  "beach_access", "water", "waves", "tide", "tsunami", "hurricane", "storm", "thunderstorm",
  "cloud_queue", "wb_cloudy", "wb_sunny", "wb_twilight", "nights_stay", "bedtime", "sleep",
  "hotel", "home_work", "business", "office", "corporate", "company", "work", "engineering",
  "construction", "handyman", "build", "architecture", "domain", "dns", "router",
  "settings_ethernet", "cable", "phonelink", "phonelink_setup", "forward", "reply",
  "reply_all", "send", "unarchive", "drafts", "inbox", "outbox", "send_time", "schedule_send",
  "access_alarm", "alarm_on", "alarm_off", "notifications", "notifications_active",
  "add_circle", "add", "remove_circle", "remove", "clear", "check", "done", "done_all",
  "done_outline", "select_all", "deselect", "content_copy", "content_cut", "content_paste",
  "content_paste_off", "filter_list", "filter_none", "filter_alt", "sort_by_alpha",
  "sort_by_numeric", "sort_by_date", "sort_by_size", "swap_vert", "swap_horiz",
  "sync_disabled", "sync_problem", "cached", "autorenew", "repeat_one", "play_arrow",
  "pause_circle", "stop_circle", "fast_rewind", "replay_circle", "volume_up", "volume_down",
  "volume_mute", "volume_off", "mic_off", "videocam", "videocam_off", "photo_camera", "photo",
  "movie", "movie_filter", "theaters", "album", "collections", "collections_bookmark",
  "featured_play_list", "subscriptions", "watch_later", "group", "group_add", "group_remove",
  "person_add", "person_remove", "person_search", "people_outline", "settings_applications",
  "settings_backup_restore", "settings_bluetooth", "settings_brightness", "settings_cell",
  "settings_input_antenna", "settings_input_component", "settings_input_composite",
  "settings_input_hdmi", "settings_input_svideo", "settings_overscan", "settings_phone",
  "settings_power", "settings_remote", "settings_suggest", "settings_system_daydream",
  "settings_voice", "accessibility", "accessibility_new", "accessible", "accessible_forward",
  "deaf", "hearing", "low_vision", "high_quality", "hdr_on", "hdr_off", "filter_tilt_shift",
  "filter_vintage", "wb_auto", "wb_incandescent", "wb_iridescent",
];

const FONT_PAIR_KEYS: readonly FontPairKey[] = ["modern", "classic", "bold"];

function normalizeIcon(raw: unknown): IllustrationIcon | undefined {
  return typeof raw === "string" && (ILLUSTRATION_ICONS as readonly string[]).includes(raw) ? (raw as IllustrationIcon) : undefined;
}

function normalizeFontPair(raw: unknown): FontPairKey | undefined {
  return typeof raw === "string" && (FONT_PAIR_KEYS as readonly string[]).includes(raw) ? (raw as FontPairKey) : undefined;
}

// Font names go straight into the .pptx, so only plain font-name characters
// are allowed, and both must be given.
const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
function normalizeFonts(raw: unknown): { heading: string; body: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const f = raw as Record<string, unknown>;
  const heading = typeof f.heading === "string" ? f.heading.trim() : "";
  const body = typeof f.body === "string" ? f.body.trim() : "";
  return FONT_NAME_RE.test(heading) && FONT_NAME_RE.test(body) ? { heading, body } : undefined;
}

function normalizeNotes(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function normalizeTone(raw: unknown): SlideTone | undefined {
  return raw === "contrast" ? "contrast" : undefined;
}

// Accepts one presenter entry from either the current shape ({name, role,
// ...} inside a "presenters" array) or, per-entry, the same fields — used
// both for the new array and for wrapping the old flat single-person shape
// (see normalizeSlide's "presenter" branch) into a one-element array.
// Invalid entries are dropped individually, not the whole slide — same
// fail-open pattern as normalizeTeamMember.
function normalizePresenterInfo(raw: unknown): PresenterInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== "string" || !p.name.trim()) return null;
  return {
    name: p.name.trim(),
    role: typeof p.role === "string" ? p.role : undefined,
    company: typeof p.company === "string" ? p.company : undefined,
    bio: typeof p.bio === "string" ? p.bio : undefined,
    contact: Array.isArray(p.contact) ? stringArray(p.contact) : undefined,
  };
}

// `import type` only — this file must stay pptxgenjs/pdf-lib-free since it
// runs in the browser (a chat interface may parse every model reply with it).

export interface ExtractedSlideDeck {
  // Message content with the ```slides fence removed, for the normal
  // markdown render — the raw JSON is never shown to the user.
  displayContent: string;
  deck: SlideDeck | null;
  // True when the ```slides fence was never closed — a reliable signal that
  // the package's token budget cut the model off mid-deck and repairSlidesJson
  // had to drop an incomplete tail slide (see below). Only meaningful when
  // `deck` is non-null; a chat interface can use this to tell the user their deck was
  // shortened instead of silently handing them fewer slides than they asked
  // for with no explanation.
  truncated: boolean;
}

const OPEN_FENCE = "```slides";
const CLOSED_FENCE_RE = /```slides\s*([\s\S]*?)```/;

export function extractSlideDeck(content: string): ExtractedSlideDeck {
  const closed = content.match(CLOSED_FENCE_RE);
  if (closed && closed.index !== undefined) {
    const displayContent = (content.slice(0, closed.index) + content.slice(closed.index + closed[0].length)).trim();
    return { displayContent, deck: parseDeckJson(closed[1].trim()), truncated: false };
  }

  // No closing fence at all — the reply was very likely cut off mid-object
  // by the package's token budget before the model could close it. Still
  // attempt the repair pass on whatever partial JSON exists, rather than
  // treating "unclosed fence" as "no deck" and losing the reply entirely.
  const openIdx = content.indexOf(OPEN_FENCE);
  if (openIdx === -1) return { displayContent: content, deck: null, truncated: false };
  const raw = content.slice(openIdx + OPEN_FENCE.length).trim();
  const displayContent = content.slice(0, openIdx).trim();
  const deck = parseDeckJson(raw);
  return { displayContent, deck, truncated: deck !== null };
}

function parseDeckJson(raw: string): SlideDeck | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const repaired = repairSlidesJson(raw);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
      } catch {
        parsed = null;
      }
    }
  }
  return normalizeDeck(parsed);
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((b): b is string => typeof b === "string") : [];
}

// "comparison"'s column: EITHER a numbered `steps` sequence (for two
// parallel workflows/processes) OR a plain `bullets` list — steps wins if
// both are given, matching this file's general "ambiguity resolved by
// silent precedence" convention (e.g. TableCell.highlight + status both
// render; bar-stacked prefers series over values). Reuses the existing
// normalizeTimelineStep helper — same {label, detail?} shape as "timeline".
function normalizeColumn(raw: unknown): ComparisonColumn | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.heading !== "string" || !c.heading) return null;
  const steps = Array.isArray(c.steps)
    ? c.steps.map(normalizeTimelineStep).filter((st): st is TimelineStep => st !== null)
    : [];
  if (steps.length > 0) return { heading: c.heading, steps };
  const bullets = Array.isArray(c.bullets) ? stringArray(c.bullets) : [];
  if (bullets.length === 0) return null;
  return { heading: c.heading, bullets };
}

// Like normalizeColumn, but for "columns" (a plain two-list layout, not a
// contrasting comparison) — heading is optional there.
function normalizeColumnBlock(raw: unknown): { heading?: string; bullets: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (!Array.isArray(c.bullets)) return null;
  const bullets = stringArray(c.bullets);
  if (bullets.length === 0) return null;
  return { heading: typeof c.heading === "string" ? c.heading : undefined, bullets };
}

const CHART_TYPES = ["bar", "line", "pie", "doughnut", "bar-stacked", "scatter", "radar", "area"] as const;

function normalizeTableCell(raw: unknown): string | TableCell {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const c = raw as Record<string, unknown>;
    if (typeof c.text === "string" && c.text) {
      return {
        text: c.text,
        status: c.status === "yes" || c.status === "no" || c.status === "warning" ? c.status : undefined,
        highlight: c.highlight === true,
      };
    }
  }
  return "";
}

function normalizeTableRow(raw: unknown): (string | TableCell)[] {
  return Array.isArray(raw) ? raw.map(normalizeTableCell) : [];
}

function normalizeProcessStep(raw: unknown): { title: string; description?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const st = raw as Record<string, unknown>;
  if (typeof st.title !== "string" || !st.title) return null;
  return { title: st.title, description: typeof st.description === "string" ? st.description : undefined };
}

function normalizeRecommendationOption(raw: unknown): {
  heading: string; items?: string[]; outcomeLabel?: string; outcome: string; outcomeDetail?: string; rationale?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.heading !== "string" || !o.heading || typeof o.outcome !== "string" || !o.outcome) return null;
  return {
    heading: o.heading,
    items: Array.isArray(o.items) ? stringArray(o.items) : undefined,
    outcomeLabel: typeof o.outcomeLabel === "string" ? o.outcomeLabel : undefined,
    outcome: o.outcome,
    outcomeDetail: typeof o.outcomeDetail === "string" ? o.outcomeDetail : undefined,
    rationale: typeof o.rationale === "string" ? o.rationale : undefined,
  };
}

function normalizeMetaItem(raw: unknown): DeckMetaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.label !== "string" || !m.label || typeof m.value !== "string" || !m.value) return null;
  return { label: m.label, value: m.value };
}

function normalizeGridItem(raw: unknown): { title: string; description?: string; icon?: IllustrationIcon } | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  if (typeof i.title !== "string" || !i.title) return null;
  return { title: i.title, description: typeof i.description === "string" ? i.description : undefined, icon: normalizeIcon(i.icon) };
}

function normalizeTimelineStep(raw: unknown): { label: string; detail?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.label !== "string" || !s.label) return null;
  return { label: s.label, detail: typeof s.detail === "string" ? s.detail : undefined };
}

function normalizeChartSeries(raw: unknown): ChartSeries | null {
  if (!raw || typeof raw !== "object") return null;
  const sr = raw as Record<string, unknown>;
  if (typeof sr.name !== "string" || !sr.name || !Array.isArray(sr.values)) return null;
  const values = sr.values.filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return { name: sr.name, values };
}

function normalizeTeamMember(raw: unknown): { name: string; role?: string; description?: string; icon?: IllustrationIcon } | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.name !== "string" || !m.name) return null;
  return {
    name: m.name,
    role: typeof m.role === "string" ? m.role : undefined,
    description: typeof m.description === "string" ? m.description : undefined,
    icon: normalizeIcon(m.icon),
  };
}

function normalizeIconListItem(raw: unknown): { text: string; icon?: IllustrationIcon } | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  if (typeof i.text !== "string" || !i.text) return null;
  return { text: i.text, icon: normalizeIcon(i.icon) };
}

function normalizeFunnelStage(raw: unknown): { label: string; value?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const st = raw as Record<string, unknown>;
  if (typeof st.label !== "string" || !st.label) return null;
  return { label: st.label, value: typeof st.value === "string" ? st.value : undefined };
}

function normalizeStatItem(raw: unknown): StatItem | null {
  if (!raw || typeof raw !== "object") return null;
  const st = raw as Record<string, unknown>;
  if (typeof st.value !== "string" || !st.value || typeof st.label !== "string" || !st.label) return null;
  return { value: st.value, label: st.label };
}

function normalizeCoverPillar(raw: unknown): CoverPillar | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.label !== "string" || !p.label) return null;
  return { label: p.label, description: typeof p.description === "string" ? p.description : undefined };
}

function normalizeTierItem(raw: unknown): TierItem | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.label !== "string" || !t.label) return null;
  return { label: t.label, description: typeof t.description === "string" ? t.description : undefined };
}

function normalizeRecapExample(raw: unknown): RecapExample | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.text !== "string" || !e.text) return null;
  return {
    heading: typeof e.heading === "string" ? e.heading : undefined,
    text: e.text,
    icon: normalizeIcon(e.icon),
  };
}

function normalizeGlossaryTerm(raw: unknown): GlossaryTerm | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.term !== "string" || !t.term || typeof t.definition !== "string" || !t.definition) return null;
  return { term: t.term, definition: t.definition };
}

function normalizeRoadmapStep(raw: unknown): RoadmapStep | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.label !== "string" || !s.label) return null;
  return { label: s.label, description: typeof s.description === "string" ? s.description : undefined };
}

// Used by "stats_row"/"grid"/"table"'s optional `insights` field — never
// sliced to the render-time cap of 2 here, matching this file's convention
// that array caps live in presentationBuilder.ts, not slideDeck.ts.
function normalizeInsightBanner(raw: unknown): InsightBanner | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.text !== "string" || !b.text) return null;
  return { lead: typeof b.lead === "string" ? b.lead : undefined, text: b.text };
}

function normalizeInsights(raw: unknown): InsightBanner[] | undefined {
  const insights = Array.isArray(raw) ? raw.map(normalizeInsightBanner).filter((b): b is InsightBanner => b !== null) : [];
  return insights.length > 0 ? insights : undefined;
}

function normalizeMatrixCell(raw: unknown): MatrixCell | null {
  if (typeof raw === "string") return raw ? { content: raw } : null;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.content !== "string" || !c.content) return null;
  return { content: c.content, highlight: c.highlight === true, icon: normalizeIcon(c.icon) };
}

function normalizeMatrixRow(raw: unknown): MatrixCell[] {
  return Array.isArray(raw) ? raw.map(normalizeMatrixCell).filter((c): c is MatrixCell => c !== null) : [];
}

const FLOWCHART_NODE_TYPES = ["start", "process", "decision", "end"] as const;

function normalizeFlowchartNode(raw: unknown): FlowchartNode | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== "string" || !n.id || typeof n.text !== "string" || !n.text) return null;
  const type = enumOr(n.type, FLOWCHART_NODE_TYPES);
  if (!type) return null;
  if (!n.position || typeof n.position !== "object") return null;
  const pos = n.position as Record<string, unknown>;
  if (typeof pos.x !== "number" || typeof pos.y !== "number" || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
  return {
    id: n.id,
    text: n.text,
    type,
    // x is an absolute inch position on the 10"-wide canvas; y is a 0-1
    // fraction of the content area's height — see the "flowchart" render
    // branch in presentationBuilder.ts, which uses each differently.
    position: { x: Math.max(0, Math.min(pos.x, 10)), y: Math.max(0, Math.min(pos.y, 1)) },
    connections: Array.isArray(n.connections) ? stringArray(n.connections) : undefined,
  };
}

function normalizeCalendarEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.date !== "string" || !e.date || typeof e.title !== "string" || !e.title) return null;
  return {
    date: e.date,
    title: e.title,
    description: typeof e.description === "string" ? e.description : undefined,
    highlight: e.highlight === true,
  };
}

const GALLERY_ARRANGEMENTS = ["grid", "horizontal", "vertical"] as const;

function normalizeGalleryItem(raw: unknown): GalleryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const title = typeof i.title === "string" ? i.title : undefined;
  const description = typeof i.description === "string" ? i.description : undefined;
  const caption = typeof i.caption === "string" ? i.caption : undefined;
  if (!title && !description && !caption) return null;
  return { title, description, caption, icon: normalizeIcon(i.icon) };
}

function normalizeQuoteItem(raw: unknown): QuoteItem | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  if (typeof q.quote !== "string" || !q.quote) return null;
  return {
    quote: q.quote,
    author: typeof q.author === "string" ? q.author : undefined,
    source: typeof q.source === "string" ? q.source : undefined,
  };
}

const ADVANCED_TABLE_FORMATS = ["currency", "percent", "number"] as const;

function normalizeAdvancedTableCell(raw: unknown): AdvancedTableCell | null {
  if (typeof raw === "string") return raw ? { text: raw } : null;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.text !== "string" || !c.text) return null;
  return {
    text: c.text,
    highlight: c.highlight === true,
    status: c.status === "yes" || c.status === "no" || c.status === "warning" ? c.status : undefined,
    numeric: c.numeric === true,
    format: enumOr(c.format, ADVANCED_TABLE_FORMATS),
  };
}

function normalizeAdvancedTableRow(raw: unknown): AdvancedTableCell[] {
  return Array.isArray(raw) ? raw.map(normalizeAdvancedTableCell).filter((c): c is AdvancedTableCell => c !== null) : [];
}

// ── Canvas layout validation ─────────────────────────────────────────────
// Bounds are the nominal canvas only (0-10 x 0-5.625) — NOT the
// CONTENT_TOP/CONTENT_BOTTOM chrome-safe-area constants from
// presentationBuilder.ts, which this file deliberately never imports as
// values (only as types, via `import type` above): any named-value import
// from that module would pull its top-level `import PptxGenJS` into
// a browser bundle, the entire reason this file stays
// pptxgenjs-free. A second, tighter clamp into the chrome-safe area happens
// separately at render time in presentationBuilder.ts, where those
// constants already live.
const CANVAS_ELEMENT_CAP = 16;
const MIN_ELEMENT_SIZE = 0.1;
const CANVAS_W = 10;
const CANVAS_H = 5.625;

const FILL_ROLES = ["accent", "accentSoft", "card", "background", "none"] as const;
const TEXT_ROLES = ["title", "body", "accent", "onAccent"] as const;
const FONT_ROLES = ["heading", "body"] as const;
const TEXT_SIZES = ["xl", "lg", "md", "sm", "xs"] as const;
const SHAPE_KINDS = ["rect", "roundRect", "ellipse", "line"] as const;
const BORDER_ROLES = ["accent", "body", "none"] as const;
const H_ALIGNS = ["left", "center", "right"] as const;
const V_ALIGNS = ["top", "middle", "bottom"] as const;

function enumOr<T extends string>(raw: unknown, allowed: readonly T[]): T | undefined {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

function normalizeCanvasBox(c: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
  const { x, y, w, h } = c;
  if (
    typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number" ||
    !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)
  ) {
    return null;
  }
  const cw = Math.max(MIN_ELEMENT_SIZE, Math.min(w, CANVAS_W));
  const ch = Math.max(MIN_ELEMENT_SIZE, Math.min(h, CANVAS_H));
  return { x: Math.max(0, Math.min(x, CANVAS_W - cw)), y: Math.max(0, Math.min(y, CANVAS_H - ch)), w: cw, h: ch };
}

// Drops an invalid element rather than the whole slide — same fail-open
// philosophy every array-of-items layout above already uses (map -> filter
// nulls -> keep the slide if anything survived).
function normalizeCanvasElement(raw: unknown): CanvasElement | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const box = normalizeCanvasBox(c);
  if (!box) return null;

  if (c.type === "text") {
    if (typeof c.text !== "string" || !c.text.trim()) return null;
    return {
      type: "text", ...box, text: c.text,
      fontRole: enumOr<FontRole>(c.fontRole, FONT_ROLES),
      textRole: enumOr<TextRole>(c.textRole, TEXT_ROLES),
      size: enumOr<CanvasTextSize>(c.size, TEXT_SIZES),
      bold: c.bold === true, italic: c.italic === true,
      align: enumOr(c.align, H_ALIGNS), valign: enumOr(c.valign, V_ALIGNS),
    };
  }
  if (c.type === "shape") {
    const shape = enumOr(c.shape, SHAPE_KINDS);
    if (!shape) return null;
    return { type: "shape", ...box, shape, fillRole: enumOr<FillRole>(c.fillRole, FILL_ROLES), borderRole: enumOr(c.borderRole, BORDER_ROLES) };
  }
  if (c.type === "icon") {
    const icon = normalizeIcon(c.icon);
    return icon ? { type: "icon", ...box, icon, badge: c.badge !== false } : null;
  }
  if (c.type === "chart") {
    const chartType = enumOr(c.chartType, CHART_TYPES);
    if (!chartType || !Array.isArray(c.categories)) return null;
    const categories = stringArray(c.categories);
    // Same series-capable set as the top-level "chart" layout case above —
    // renderChartAt renders series for these four plus "bar-stacked", never
    // for "scatter"/"radar"/"area" (flat `values` only there).
    const seriesCapableTypes = new Set(["bar-stacked", "bar", "line", "pie", "doughnut"]);
    if (seriesCapableTypes.has(chartType) && Array.isArray(c.series)) {
      const series = c.series.map(normalizeChartSeries).filter((sr): sr is ChartSeries => sr !== null);
      if (categories.length > 0 && series.length > 0) {
        return { type: "chart", ...box, chartType, categories, series, title: typeof c.title === "string" ? c.title : undefined };
      }
    }
    if (Array.isArray(c.values)) {
      const values = c.values.filter((v): v is number => typeof v === "number");
      const n = Math.min(categories.length, values.length);
      return n > 0
        ? {
            type: "chart", ...box, chartType: chartType === "bar-stacked" ? "bar" : chartType,
            categories: categories.slice(0, n), values: values.slice(0, n),
            title: typeof c.title === "string" ? c.title : undefined,
          }
        : null;
    }
    return null;
  }
  if (c.type === "table") {
    if (!Array.isArray(c.headers) || !Array.isArray(c.rows)) return null;
    const headers = stringArray(c.headers);
    const rows = c.rows.map(normalizeTableRow).filter((r) => r.length > 0);
    return headers.length > 0 && rows.length > 0 ? { type: "table", ...box, headers, rows } : null;
  }
  return null;
}

// Normalizes one slide by its declared `layout`. A slide whose fields don't
// match its own declared layout (or an unrecognized layout) degrades to a
// plain bullets slide built from whatever text is actually present, rather
// than being dropped — a malformed slide costs its visual treatment, not
// its place in the deck.
function normalizeSlide(raw: unknown): SlideContent | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const layout = typeof s.layout === "string" ? s.layout : "bullets";
  const icon = normalizeIcon(s.icon);
  const notes = normalizeNotes(s.notes);

  // A community layout (see layoutRegistry.ts). Its own normalize decides what
  // to keep. If it refuses the slide, or throws, the slide falls through to the
  // plain-bullets fallback below, like any other malformed slide.
  const custom = getLayout(layout);
  if (custom) {
    try {
      const data = custom.normalize(s);
      if (data !== null && data !== undefined) return { layout: "custom", custom: custom.name, data, icon, notes };
    } catch {
      /* a broken layout must not take the deck down */
    }
  }

  if (layout === "stat" && typeof s.value === "string" && typeof s.caption === "string") {
    return { layout: "stat", value: s.value, caption: s.caption, icon, notes };
  }
  if (layout === "comparison") {
    const left = normalizeColumn(s.left);
    const right = normalizeColumn(s.right);
    if (left && right) {
      return { layout: "comparison", title: typeof s.title === "string" ? s.title : undefined, left, right, icon, notes };
    }
  }
  if (layout === "quote" && typeof s.quote === "string") {
    return { layout: "quote", quote: s.quote, author: typeof s.author === "string" ? s.author : undefined, icon, notes };
  }
  if (layout === "section" && typeof s.title === "string") {
    return { layout: "section", title: s.title, eyebrow: typeof s.eyebrow === "string" ? s.eyebrow : undefined, icon, notes };
  }
  if (layout === "table" && Array.isArray(s.headers) && Array.isArray(s.rows)) {
    const headers = stringArray(s.headers);
    const rows = s.rows.filter((r): r is unknown[] => Array.isArray(r)).map(normalizeTableRow);
    const columnColors = Array.isArray(s.columnColors)
      ? s.columnColors.map(normalizeHexField).filter((c): c is string => c !== undefined)
      : undefined;
    if (headers.length > 0 && rows.length > 0) {
      return { layout: "table", title: typeof s.title === "string" ? s.title : undefined, headers, columnColors, rows, insights: normalizeInsights(s.insights), icon, notes };
    }
  }
  if (layout === "chart" && (CHART_TYPES as readonly string[]).includes(s.chartType as string) && Array.isArray(s.categories)) {
    const categories = stringArray(s.categories);
    const chartType = s.chartType as "bar" | "line" | "pie" | "doughnut" | "bar-stacked" | "scatter" | "radar" | "area";
    // renderChartAt (presentationBuilder.ts) draws a named `series` for
    // "bar-stacked" (its only data path — no flat-values fallback exists
    // for it) and equally for "bar"/"line"/"pie"/"doughnut" (its generic
    // branch groups by series when present, same as single-series `values`
    // otherwise). "scatter"/"radar"/"area" only ever render from flat
    // `values` there, never series. Previously this only ever looked at
    // `series` for "bar-stacked" and required flat `values` for every other
    // type — a model emitting a perfectly valid series-shaped line/bar/pie
    // chart (e.g. one named series for a trend over time) fell through
    // this whole block untouched and silently degraded to a title-only
    // bullets slide with zero bullets, an empty-looking slide in the deck.
    const seriesCapableTypes = new Set(["bar-stacked", "bar", "line", "pie", "doughnut"]);
    if (seriesCapableTypes.has(chartType) && Array.isArray(s.series)) {
      const series = s.series.map(normalizeChartSeries).filter((sr): sr is NonNullable<typeof sr> => sr !== null);
      if (categories.length > 0 && series.length > 0) {
        return { layout: "chart", title: typeof s.title === "string" ? s.title : undefined, chartType, categories, series, icon, notes };
      }
    }
    if (Array.isArray(s.values)) {
      const values = s.values.filter((v): v is number => typeof v === "number");
      const n = Math.min(categories.length, values.length);
      if (n > 0) {
        return {
          layout: "chart",
          title: typeof s.title === "string" ? s.title : undefined,
          chartType,
          categories: categories.slice(0, n),
          values: values.slice(0, n),
          icon,
          notes,
        };
      }
    }
  }
  if (layout === "grid" && Array.isArray(s.items)) {
    const items = s.items.map(normalizeGridItem).filter((i): i is NonNullable<typeof i> => i !== null);
    if (items.length > 0) {
      return { layout: "grid", title: typeof s.title === "string" ? s.title : undefined, items, insights: normalizeInsights(s.insights), icon, notes };
    }
  }
  if (layout === "ranked" && typeof s.title === "string" && Array.isArray(s.items)) {
    const items = stringArray(s.items);
    if (items.length > 0) {
      return { layout: "ranked", title: s.title, items, icon, notes };
    }
  }
  if (layout === "timeline" && Array.isArray(s.steps)) {
    const steps = s.steps.map(normalizeTimelineStep).filter((st): st is NonNullable<typeof st> => st !== null);
    if (steps.length > 0) {
      return { layout: "timeline", title: typeof s.title === "string" ? s.title : undefined, steps, icon, notes };
    }
  }
  if (layout === "columns") {
    const left = normalizeColumnBlock(s.left);
    const right = normalizeColumnBlock(s.right);
    if (left && right) {
      return { layout: "columns", title: typeof s.title === "string" ? s.title : undefined, left, right, icon, notes };
    }
  }
  if (layout === "problem_solution" && typeof s.problem === "string" && typeof s.solution === "string") {
    return { layout: "problem_solution", title: typeof s.title === "string" ? s.title : undefined, problem: s.problem, solution: s.solution, icon, notes };
  }
  if (layout === "team" && Array.isArray(s.members)) {
    const members = s.members.map(normalizeTeamMember).filter((m): m is NonNullable<typeof m> => m !== null);
    if (members.length > 0) {
      return { layout: "team", title: typeof s.title === "string" ? s.title : undefined, members, icon, notes };
    }
  }
  if (layout === "iconlist" && Array.isArray(s.items)) {
    const items = s.items.map(normalizeIconListItem).filter((i): i is NonNullable<typeof i> => i !== null);
    if (items.length > 0) {
      return { layout: "iconlist", title: typeof s.title === "string" ? s.title : undefined, items, icon, notes };
    }
  }
  if (layout === "funnel" && Array.isArray(s.stages)) {
    const stages = s.stages.map(normalizeFunnelStage).filter((st): st is NonNullable<typeof st> => st !== null);
    if (stages.length > 0) {
      return { layout: "funnel", title: typeof s.title === "string" ? s.title : undefined, stages, icon, notes };
    }
  }
  if (layout === "stats_row" && Array.isArray(s.stats)) {
    const stats = s.stats.map(normalizeStatItem).filter((st): st is NonNullable<typeof st> => st !== null);
    if (stats.length > 0) {
      return { layout: "stats_row", title: typeof s.title === "string" ? s.title : undefined, stats, insights: normalizeInsights(s.insights), icon, notes };
    }
  }
  if (layout === "hero" && typeof s.title === "string" && s.title) {
    const stats = Array.isArray(s.stats) ? s.stats.map(normalizeStatItem).filter((st): st is StatItem => st !== null) : undefined;
    const pillars = Array.isArray(s.pillars) ? s.pillars.map(normalizeCoverPillar).filter((p): p is CoverPillar => p !== null) : undefined;
    return {
      layout: "hero",
      eyebrow: typeof s.eyebrow === "string" ? s.eyebrow : undefined,
      title: s.title,
      subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
      stats: stats && stats.length > 0 ? stats : undefined,
      pillars: pillars && pillars.length > 0 ? pillars : undefined,
      icon, notes,
    };
  }
  if (layout === "tiers" && Array.isArray(s.tiers)) {
    const tiers = s.tiers.map(normalizeTierItem).filter((t): t is TierItem => t !== null);
    if (tiers.length > 0) {
      return { layout: "tiers", title: typeof s.title === "string" ? s.title : undefined, tiers, icon, notes };
    }
  }
  if (layout === "recap" && Array.isArray(s.takeaways)) {
    const takeaways = stringArray(s.takeaways);
    if (takeaways.length > 0) {
      const example = s.example ? normalizeRecapExample(s.example) : null;
      return {
        layout: "recap",
        title: typeof s.title === "string" ? s.title : undefined,
        example: example ?? undefined,
        takeaways,
        icon, notes,
      };
    }
  }
  if (layout === "glossary" && Array.isArray(s.terms)) {
    const terms = s.terms.map(normalizeGlossaryTerm).filter((t): t is GlossaryTerm => t !== null);
    if (terms.length > 0) {
      return { layout: "glossary", title: typeof s.title === "string" ? s.title : undefined, terms, icon, notes };
    }
  }
  if (layout === "roadmap" && Array.isArray(s.steps)) {
    const steps = s.steps.map(normalizeRoadmapStep).filter((st): st is RoadmapStep => st !== null);
    if (steps.length > 0) {
      const currentIndex = typeof s.currentIndex === "number" && Number.isInteger(s.currentIndex) && s.currentIndex >= 0 && s.currentIndex < steps.length
        ? s.currentIndex
        : undefined;
      return { layout: "roadmap", title: typeof s.title === "string" ? s.title : undefined, steps, currentIndex, icon, notes };
    }
  }
  if (layout === "process" && Array.isArray(s.steps)) {
    const steps = s.steps.map(normalizeProcessStep).filter((st): st is NonNullable<typeof st> => st !== null);
    if (steps.length > 0) {
      return {
        layout: "process",
        title: typeof s.title === "string" ? s.title : undefined,
        steps,
        caption: typeof s.caption === "string" ? s.caption : undefined,
        icon,
        notes,
      };
    }
  }
  if (layout === "recommendation" && Array.isArray(s.options)) {
    const options = s.options.map(normalizeRecommendationOption).filter((o): o is NonNullable<typeof o> => o !== null);
    if (options.length > 0) {
      return { layout: "recommendation", title: typeof s.title === "string" ? s.title : undefined, options, icon, notes };
    }
  }
  // Every field is optional (title defaults to "Thank You" at render time,
  // see presentationBuilder.ts) — always succeeds once the model declares
  // this layout, same leniency as "section" needing only a title.
  if (layout === "thank_you") {
    return {
      layout: "thank_you",
      title: typeof s.title === "string" ? s.title : undefined,
      subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
      contact: Array.isArray(s.contact) ? stringArray(s.contact) : undefined,
      icon, notes,
    };
  }
  if (layout === "presenter") {
    // Accepts either the current "presenters" array or, for backward
    // compatibility with decks generated before this shape changed, the
    // old flat single-person fields living directly on the slide.
    const rawPresenters = Array.isArray(s.presenters) ? s.presenters : typeof s.name === "string" && s.name ? [s] : [];
    const presenters = rawPresenters.map(normalizePresenterInfo).filter((p): p is PresenterInfo => p !== null);
    if (presenters.length > 0) {
      return { layout: "presenter", presenters, icon, notes };
    }
  }

  if (layout === "matrix" && Array.isArray(s.rows) && Array.isArray(s.cols) && Array.isArray(s.cells)) {
    const rows = stringArray(s.rows);
    const cols = stringArray(s.cols);
    const cells = s.cells.map(normalizeMatrixRow).filter((r) => r.length > 0);
    if (rows.length > 0 && cols.length > 0 && cells.length > 0) {
      return { layout: "matrix", title: typeof s.title === "string" ? s.title : undefined, rows, cols, cells, icon, notes };
    }
  }
  if (layout === "flowchart" && Array.isArray(s.nodes)) {
    const nodes = s.nodes.map(normalizeFlowchartNode).filter((n): n is FlowchartNode => n !== null);
    if (nodes.length > 0) {
      return { layout: "flowchart", title: typeof s.title === "string" ? s.title : undefined, nodes, icon, notes };
    }
  }
  if (layout === "calendar" && Array.isArray(s.events)) {
    const events = s.events.map(normalizeCalendarEvent).filter((e): e is CalendarEvent => e !== null);
    if (events.length > 0) {
      return { layout: "calendar", title: typeof s.title === "string" ? s.title : undefined, events, period: typeof s.period === "string" ? s.period : undefined, icon, notes };
    }
  }
  if (layout === "gallery" && Array.isArray(s.items)) {
    const items = s.items.map(normalizeGalleryItem).filter((i): i is GalleryItem => i !== null);
    if (items.length > 0) {
      return {
        layout: "gallery",
        title: typeof s.title === "string" ? s.title : undefined,
        items,
        arrangement: enumOr(s.arrangement, GALLERY_ARRANGEMENTS),
        icon, notes,
      };
    }
  }
  if (layout === "quote_carousel" && Array.isArray(s.quotes)) {
    const quotes = s.quotes.map(normalizeQuoteItem).filter((q): q is QuoteItem => q !== null);
    if (quotes.length > 0) {
      return { layout: "quote_carousel", title: typeof s.title === "string" ? s.title : undefined, quotes, icon, notes };
    }
  }
  if (layout === "advanced_table" && Array.isArray(s.headers) && Array.isArray(s.rows)) {
    const headers = stringArray(s.headers);
    const rows = s.rows.map(normalizeAdvancedTableRow).filter((r) => r.length > 0);
    const columnColors = Array.isArray(s.columnColors)
      ? s.columnColors.map(normalizeHexField).filter((c): c is string => c !== undefined)
      : undefined;
    if (headers.length > 0 && rows.length > 0) {
      return {
        layout: "advanced_table",
        title: typeof s.title === "string" ? s.title : undefined,
        headers, columnColors, rows,
        insights: normalizeInsights(s.insights),
        sortable: s.sortable === true,
        filterable: s.filterable === true,
        icon, notes,
      };
    }
  }

  if (layout === "canvas" && Array.isArray(s.elements)) {
    const elements = s.elements
      .map(normalizeCanvasElement)
      .filter((e): e is CanvasElement => e !== null)
      .slice(0, CANVAS_ELEMENT_CAP);
    if (elements.length > 0) {
      return { layout: "canvas", title: typeof s.title === "string" ? s.title : undefined, fullBleed: s.fullBleed === true, elements, icon, notes };
    }
  }

  const title = typeof s.title === "string" ? s.title : typeof s.value === "string" ? s.value : typeof s.quote === "string" ? s.quote : "";
  const bullets = Array.isArray(s.bullets) ? stringArray(s.bullets) : typeof s.caption === "string" ? [s.caption] : [];
  if (!title && bullets.length === 0) return null;
  return { layout: "bullets", title: title || "Untitled", bullets, icon, notes };
}

const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;

// `background`/`accent` are freely model-chosen hex colors now (see
// PRESENTATION_MODE_SUFFIX in the generation prompt) — validated here the same way
// regardless of source, since export/route.ts re-normalizes a client
// payload through this same function rather than trusting its shape.
function normalizeHexField(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !HEX_COLOR_RE.test(raw)) return undefined;
  return raw.replace(/^#/, "").toUpperCase();
}

// Hard backstop for the "vary layouts" prompt instruction in the generation prompt —
// the model doesn't always comply, so this guarantees the rule regardless:
// on a third straight "bullets" slide, turn it into a "section" divider
// (its bullets are dropped, but a title-only divider is the one layout that
// can't misrepresent arbitrary content) and reset the streak.
function enforceBulletVariety(slides: SlideContent[]): SlideContent[] {
  let streak = 0;
  return slides.map((slide) => {
    if (slide.layout !== "bullets") {
      streak = 0;
      return slide;
    }
    streak++;
    if (streak < 3) return slide;
    streak = 0;
    return { layout: "section", title: slide.title, icon: slide.icon, notes: slide.notes, tone: slide.tone } satisfies SlideContent;
  });
}

// Deterministic — no prompt instruction needed, since this is a pure
// post-process over "section" slides the model already emitted rather than
// something it has to remember to do itself. A longer deck organized into
// 2+ named parts gets a navigable overview; a short or flat deck doesn't
// need one and doesn't get one.
const MIN_SLIDES_FOR_AGENDA = 5;
const MIN_SECTIONS_FOR_AGENDA = 2;

function roughSlideTitle(s: SlideContent): string {
  if ("title" in s && typeof s.title === "string") return s.title;
  if (s.layout === "quote") return s.quote;
  if (s.layout === "stat") return s.value;
  return "";
}

function insertAgendaSlide(slides: SlideContent[]): SlideContent[] {
  if (slides.length < MIN_SLIDES_FOR_AGENDA) return slides;
  const sectionTitles = slides.filter((s) => s.layout === "section").map((s) => s.title);
  if (sectionTitles.length < MIN_SECTIONS_FOR_AGENDA) return slides;
  // Already opens with something agenda-shaped (the model built its own) — don't double up.
  if (/agenda|overview|contents|outline/i.test(roughSlideTitle(slides[0]))) return slides;
  const agendaSlide: SlideContent = { layout: "ranked", title: "Agenda", items: sectionTitles };
  return [agendaSlide, ...slides];
}

export function normalizeDeck(parsed: unknown): SlideDeck | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.slides)) return null;

  // Attached as a second pass rather than inside normalizeSlide's own
  // per-layout branches — `tone` isn't layout-specific (unlike icon, which
  // some layouts default when absent), so every branch would otherwise
  // need the exact same one-line addition.
  const slidesWithTone = p.slides.map((raw) => {
    const slide = normalizeSlide(raw);
    if (!slide) return null;
    const tone = raw && typeof raw === "object" ? normalizeTone((raw as Record<string, unknown>).tone) : undefined;
    return tone ? { ...slide, tone } : slide;
  });
  const normalized = enforceBulletVariety(slidesWithTone.filter((s): s is SlideContent => s !== null));
  if (normalized.length === 0) return null;
  const slides = insertAgendaSlide(normalized);

  const meta = Array.isArray(p.meta) ? p.meta.map(normalizeMetaItem).filter((m): m is DeckMetaItem => m !== null) : undefined;

  return {
    title: typeof p.title === "string" ? p.title : undefined,
    subtitle: typeof p.subtitle === "string" ? p.subtitle : undefined,
    meta: meta && meta.length > 0 ? meta : undefined,
    background: normalizeHexField(p.background),
    accent: normalizeHexField(p.accent),
    fontPair: normalizeFontPair(p.fontPair),
    fonts: normalizeFonts(p.fonts),
    slides,
  };
}

// Truncation-tolerant repair: a low-budget package can cut the model off
// mid-deck. Rather than discard a reply the user already paid for, keep
// every fully-closed slide object and drop only the incomplete tail one.
function repairSlidesJson(raw: string): string | null {
  const slidesKeyIdx = raw.indexOf('"slides"');
  if (slidesKeyIdx === -1) return null;
  const arrStart = raw.indexOf("[", slidesKeyIdx);
  if (arrStart === -1) return null;

  const head = raw.slice(0, slidesKeyIdx).replace(/,\s*$/, "");
  const rest = raw.slice(arrStart + 1);

  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(rest.slice(start, i + 1));
        start = -1;
      }
    }
  }
  if (objects.length === 0) return null;

  const needsComma = head.trim() !== "{" && head.trim() !== "";
  return `${head}${needsComma ? "," : ""}"slides":[${objects.join(",")}]}`;
}
