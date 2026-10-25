import PptxGenJS from "pptxgenjs";
import { stripMarkdownLine } from "../shared/exportDoc.js";
import { fitFontSize, avgEmForFont } from "./textFit.js";
import { buildIconCache, getIconPng, type IconCache } from "./pptIcons.js";
import { getLayout, type LayoutHelpers } from "./layoutRegistry.js";

// Small built-in illustration set — a fixed enum for the same reason
// layout/color are: the model picks from a known list rather than inventing
// arbitrary imagery, so every deck renders reliably with no licensing
// question or per-deck generation cost/latency. Rendered as flat monochrome
// PNGs tinted to the deck's own accent color (see lib/pptIcons.ts), not
// colored Unicode emoji or an AI image call — an emoji's color and style
// come from whatever font the viewer's platform substitutes, which reads as
// inconsistent and off-brand next to a deck's own chosen palette.
export type IllustrationIcon =
  | "idea" | "growth" | "team" | "target" | "rocket" | "chart" | "book" | "checklist"
  | "globe" | "gear" | "calendar" | "shield" | "money" | "clock" | "warning"
  | "celebration" | "star" | "heart" | "thumbs_up" | "thumbs_down" | "eye" | "email"
  | "phone" | "location" | "map" | "home" | "building" | "factory" | "shopping" | "cart"
  | "credit_card" | "wallet" | "bank" | "stock" | "trending_down" | "pulse" | "activity"
  | "network" | "cloud" | "server" | "database" | "code" | "terminal" | "bug"
  | "security" | "lock" | "unlock" | "key" | "user" | "users" | "person" | "people"
  | "child" | "family" | "handshake" | "award" | "trophy" | "medal" | "flag" | "bookmark"
  | "tag" | "label" | "price" | "discount" | "percent" | "calculator" | "graph"
  | "analytics" | "insights" | "report" | "document" | "file" | "folder" | "archive"
  | "download" | "upload" | "share" | "link" | "connect" | "sync" | "refresh" | "loop"
  | "replay" | "undo" | "redo" | "edit" | "delete" | "trash" | "filter" | "search"
  | "sort" | "list" | "grid" | "menu" | "settings" | "tune" | "dashboard" | "widgets"
  | "apps" | "extension" | "plugin" | "api" | "integration" | "automation" | "robot"
  | "smart_toy" | "psychology" | "lightbulb" | "auto_awesome" | "bolt" | "flash_on"
  | "power" | "battery" | "wifi" | "signal" | "bluetooth" | "usb" | "print" | "camera"
  | "image" | "video" | "audio" | "mic" | "speaker" | "headphones" | "volume" | "mute"
  | "play" | "pause" | "stop" | "skip_next" | "skip_previous" | "fast_forward" | "rewind"
  | "shuffle" | "repeat" | "playlist" | "library" | "favorite" | "like" | "dislike"
  | "comment" | "chat" | "message" | "notification" | "alarm" | "timer" | "hourglass"
  | "snooze" | "watch" | "access_time" | "event" | "today" | "date_range" | "schedule"
  | "calendar_month" | "update" | "new_releases" | "whatshot" | "local_fire_department"
  | "water_drop" | "air" | "terrain" | "landscape" | "nature" | "eco" | "recycling"
  | "energy" | "electric_bolt" | "solar" | "battery_charging" | "ev_station" | "gas"
  | "oil" | "mining" | "agriculture" | "grass" | "forest" | "spa" | "healing" | "medical"
  | "health" | "hospital" | "pharmacy" | "science" | "biotech" | "genetics" | "atom"
  | "chemistry" | "physics" | "math" | "calculate" | "functions" | "data" | "storage"
  | "backup" | "cloud_upload" | "cloud_download" | "sync_alt" | "swap" | "compare"
  | "compare_arrows" | "open_in" | "open_out" | "exit_to_app" | "login" | "logout"
  | "how_to_reg" | "app_registration" | "admin_panel" | "manage_accounts"
  | "supervisor_account" | "support_agent" | "contact" | "help" | "info" | "error"
  | "check_circle" | "cancel" | "priority_high" | "low_priority" | "layers" | "view"
  | "visibility" | "visibility_off" | "zoom_in" | "zoom_out" | "fullscreen"
  | "aspect_ratio" | "fit_screen" | "expand" | "minimize" | "close" | "arrow_forward"
  | "arrow_back" | "arrow_up" | "arrow_down" | "arrow_left" | "arrow_right"
  | "open_in_new" | "external_link" | "language" | "translate" | "public" | "verified"
  | "workspace_premium" | "diamond" | "stars" | "auto_awesome_mosaic" | "gradient"
  | "palette" | "color" | "brush" | "format" | "text" | "title" | "heading" | "paragraph"
  | "list_alt" | "check_box" | "radio_button" | "toggle_on" | "toggle_off" | "switch"
  | "slider" | "dial" | "knob" | "progress" | "spinner" | "loading" | "hourglass_empty"
  | "hourglass_top" | "sandglass" | "history" | "history_edu" | "update_history" | "time"
  | "stopwatch" | "speed" | "speedometer" | "tachometer" | "alt_route" | "route"
  | "navigation" | "explore" | "place" | "pin_drop" | "location_on" | "location_city"
  | "location_searching" | "my_location" | "directions" | "directions_car"
  | "directions_bike" | "directions_walk" | "directions_transit" | "flight" | "train"
  | "bus" | "car" | "taxi" | "ship" | "sailing" | "surfing" | "pool" | "hot_tub"
  | "beach_access" | "water" | "waves" | "tide" | "tsunami" | "hurricane" | "storm"
  | "thunderstorm" | "cloud_queue" | "wb_cloudy" | "wb_sunny" | "wb_twilight"
  | "nights_stay" | "bedtime" | "sleep" | "hotel" | "home_work" | "business" | "office"
  | "corporate" | "company" | "work" | "engineering" | "construction" | "handyman"
  | "build" | "architecture" | "domain" | "dns" | "router" | "settings_ethernet"
  | "cable" | "phonelink" | "phonelink_setup" | "forward" | "reply" | "reply_all"
  | "send" | "unarchive" | "drafts" | "inbox" | "outbox" | "send_time" | "schedule_send"
  | "access_alarm" | "alarm_on" | "alarm_off" | "notifications" | "notifications_active"
  | "add_circle" | "add" | "remove_circle" | "remove" | "clear" | "check" | "done"
  | "done_all" | "done_outline" | "select_all" | "deselect" | "content_copy"
  | "content_cut" | "content_paste" | "content_paste_off" | "filter_list" | "filter_none"
  | "filter_alt" | "sort_by_alpha" | "sort_by_numeric" | "sort_by_date" | "sort_by_size"
  | "swap_vert" | "swap_horiz" | "sync_disabled" | "sync_problem" | "cached"
  | "autorenew" | "repeat_one" | "play_arrow" | "pause_circle" | "stop_circle"
  | "fast_rewind" | "replay_circle" | "volume_up" | "volume_down" | "volume_mute"
  | "volume_off" | "mic_off" | "videocam" | "videocam_off" | "photo_camera" | "photo"
  | "movie" | "movie_filter" | "theaters" | "album" | "collections"
  | "collections_bookmark" | "featured_play_list" | "subscriptions" | "watch_later"
  | "group" | "group_add" | "group_remove" | "person_add" | "person_remove"
  | "person_search" | "people_outline" | "settings_applications"
  | "settings_backup_restore" | "settings_bluetooth" | "settings_brightness"
  | "settings_cell" | "settings_input_antenna" | "settings_input_component"
  | "settings_input_composite" | "settings_input_hdmi" | "settings_input_svideo"
  | "settings_overscan" | "settings_phone" | "settings_power" | "settings_remote"
  | "settings_suggest" | "settings_system_daydream" | "settings_voice" | "accessibility"
  | "accessibility_new" | "accessible" | "accessible_forward" | "deaf" | "hearing"
  | "low_vision" | "high_quality" | "hdr_on" | "hdr_off" | "filter_tilt_shift"
  | "filter_vintage" | "wb_auto" | "wb_incandescent" | "wb_iridescent";

// Fixed font-pair choices, not arbitrary Google Fonts — PowerPoint only
// reliably renders fonts actually installed on the viewer's machine, so
// picking from a small set that ships with every Windows/Mac Office
// install avoids a deck silently falling back to a generic substitute font
// on someone else's computer.
export type FontPairKey = "modern" | "classic" | "bold";

export const FONT_PAIRS: Record<FontPairKey, { heading: string; body: string }> = {
  modern: { heading: "Calibri", body: "Calibri" },
  classic: { heading: "Georgia", body: "Georgia" },
  bold: { heading: "Arial Black", body: "Arial" },
};

export const DEFAULT_FONT_PAIR: FontPairKey = "modern";

// Fifteen layouts the model can pick per slide (see the presentation
// instruction) — `layout` is optional on BulletsSlide only
// so a deck predating this field (or a slide that fell back during
// normalization, see lib/slideDeck.ts) still matches it by default. `icon`
// and `notes` are optional on every layout — most slides benefit from an
// icon, and any slide may carry presenter notes, but neither is ever
// required.
export interface BulletsSlide {
  layout?: "bullets";
  title: string;
  bullets: string[];
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface StatSlide {
  layout: "stat";
  value: string;
  caption: string;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface ComparisonColumn {
  heading: string;
  bullets?: string[]; // provide this OR steps
  steps?: TimelineStep[]; // numbered sequence instead of a plain bullet list — wins over bullets if both given
}

export interface ComparisonSlide {
  layout: "comparison";
  title?: string;
  left: ComparisonColumn;
  right: ComparisonColumn;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface QuoteSlide {
  layout: "quote";
  quote: string;
  author?: string;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface SectionSlide {
  layout: "section";
  title: string;
  // Optional small index/part label above the icon badge (e.g. "3.1",
  // "Part Two") — same "eyebrow" idea as HeroSlide's, for a divider that's
  // announcing a specific numbered part of a longer sequence rather than a
  // plain unlabeled break.
  eyebrow?: string;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// A cell is either a plain string, or an object carrying a pass/fail glyph
// and/or a best-in-class emphasis on top of its text — for comparison
// tables where a row needs to show "meets this criterion or not" or "which
// column wins," not just plain values.
export interface TableCell {
  text: string;
  status?: "yes" | "no" | "warning"; // renders a colored ✓/✗/! before the text
  highlight?: boolean; // best-in-class emphasis: ★ prefix, accent tint, bold
}

export interface TableSlide {
  layout: "table";
  title?: string;
  headers: string[];
  // Optional per-column header tint (hex, parallel to `headers`) — for
  // comparing several named entities/options where each gets its own color,
  // like the accent-only default otherwise gives every header the same fill.
  columnColors?: string[];
  rows: (string | TableCell)[][];
  insights?: InsightBanner[]; // 1-2 trailing synthesis banners below the table
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// bar/line/pie/doughnut stay single-series (`values`, one number per
// category); "bar-stacked" is the one chart type that needs 2+ named series
// stacked in the same bars, hence the separate optional `series` field
// rather than forcing every chart type to carry an unused series array.
export interface ChartSeries {
  name: string;
  values: number[];
  color?: string; // Optional custom color for this series
}

export interface ChartSlide {
  layout: "chart";
  title?: string;
  chartType: "bar" | "line" | "pie" | "doughnut" | "bar-stacked" | "scatter" | "bubble" | "radar" | "area";
  categories: string[];
  values?: number[];
  series?: ChartSeries[];
  showLegend?: boolean;
  showDataLabels?: boolean;
  showGridLines?: boolean;
  secondaryAxis?: boolean; // For combo charts
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Chart styling options
export interface ChartStyle {
  animation?: boolean;
  dataLabelPosition?: "center" | "end" | "bestFit";
  lineStyle?: "solid" | "dashed" | "dotted";
  markerSize?: number;
  showTrendLine?: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
  showGridLines?: boolean;
}


export interface GridItem {
  title: string;
  description?: string;
  icon?: IllustrationIcon;
}

export interface GridSlide {
  layout: "grid";
  title?: string;
  items: GridItem[];
  insights?: InsightBanner[]; // 1-2 trailing synthesis banners below the card grid
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface RankedSlide {
  layout: "ranked";
  title: string;
  items: string[];
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface TimelineStep {
  label: string;
  detail?: string;
}

export interface TimelineSlide {
  layout: "timeline";
  title?: string;
  steps: TimelineStep[];
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface ColumnBlock {
  heading?: string;
  bullets: string[];
}

export interface ColumnsSlide {
  layout: "columns";
  title?: string;
  left: ColumnBlock;
  right: ColumnBlock;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface ProblemSolutionSlide {
  layout: "problem_solution";
  title?: string;
  problem: string;
  solution: string;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface TeamMember {
  name: string;
  role?: string;
  description?: string;
  icon?: IllustrationIcon;
}

export interface TeamSlide {
  layout: "team";
  title?: string;
  members: TeamMember[];
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface IconListItem {
  text: string;
  icon?: IllustrationIcon;
}

export interface IconListSlide {
  layout: "iconlist";
  title?: string;
  items: IconListItem[];
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface FunnelStage {
  label: string;
  value?: string;
}

export interface FunnelSlide {
  layout: "funnel";
  title?: string;
  stages: FunnelStage[]; // widest/first stage first, narrowing down
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsRowSlide {
  layout: "stats_row";
  title?: string;
  stats: StatItem[]; // 3-6 side-by-side KPI blocks, distinct from "stat" (a single headline number)
  insights?: InsightBanner[]; // 1-2 trailing synthesis banners below the stat row
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface ProcessStep {
  title: string;
  description?: string;
}

export interface ProcessSlide {
  layout: "process";
  title?: string;
  steps: ProcessStep[]; // 3-6 numbered stage cards in a row, connected by arrows
  caption?: string; // optional one-line summary shown below the row
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface RecommendationOption {
  heading: string;
  items?: string[]; // short supporting bullets (criteria, sub-options) shown above the outcome
  outcomeLabel?: string; // small eyebrow above the outcome, e.g. "RECOMMENDED ENTITY"
  outcome: string; // the one required, spotlighted value/decision
  outcomeDetail?: string; // supporting line under the outcome
  rationale?: string; // one-line justification shown below the spotlight box
}

export interface RecommendationSlide {
  layout: "recommendation";
  title?: string;
  options: RecommendationOption[]; // 1-3 side-by-side decision cards
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// A closing slide — full-bleed accent background, same treatment as
// "section" (see buildPptx's "thank_you" branch) — included by default at
// the end of a presentation-style deck (see the generation prompt's prompt
// instruction), not something the user needs to ask for each time.
export interface ThankYouSlide {
  layout: "thank_you";
  title?: string; // defaults to "Thank You" at render time when omitted
  subtitle?: string; // optional one-line tagline
  contact?: string[]; // optional short lines — email, website, phone, social handle
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface PresenterInfo {
  name: string;
  role?: string; // e.g. "Founder & CEO"
  company?: string;
  bio?: string; // one-line tagline/bio
  contact?: string[]; // same shape as ThankYouSlide.contact
}

// A speaker intro/credit slide — unlike "team" (a bordered-card roster grid
// that wraps to multiple rows), this stays a chrome-free "spotlight" on 1-4
// people regardless of headcount. Added only when the user explicitly asks
// to be introduced/credited (see the generation prompt's prompt instruction) —
// never inserted by default. The old single-person flat shape (name/role/
// etc. directly on the slide) is only ever accepted at the
// lib/slideDeck.ts parsing boundary, for backward compatibility — it is
// not part of this canonical type.
export interface PresenterSlide {
  layout: "presenter";
  presenters: PresenterInfo[]; // 1-4; capped at render time, same convention as "team"/"recommendation"
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// A full-bleed accent-background "impact moment" — eyebrow + big headline +
// subtitle, plus an optional bottom row of stat cards or keyword "pillar"
// cards. Deliberately named "hero", not "cover" — that name is already
// taken by SlideDeck.title/subtitle/meta's own auto-generated title slide
// (see buildPptx's "formal cover" branch below) — this is an explicitly
// chosen, repeatable MID-DECK layout, unrelated to that mechanism.
export interface CoverPillar {
  label: string;
  description?: string;
}

export interface HeroSlide {
  layout: "hero";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats?: StatItem[]; // 3-4 stat cards, reuses StatItem — wins over pillars if both given
  pillars?: CoverPillar[]; // 3-4 keyword cards, alternative to stats
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// A vertical stack of labeled/colored band rows — levels, ranges, severity,
// pricing tiers, maturity stages. Distinct from "ranked" (a plain numbered
// list, no color banding, no sense of qualitative level) and "funnel"
// (narrowing widths implying volume drop-off, not discrete named tiers).
export interface TierItem {
  label: string;
  description?: string;
}

export interface TiersSlide {
  layout: "tiers";
  title?: string;
  tiers: TierItem[]; // 2-6 rows
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// A worked example paired with the takeaways it illustrates — narrower than
// "problem_solution" (that one is a directional problem->fix; this pairs a
// concrete instance with the general lessons it supports) and distinct from
// "quote" (a single line, not a narrative paragraph). "example" is optional
// — omit it for a recap-only slide summarizing a section with no single
// illustrative case attached.
export interface RecapExample {
  heading?: string; // defaults to "Case in Point" at render time when omitted
  text: string;
  icon?: IllustrationIcon;
}
export interface RecapSlide {
  layout: "recap";
  title?: string;
  example?: RecapExample;
  takeaways: string[]; // 1-5 checklist-style key points
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}
export interface GlossarySlide {
  layout: "glossary";
  title?: string;
  terms: GlossaryTerm[]; // 4-8 term/definition pairs, rendered in two columns
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export interface RoadmapStep {
  label: string;
  description?: string;
}
export interface RoadmapSlide {
  layout: "roadmap";
  title?: string;
  steps: RoadmapStep[]; // 3-6, vertically stacked and connected by a line
  // 0-based index of the step to highlight as the current position (e.g.
  // "you are here" in a multi-part course or project) — omit for a plain
  // numbered sequence with no single step singled out.
  currentIndex?: number;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Matrix slide for 2x2 or 3x3 comparison grids
export interface MatrixCell {
  content: string;
  highlight?: boolean;
  icon?: IllustrationIcon;
}
export interface MatrixSlide {
  layout: "matrix";
  title?: string;
  rows: string[]; // Row headers (2-3)
  cols: string[]; // Column headers (2-3)
  cells: MatrixCell[][]; // 2D array of cells
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Flowchart slide for decision trees and process flows
export interface FlowchartNode {
  id: string;
  text: string;
  type: "start" | "process" | "decision" | "end";
  position: { x: number; y: number }; // Position in canvas coordinates
  connections?: string[]; // IDs of connected nodes
}
export interface FlowchartSlide {
  layout: "flowchart";
  title?: string;
  nodes: FlowchartNode[]; // 3-8 nodes with positions and connections
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Calendar/timeline slide for date-based layouts
export interface CalendarEvent {
  date: string;
  title: string;
  description?: string;
  highlight?: boolean;
}
export interface CalendarSlide {
  layout: "calendar";
  title?: string;
  events: CalendarEvent[]; // 3-6 events with dates
  period?: string; // Optional period label (e.g., "Q1 2024", "January")
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Image gallery slide for multiple images
export interface GalleryItem {
  title?: string;
  description?: string;
  caption?: string;
  icon?: IllustrationIcon;
}
export interface GallerySlide {
  layout: "gallery";
  title?: string;
  items: GalleryItem[]; // 2-4 images with descriptions
  arrangement?: "grid" | "horizontal" | "vertical"; // Gallery arrangement, default "horizontal"
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Quote carousel for multiple quotes
export interface QuoteItem {
  quote: string;
  author?: string;
  source?: string;
}
export interface QuoteCarouselSlide {
  layout: "quote_carousel";
  title?: string;
  quotes: QuoteItem[]; // 2-4 quotes
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// New: Data table with advanced features
export interface AdvancedTableCell {
  text: string;
  highlight?: boolean;
  status?: "yes" | "no" | "warning";
  numeric?: boolean;
  format?: "currency" | "percent" | "number";
}
export interface AdvancedTableSlide {
  layout: "advanced_table";
  title?: string;
  headers: string[];
  columnColors?: string[];
  rows: AdvancedTableCell[][];
  insights?: InsightBanner[]; // Optional insight banners like table
  sortable?: boolean; // Indicate sorting capability
  filterable?: boolean; // Indicate filtering capability
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// A single trailing synthesis/callout banner shown below a slide's main
// content — added optionally to "stats_row"/"grid"/"table" (see their
// render branches). Up to 2 per slide: the first renders as the primary/
// accent-styled banner, the second (if present) as a quieter secondary tone.
export interface InsightBanner {
  lead?: string; // optional bold lead-in phrase
  text: string;
}

// ── Canvas layout: free-form element composition ────────────────────────
// Unlike every layout above (a fixed template the model fills fields into),
// "canvas" lets the model compose a slide as a flat list of positioned
// primitives — for content that doesn't fit any named layout, or a
// deliberately bespoke/infographic-style arrangement. Colors/fonts are
// always role tokens (never raw hex/family names), so a free-form slide
// still can't produce an illegible combination — see resolveFillRole/
// resolveCanvasTextColor below, which route every role through the exact
// same resolveColors() pipeline every other layout already uses.
// Per-slide background override — "contrast" renders that one slide in the
// deck's auto-derived opposite-lightness palette instead of its base one
// (see resolveContrastColors), for a deliberate dark/light beat (a divider,
// a closing slide, a moment that needs to stand apart) without breaking
// the deck's single color story. Omitted or "base" is today's behavior:
// every slide shares the one deck-level background/accent.
export type SlideTone = "base" | "contrast";

export type FillRole = "accent" | "accentSoft" | "card" | "background" | "none";
export type TextRole = "title" | "body" | "accent" | "onAccent";
export type FontRole = "heading" | "body";
export type CanvasTextSize = "xl" | "lg" | "md" | "sm" | "xs";

// Grid snap configuration for canvas elements
export const GRID_SIZE = 0.1; // 0.1 inch grid snap
export const SNAP_THRESHOLD = 0.05; // Snap to grid within this threshold

export interface CanvasBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Alignment options for canvas elements
export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

// Enhanced canvas element with alignment support
export interface CanvasElementWithAlignment extends CanvasBox {
  align?: Alignment;
  valign?: Alignment;
  snapToGrid?: boolean; // Enable grid snapping for this element
}

export interface CanvasTextElement extends CanvasBox {
  type: "text";
  text: string;
  fontRole?: FontRole;
  textRole?: TextRole;
  // A discrete size token, not a raw point size — lets fitFontSize (see
  // lib/textFit.ts) shrink from a known starting point when text overflows
  // its box, and keeps every canvas text element's scale consistent with
  // the rest of the deck's typography instead of arbitrary literal sizes.
  size?: CanvasTextSize;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  snapToGrid?: boolean;
}

export interface CanvasShapeElement extends CanvasBox {
  type: "shape";
  shape: "rect" | "roundRect" | "ellipse" | "line";
  fillRole?: FillRole; // ignored for "line"
  borderRole?: "accent" | "body" | "none";
}

export interface CanvasIconElement extends CanvasBox {
  type: "icon";
  icon: IllustrationIcon;
  badge?: boolean; // default true — themed circle behind the glyph
}

export interface CanvasChartElement extends CanvasBox {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "doughnut" | "bar-stacked" | "scatter" | "bubble" | "radar" | "area";
  categories: string[];
  values?: number[];
  series?: ChartSeries[];
  title?: string;
  style?: ChartStyle;
}

export interface CanvasTableElement extends CanvasBox {
  type: "table";
  headers: string[];
  rows: (string | TableCell)[][];
}

export type CanvasElement =
  | CanvasTextElement
  | CanvasShapeElement
  | CanvasIconElement
  | CanvasChartElement
  | CanvasTableElement;

export interface CanvasSlide {
  layout: "canvas";
  title?: string;
  // Full-bleed skips the title/page-number chrome bar entirely, giving
  // elements the whole 10 x 5.625 canvas — for a divider or hero moment, not
  // an ordinary content slide (which keeps the same chrome every other
  // layout gets, for visual consistency across the deck).
  fullBleed?: boolean;
  elements: CanvasElement[];
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

export type SlideContent =
  | BulletsSlide | StatSlide | ComparisonSlide | QuoteSlide | SectionSlide
  | TableSlide | ChartSlide | GridSlide | RankedSlide | TimelineSlide | ColumnsSlide
  | ProblemSolutionSlide | TeamSlide | IconListSlide | FunnelSlide | StatsRowSlide
  | ProcessSlide | RecommendationSlide | CanvasSlide | ThankYouSlide | PresenterSlide
  | HeroSlide | TiersSlide | RecapSlide | GlossarySlide | RoadmapSlide
  | MatrixSlide | FlowchartSlide | CalendarSlide | GallerySlide | QuoteCarouselSlide
  | AdvancedTableSlide | CustomSlide;

// A slide drawn by a community layout (see layoutRegistry.ts). `custom` is the
// layout's name and `data` is what that layout's normalize() returned.
export interface CustomSlide {
  layout: "custom";
  custom: string;
  data: unknown;
  icon?: IllustrationIcon;
  notes?: string;
  tone?: SlideTone;
}

// Fully natural-language-driven — the model picks these directly from what
// the user describes (see the presentation instruction),
// no fixed palette to choose from. Both are hex strings, no leading #. Title
// and body text colors are never model-set: they're always auto-derived
// from `background` for guaranteed legibility (see resolveColors).
// `fontPair` IS a fixed choice (see FontPairKey above), unlike color.
// `subtitle`/`meta` are optional, cover-only fields for a formal report-style
// title slide (a document reference grid — "Presented To" / "Date" / etc.) —
// see buildPptx's title-slide block. Omitting both keeps the plain centered
// cover every other deck already gets.
export interface DeckMetaItem {
  label: string;
  value: string;
}

export interface SlideDeck {
  title?: string;
  subtitle?: string;
  meta?: DeckMetaItem[];
  background?: string;
  accent?: string;
  fontPair?: FontPairKey;
  // Exact font names for headings and body text. Wins over fontPair. Set by
  // an imported theme (see theme/importPptx.ts), where the template's own
  // fonts are known. PowerPoint falls back to a similar font if the reader
  // does not have it.
  fonts?: { heading: string; body: string };
  slides: SlideContent[];
}

export interface ThemeColors {
  background: string; // hex, no leading #
  titleColor: string;
  bodyColor: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
}

// Default when the user didn't ask for a specific look — white background,
// a clean blue accent, so an unstyled deck still looks finished.
const DEFAULT_BACKGROUND = "FFFFFF";
const DEFAULT_ACCENT = "2563EB";

function normalizeHex(hex: string | undefined): string | null {
  if (!hex) return null;
  const clean = hex.replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(clean) ? clean.toUpperCase() : null;
}

// Resolves whatever background/accent/fontPair the model (or nothing)
// provided into a full, guaranteed-legible palette. Title/body text color is
// picked from two fixed light/dark pairs based on the *resolved*
// background's own luminance — never trusted from input — so any background
// color, however unusual, still gets readable text. `accent` runs through
// the same contrast-safety check every custom color got before (see
// ensureContrast below), preserving the model's chosen hue whenever it's
// already legible.
function resolveColors(deck: Pick<SlideDeck, "background" | "accent" | "fontPair" | "fonts">): ThemeColors {
  const background = normalizeHex(deck.background) ?? DEFAULT_BACKGROUND;
  const isDarkBg = relativeLuminance(hexToRgbTuple(background)) < 0.5;
  const titleColor = isDarkBg ? "F9FAFB" : "111827";
  const bodyColor = isDarkBg ? "D1D5DB" : "374151";
  const accent = ensureContrast(normalizeHex(deck.accent) ?? DEFAULT_ACCENT, background, isDarkBg ? "dark" : "light");
  const fonts = deck.fonts ?? FONT_PAIRS[deck.fontPair as FontPairKey] ?? FONT_PAIRS[DEFAULT_FONT_PAIR];
  return { background, titleColor, bodyColor, accent, headingFont: fonts.heading, bodyFont: fonts.body };
}

// Auto-derives a second palette for slides marked `tone: "contrast"` (see
// SlideTone) — same hue family as the deck's own choice, at the opposite
// end of the light/dark range from the base palette, so a deck can vary
// which slides get a dark vs. light background without the model having to
// pick extra hexes itself (which risked an unrelated, clashing color). The
// hue is taken from the deck's own `background` when it's actually
// colorful (the model's deliberate "whole deck" color, same as the
// reference-style decks that bookend light content with a dark cover/
// closer in that same hue); a default/near-neutral background (the common
// case — most decks only set `accent`) falls back to the accent's hue
// instead, so the generated slide still reads as part of this deck's
// palette rather than an arbitrary gray. Piped back through resolveColors
// so it gets the exact same title/body/accent-contrast legibility
// guarantees as the base palette — never hand-rolled separately.
function resolveContrastColors(deck: Pick<SlideDeck, "background" | "accent" | "fontPair" | "fonts">, base: ThemeColors): ThemeColors {
  const baseBg = normalizeHex(deck.background) ?? DEFAULT_BACKGROUND;
  const [bgHue, bgSat] = rgbToHsl(hexToRgbTuple(baseBg));
  const accentHex = normalizeHex(deck.accent) ?? DEFAULT_ACCENT;
  const [accentHue] = rgbToHsl(hexToRgbTuple(accentHex));
  const hue = bgSat > 0.08 ? bgHue : accentHue;
  const isDarkBase = relativeLuminance(hexToRgbTuple(base.background)) < 0.5;
  const sat = isDarkBase ? 0.28 : 0.3;
  const lightness = isDarkBase ? 0.96 : 0.13;
  const contrastBackground = rgbToHex(hslToRgb(hue, sat, lightness));
  return resolveColors({ background: contrastBackground, accent: deck.accent, fontPair: deck.fontPair });
}

// ── Accent contrast safety ───────────────────────────────────────────────
// The model can pick any accent hex, including one with poor contrast
// against its chosen background (e.g. pale yellow on white). Since `accent`
// is used as text color (slide headings), not a filled panel, an illegible
// accent would make headings unreadable. Nudge lightness toward a minimum
// contrast ratio while preserving hue/saturation, so the color the model
// picked is used verbatim whenever it's already legible, and only adjusted
// (never swapped for a generic black/white) when it isn't.

type RgbTuple = [number, number, number];

function hexToRgbTuple(hex: string): RgbTuple {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: RgbTuple): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHsl([r, g, b]: RgbTuple): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RgbTuple {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function rgbToHex([r, g, b]: RgbTuple): string {
  return [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Blends `mix` into `base` by `amount` (0 = base, 1 = mix) into one solid
// opaque hex. Used for table-cell tints instead of a translucent fill —
// pptxgenjs's table cells don't reliably honor `fill.transparency` the way
// shape/text fills do, so a "light tint" built that way can render as a
// full-opacity color in real PowerPoint. A precomputed solid blend has no
// such ambiguity.
function blendHex(base: string, mix: string, amount: number): string {
  const [br, bg, bb] = hexToRgbTuple(base);
  const [mr, mg, mb] = hexToRgbTuple(mix);
  return rgbToHex([br + (mr - br) * amount, bg + (mg - bg) * amount, bb + (mb - bb) * amount]);
}

const MIN_CONTRAST = 3.5;

function ensureContrast(accentHex: string, backgroundHex: string, mode: "light" | "dark"): string {
  const bgLum = relativeLuminance(hexToRgbTuple(backgroundHex));
  let rgb = hexToRgbTuple(accentHex);
  if (contrastRatio(relativeLuminance(rgb), bgLum) >= MIN_CONTRAST) return accentHex.toUpperCase();

  const [h, s, initialL] = rgbToHsl(rgb);
  let l = initialL;
  const step = mode === "light" ? -0.05 : 0.05; // darken on a light background, lighten on a dark one
  for (let i = 0; i < 18 && l > 0.02 && l < 0.98; i++) {
    l += step;
    rgb = hslToRgb(h, s, l);
    if (contrastRatio(relativeLuminance(rgb), bgLum) >= MIN_CONTRAST) break;
  }
  return rgbToHex(rgb);
}

// White or near-black, whichever contrasts better against a given fill —
// used for text sitting directly on the accent color itself (the "section"
// layout's full-bleed background), since accent varies from a light custom
// color to a dark theme color like "minimal"'s near-black.
function contrastingTextColor(fillHex: string): string {
  const fillLum = relativeLuminance(hexToRgbTuple(fillHex));
  return contrastRatio(fillLum, relativeLuminance(hexToRgbTuple("FFFFFF"))) >= contrastRatio(fillLum, relativeLuminance(hexToRgbTuple("111827")))
    ? "FFFFFF"
    : "111827";
}

// The "recommendation" layout's spotlight box (the highlighted decision
// value) always contrasts against the deck's own background rather than
// following the accent — a callout needs to visually pop regardless of
// which accent hue was picked, and deriving it from the background (instead
// of a literal hardcoded near-black) still keeps a dark-themed deck's
// spotlight box readable (near-white on a dark background, not more black
// on black).
function spotlightColors(colors: ThemeColors): { fill: string; text: string } {
  const isDarkBg = relativeLuminance(hexToRgbTuple(colors.background)) < 0.5;
  return isDarkBg ? { fill: "F9FAFB", text: "111827" } : { fill: "111827", text: "F9FAFB" };
}

// A pie/doughnut chart needs one distinguishable color per slice, and a
// stacked bar needs one per series — rotates hue evenly around the wheel
// starting from the deck's own accent, keeping saturation/lightness close to
// it, so the palette still reads as "this deck's colors" rather than a
// generic default set.
function chartPalette(accentHex: string, count: number): string[] {
  const [h, s, l] = rgbToHsl(hexToRgbTuple(accentHex));
  const sat = Math.max(s, 0.45);
  const n = Math.max(count, 1);
  return Array.from({ length: n }, (_, i) => rgbToHex(hslToRgb((h + i / n) % 1, sat, l)));
}

const ICON_BADGE_SIZE = 0.9;

// Draws the icon glyph inside a themed badge circle, top-right corner by
// default — every layout below leaves that corner clear (shrinking its
// title/header width when an icon is present, see call sites). `onAccentBg`
// switches the badge fill (and the icon's own color, solid rather than the
// badge's translucent wash) to whatever contrasts against the accent, for
// layouts whose whole background already is the accent. `size` lets callers
// (namely addChrome's smaller header-bar badge) shrink the badge without a
// separate function — the icon image scales with it so the glyph stays
// centered. `iconCache` must already hold this icon pre-rendered in the
// exact color this call resolves to (see buildIconCache in buildPptx) —
// every call site in this file draws from the same fixed two-color set
// (colors.accent / its contrasting color), so this never renders on demand.
function addIconBadge(s: PptxGenJS.Slide, icon: IllustrationIcon, colors: ThemeColors, iconCache: IconCache, opts?: { x?: number; y?: number; onAccentBg?: boolean; size?: number }): void {
  const size = opts?.size ?? ICON_BADGE_SIZE;
  const x = opts?.x ?? 10 - 0.6 - size;
  const y = opts?.y ?? 0.3;
  const iconColor = opts?.onAccentBg ? contrastingTextColor(colors.accent) : colors.accent;
  s.addShape("ellipse", { x, y, w: size, h: size, fill: { color: iconColor, transparency: opts?.onAccentBg ? 70 : 85 }, line: { type: "none" } });
  const png = getIconPng(iconCache, icon, iconColor);
  if (png) {
    const glyphSize = size * 0.55;
    const inset = (size - glyphSize) / 2;
    s.addImage({ data: `image/png;base64,${png}`, x: x + inset, y: y + inset, w: glyphSize, h: glyphSize });
  }
}

// Bottom-right "N / total" with no surrounding bar — used only for layouts
// that draw their own full-bleed background (the "section" divider), where
// addChrome's footer bar would be invisible against it. `colorOverride` lets
// section slides pass a color that contrasts with their accent-fill
// background instead of the usual body-text color.
function addPageNumber(s: PptxGenJS.Slide, pageNum: number, total: number, colors: ThemeColors, colorOverride?: string): void {
  s.addText(`${pageNum} / ${total}`, {
    x: 8.7, y: 5.32, w: 0.8, h: 0.28,
    fontSize: 9, color: colorOverride ?? colors.bodyColor, fontFace: colors.bodyFont, align: "right", transparency: colorOverride ? 30 : 35,
  });
}

// Persistent branded chrome — an accent-filled header bar carrying the
// slide's own title (if it has one) and icon badge, plus a thin footer bar
// with the page number — drawn identically on every content layout so the
// deck reads as one consistent, designed artifact rather than 15 unrelated
// layouts. Colors always come from the deck's own resolved accent/background
// (see resolveColors), never a hardcoded palette, so this generalizes to
// whatever look the user asked for. Not used by the title slide (its own
// distinct cover treatment) or "section" dividers (already full-bleed
// accent — a second accent bar on top of that would be invisible).
const CHROME_HEADER_H = 0.62;
const CHROME_FOOTER_H = 0.26;
const CONTENT_TOP = 0.85;
const CONTENT_BOTTOM = 5.25;

function addChrome(
  s: PptxGenJS.Slide,
  colors: ThemeColors,
  iconCache: IconCache,
  opts: { title?: string; icon?: IllustrationIcon; pageNum: number; total: number; showPageNumbers: boolean }
): void {
  s.addShape("rect", { x: 0, y: 0, w: 10, h: CHROME_HEADER_H, fill: { color: colors.accent }, line: { type: "none" } });
  const onAccent = contrastingTextColor(colors.accent);
  const badgeSize = 0.42;
  if (opts.title) {
    s.addText(stripMarkdownLine(opts.title), {
      x: 0.5, y: 0, w: opts.icon ? 8.1 : 9, h: CHROME_HEADER_H,
      fontSize: 20, bold: true, color: onAccent, fontFace: colors.headingFont, valign: "middle",
    });
  }
  if (opts.icon) {
    addIconBadge(s, opts.icon, colors, iconCache, { x: 10 - 0.35 - badgeSize, y: (CHROME_HEADER_H - badgeSize) / 2, size: badgeSize, onAccentBg: true });
  }
  if (opts.showPageNumbers) {
    s.addShape("rect", { x: 0, y: 5.625 - CHROME_FOOTER_H, w: 10, h: CHROME_FOOTER_H, fill: { color: colors.accent, transparency: 88 }, line: { type: "none" } });
    s.addText(`${opts.pageNum} / ${opts.total}`, {
      x: 8.7, y: 5.625 - CHROME_FOOTER_H, w: 0.8, h: CHROME_FOOTER_H,
      fontSize: 9, color: colors.bodyColor, fontFace: colors.bodyFont, align: "right", valign: "middle", transparency: 25,
    });
  }
}

// ── Canvas layout rendering ───────────────────────────────────────────────
const CANVAS_TEXT_SIZE_PT: Record<CanvasTextSize, number> = { xl: 36, lg: 24, md: 16, sm: 12, xs: 9.5 };
const MIN_CANVAS_ELEMENT_SIZE = 0.1;

// Grid snapping helper functions
function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

function snapBoxToGrid(box: CanvasBox, gridSize: number = GRID_SIZE): CanvasBox {
  return {
    x: snapToGrid(box.x, gridSize),
    y: snapToGrid(box.y, gridSize),
    w: snapToGrid(box.w, gridSize),
    h: snapToGrid(box.h, gridSize),
  };
}

// Alignment helpers for canvas elements
function alignHorizontal(element: CanvasBox, container: CanvasBox, alignment: "left" | "center" | "right"): CanvasBox {
  switch (alignment) {
    case "left":
      return { ...element, x: container.x };
    case "center":
      return { ...element, x: container.x + (container.w - element.w) / 2 };
    case "right":
      return { ...element, x: container.x + container.w - element.w };
  }
}

function alignVertical(element: CanvasBox, container: CanvasBox, alignment: "top" | "middle" | "bottom"): CanvasBox {
  switch (alignment) {
    case "top":
      return { ...element, y: container.y };
    case "middle":
      return { ...element, y: container.y + (container.h - element.h) / 2 };
    case "bottom":
      return { ...element, y: container.y + container.h - element.h };
  }
}

// Calculate alignment guide positions for canvas editing
function getAlignmentGuides(elements: CanvasBox[], canvas: CanvasBox): {
  horizontal: number[];
  vertical: number[];
} {
  const horizontal = new Set<number>();
  const vertical = new Set<number>();
  
  // Add canvas edges
  horizontal.add(canvas.x);
  horizontal.add(canvas.x + canvas.w);
  horizontal.add(canvas.x + canvas.w / 2);
  vertical.add(canvas.y);
  vertical.add(canvas.y + canvas.h);
  vertical.add(canvas.y + canvas.h / 2);
  
  // Add element edges and centers
  elements.forEach(el => {
    horizontal.add(el.x);
    horizontal.add(el.x + el.w);
    horizontal.add(el.x + el.w / 2);
    vertical.add(el.y);
    vertical.add(el.y + el.h);
    vertical.add(el.y + el.h / 2);
  });
  
  return {
    horizontal: Array.from(horizontal).sort((a, b) => a - b),
    vertical: Array.from(vertical).sort((a, b) => a - b),
  };
}

function resolveFillRole(role: FillRole | undefined, colors: ThemeColors): { color: string; transparency?: number } | null {
  switch (role) {
    case "accent": return { color: colors.accent };
    case "accentSoft": return { color: colors.accent, transparency: 85 };
    case "card": return { color: blendHex(colors.background, colors.bodyColor, 0.06) };
    case "background": return { color: colors.background };
    default: return null; // "none" or undefined
  }
}

function resolveCanvasTextColor(role: TextRole | undefined, colors: ThemeColors): string {
  switch (role) {
    case "title": return colors.titleColor;
    case "accent": return colors.accent;
    case "onAccent": return contrastingTextColor(colors.accent);
    default: return colors.bodyColor;
  }
}

function renderCanvasText(s: PptxGenJS.Slide, colors: ThemeColors, el: CanvasTextElement): void {
  const family = (el.fontRole ?? "body") === "heading" ? colors.headingFont : colors.bodyFont;
  const text = stripMarkdownLine(el.text);
  
  // Apply grid snapping if enabled
  const position = el.snapToGrid ? snapBoxToGrid(el) : el;
  
  const startSize = CANVAS_TEXT_SIZE_PT[el.size ?? "md"];
  const fontSize = fitFontSize(text, position.w, position.h, { avgEm: avgEmForFont(family), startSize });
  s.addText(text, {
    x: position.x, y: position.y, w: position.w, h: position.h, margin: 0,
    fontSize, fontFace: family, bold: el.bold, italic: el.italic,
    color: resolveCanvasTextColor(el.textRole, colors),
    align: el.align ?? "left", valign: el.valign ?? "top",
  });
}

function renderCanvasShape(s: PptxGenJS.Slide, colors: ThemeColors, el: CanvasShapeElement): void {
  const isLine = el.shape === "line";
  const fill = isLine ? undefined : resolveFillRole(el.fillRole ?? "accentSoft", colors);
  const borderRole = el.borderRole ?? (isLine ? "accent" : "none");
  const line = borderRole === "none"
    ? { type: "none" as const }
    : { color: borderRole === "accent" ? colors.accent : colors.bodyColor, width: 1 };
  
  // Apply grid snapping if enabled (optional for shapes)
  const position = el; // Shapes don't have snapToGrid in current interface, but could be added
  
  s.addShape(el.shape, {
    x: position.x, y: position.y, w: position.w, h: position.h, line,
    ...(fill ? { fill } : {}),
    ...(el.shape === "roundRect" ? { rectRadius: 0.06 } : {}),
  });
}

function renderCanvasIcon(s: PptxGenJS.Slide, colors: ThemeColors, iconCache: IconCache, el: CanvasIconElement): void {
  const size = Math.min(el.w, el.h);
  if (el.badge === false) {
    // No badge context here (canvas elements have no fillRole/textRole on
    // an icon), so this always draws in the deck's accent — same default
    // addIconBadge uses when its caller doesn't opt into onAccentBg.
    const png = getIconPng(iconCache, el.icon, colors.accent);
    if (png) {
      const glyphSize = size * 0.7;
      s.addImage({ data: `image/png;base64,${png}`, x: el.x + (el.w - glyphSize) / 2, y: el.y + (el.h - glyphSize) / 2, w: glyphSize, h: glyphSize });
    }
  } else {
    addIconBadge(s, el.icon, colors, iconCache, { x: el.x, y: el.y, size });
  }
}

// Shared by both the fixed "table" layout and canvas table elements — the
// fixed layout calls this with its own literal x/y/w/h (unchanged from
// before this was extracted), so its output is byte-identical to before.
function renderTableAt(
  s: PptxGenJS.Slide, colors: ThemeColors, box: CanvasBox,
  headers: string[], rows: (string | TableCell)[][], columnColors?: string[]
): void {
  const headerRow: PptxGenJS.TableRow = headers.map((h, i) => {
    const fill = columnColors?.[i] ?? colors.accent;
    return {
      text: stripMarkdownLine(h),
      options: { bold: true, color: contrastingTextColor(fill), fontFace: colors.headingFont, fill: { color: fill }, fontSize: 13, valign: "middle" },
    };
  });
  const bodyRows: PptxGenJS.TableRow[] = rows.map((row, i) =>
    row.map((raw) => {
      const cell: TableCell = typeof raw === "string" ? { text: raw } : raw;
      let prefix = "";
      if (cell.highlight) prefix += "★ ";
      if (cell.status === "yes") prefix += "✓ ";
      else if (cell.status === "no") prefix += "✗ ";
      else if (cell.status === "warning") prefix += "! ";
      const color = cell.status === "no" ? "DC2626" : cell.status === "yes" ? "16A34A" : cell.status === "warning" ? "D97706" : cell.highlight ? colors.accent : colors.bodyColor;
      const fill = cell.highlight
        ? blendHex(colors.background, colors.accent, 0.16)
        : i % 2 === 0
          ? colors.background
          : blendHex(colors.background, colors.accent, 0.05);
      return {
        text: stripMarkdownLine(prefix + cell.text),
        options: { color, fontFace: colors.bodyFont, fontSize: 12, bold: !!cell.highlight, fill: { color: fill }, valign: "middle" },
      };
    })
  );
  s.addTable([headerRow, ...bodyRows], { x: box.x, y: box.y, w: box.w, h: box.h, border: { type: "solid", color: colors.bodyColor, pt: 0.5 }, autoPage: false });
}

// Shared by "stats_row"/"grid"/"table"'s optional `insights` field — draws
// 1-2 trailing synthesis banners at the BOTTOM of the given box and returns
// the reduced bottom bound the caller's own main content should use instead
// of the box's original bottom, so the two never overlap. Called first
// (before the caller lays out its own content) for exactly that reason.
// First banner is primary/accent-styled; a second (if present) is a
// quieter secondary tone — mirrors a verdict statement followed by a
// caveat, not two banners of equal weight.
function renderInsightBanners(
  s: PptxGenJS.Slide, colors: ThemeColors, insights: InsightBanner[] | undefined,
  box: { x: number; w: number; bottom: number }
): number {
  if (!insights || insights.length === 0) return box.bottom;
  // Capped here, at render time — matches this file's own convention that
  // no array is capped in slideDeck.ts except canvas's element list.
  const items = insights.slice(0, 2);
  const gap = 0.15;
  const bannerH = 1.0;
  const totalH = items.length * bannerH + (items.length - 1) * gap;
  const contentBottom = box.bottom - totalH - 0.2;
  let y = contentBottom + 0.2;
  items.forEach((ins, i) => {
    const isPrimary = i === 0;
    const fill = isPrimary ? colors.accent : blendHex(colors.background, colors.bodyColor, 0.06);
    const textColor = isPrimary ? contrastingTextColor(colors.accent) : colors.titleColor;
    s.addShape("rect", { x: box.x, y, w: box.w, h: bannerH, fill: { color: fill }, line: { type: "none" } });
    const runs: { text: string; options?: { bold?: boolean } }[] = [];
    if (ins.lead) runs.push({ text: stripMarkdownLine(ins.lead) + " ", options: { bold: true } });
    runs.push({ text: stripMarkdownLine(ins.text) });
    s.addText(runs, { x: box.x + 0.2, y, w: box.w - 0.4, h: bannerH, fontSize: 11.5, color: textColor, fontFace: colors.bodyFont, valign: "middle" });
    y += bannerH + gap;
  });
  return contentBottom;
}

// Shared by both the fixed "chart" layout and canvas chart elements — same
// literal-argument equivalence as renderTableAt above.
function renderChartAt(
  s: PptxGenJS.Slide, colors: ThemeColors, box: CanvasBox,
  chartType: "bar" | "line" | "pie" | "doughnut" | "bar-stacked" | "scatter" | "bubble" | "radar" | "area",
  categories: string[], values: number[] | undefined, series: ChartSeries[] | undefined, title: string | undefined,
  style?: ChartStyle
): void {
  const showLegend = style?.showLegend !== false;
  const showDataLabels = style?.showDataLabels !== false;
  const showGridLines = style?.showGridLines !== false;
  
  if (chartType === "bar-stacked" && series && series.length > 0) {
    const stackedPalette = chartPalette(colors.accent, series.length);
    const seriesColors = series.map((sr, idx) => sr.color ?? stackedPalette[idx]);
    s.addChart(
      "bar",
      series.map((sr) => ({ name: sr.name, labels: categories, values: sr.values })),
      {
        x: box.x, y: box.y, w: box.w, h: box.h,
        barDir: "col", barGrouping: "stacked", chartColors: seriesColors,
        showLegend, legendPos: "b", showValue: showDataLabels,
        catAxisLabelColor: colors.bodyColor, valAxisLabelColor: colors.bodyColor,
        valGridLine: showGridLines ? { color: colors.bodyColor, size: 0.5 } : { style: "none" },
      }
    );
  } else if (chartType === "scatter" && values && values.length >= 2) {
    // pptxgenjs's scatter contract is NOT a {x,y}-point array per series —
    // data[0] is the shared X-axis values (a plain number[], always
    // skipped as its own series: see `data.filter((_obj, idx) => idx > 0)`
    // in its own source), and data[1..] are one <c:ser> per Y-value
    // series. Passing a single {x,y}-object series as data[0] (the
    // previous shape here) left that filter with nothing to iterate —
    // zero <c:ser> elements ever get written, producing a schema-valid-
    // looking but data-empty chart that PowerPoint flags as corrupt.
    const xValues = categories.map((cat) => parseFloat(cat) || 0);
    s.addChart(
      "scatter",
      [{ name: "X", values: xValues }, { name: title ?? "Data", values }],
      {
        x: box.x, y: box.y, w: box.w, h: box.h,
        chartColors: [colors.accent],
        showLegend, legendPos: "b", showValue: showDataLabels,
        catAxisLabelColor: colors.bodyColor, valAxisLabelColor: colors.bodyColor,
        valGridLine: showGridLines ? { color: colors.bodyColor, size: 0.5 } : { style: "none" },
        lineDataSymbolSize: style?.markerSize || 6,
      }
    );
  } else if (chartType === "area" && values) {
    // Area chart is similar to line but with filled area
    s.addChart(
      "line",
      [{ name: title ?? "Series 1", labels: categories, values: values }],
      {
        x: box.x, y: box.y, w: box.w, h: box.h,
        chartColors: [colors.accent],
        showLegend, legendPos: "b", showValue: showDataLabels,
        dataLabelColor: colors.bodyColor, catAxisLabelColor: colors.bodyColor, valAxisLabelColor: colors.bodyColor,
        valGridLine: showGridLines ? { color: colors.bodyColor, size: 0.5 } : { style: "none" },
        lineSize: 2,
      }
    );
  } else if (chartType === "radar" && values) {
    // Radar chart: values for each category (axis). pptxgenjs's embedded-
    // Excel-worksheet writer reads data[0].labels.length unconditionally
    // for every non-scatter chart type (see createExcelWorksheet in its
    // own source) — omitting labels here isn't just an incomplete axis,
    // it's a hard crash on export.
    const radarData = [{ name: title ?? "Data", labels: categories, values: values }];
    s.addChart(
      "radar",
      radarData,
      {
        x: box.x, y: box.y, w: box.w, h: box.h,
        chartColors: [colors.accent],
        showLegend, legendPos: "b", showValue: showDataLabels,
        dataLabelColor: colors.bodyColor,
      }
    );
  } else {
    const isSliced = chartType === "pie" || chartType === "doughnut";
    const fallbackPalette = chartPalette(colors.accent, series && series.length > 0 ? series.length : categories.length);
    const seriesColors = series && series.length > 0
      ? series.map((sr, idx) => sr.color ?? fallbackPalette[idx])
      : isSliced ? fallbackPalette : [colors.accent];
    
    const chartData = series && series.length > 0
      ? series.map((sr) => ({ name: sr.name, labels: categories, values: sr.values }))
      : [{ name: title ?? "Series 1", labels: categories, values: values ?? [] }];
    
    s.addChart(
      chartType === "bar-stacked" ? "bar" : chartType,
      chartData,
      {
        x: box.x, y: box.y, w: box.w, h: box.h,
        chartColors: seriesColors,
        // Pie/doughnut have no axis to label slices with — a legend is the
        // only way to know which color is which category. Bar/line already
        // show category names on the x-axis, so a legend there would be
        // redundant.
        showLegend: isSliced || showLegend, legendPos: "b", showValue: showDataLabels,
        dataLabelColor: colors.bodyColor, catAxisLabelColor: colors.bodyColor, valAxisLabelColor: colors.bodyColor,
        valGridLine: showGridLines ? { color: colors.bodyColor, size: 0.5 } : { style: "none" },
        barDir: "col",
        lineSize: style?.lineStyle === "dashed" ? 3 : style?.lineStyle === "dotted" ? 2 : 2,
        lineDataSymbolSize: style?.markerSize || 6,
      }
    );
  }
}

function renderCanvasSlide(
  s: PptxGenJS.Slide, colors: ThemeColors, iconCache: IconCache, slide: CanvasSlide,
  slideIdx: number, totalSlides: number, showPageNumbers: boolean
): void {
  s.background = { color: colors.background };
  const top = slide.fullBleed ? 0 : CONTENT_TOP;
  const bottom = slide.fullBleed ? 5.625 : CONTENT_BOTTOM;
  if (!slide.fullBleed) {
    addChrome(s, colors, iconCache, { title: slide.title, icon: slide.icon, pageNum: slideIdx + 1, total: totalSlides, showPageNumbers });
  } else if (showPageNumbers) {
    addPageNumber(s, slideIdx + 1, totalSlides, colors);
  }
  for (const raw of slide.elements) {
    // Nudge onto the chrome-safe area rather than dropping — an element the
    // model placed under where the (opaque) header bar paints would
    // otherwise render invisibly with no indication anything is wrong.
    const y = slide.fullBleed ? raw.y : Math.min(Math.max(raw.y, top), bottom - MIN_CANVAS_ELEMENT_SIZE);
    const h = slide.fullBleed ? raw.h : Math.min(raw.h, bottom - y);
    const el = slide.fullBleed ? raw : { ...raw, y, h };
    if (el.type === "text") renderCanvasText(s, colors, el);
    else if (el.type === "shape") renderCanvasShape(s, colors, el);
    else if (el.type === "icon") renderCanvasIcon(s, colors, iconCache, el);
    else if (el.type === "chart") renderChartAt(s, colors, el, el.chartType, el.categories, el.values, el.series, el.title, el.style);
    else renderTableAt(s, colors, el, el.headers, el.rows);
  }
  if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
}

export interface BuildPptxOptions {
  // Export-time preference, not deck content — unlike everything else in
  // SlideDeck (which the model chooses while generating), page numbers are
  // purely a rendering choice, so this is passed in separately by whoever
  // is downloading rather than stored on the deck JSON itself. Defaults on.
  pageNumbers?: boolean;
}

// Every slide carries an optional top-level `icon`; three item-array layouts
// (grid/team/iconlist) also let each item carry its own; canvas elements can
// be icons too. Three render branches also fall back to a default icon when
// none is given — "presenter" defaults its badge to "team", "team" defaults
// each member without their own icon to "team" too, and "iconlist" defaults
// each item without one to "checklist" — those defaults are matched here
// exactly (`?? "team"` / `?? "checklist"`, same as the render code) so this
// scan can't under-collect and leave buildIconCache missing an icon the
// render loop then can't find and silently skips. Scanned up front so
// buildIconCache only ever renders the icons this particular deck actually
// uses, in the (at most two) colors it actually needs them in — most decks
// use a handful of the 16, and an icon-free deck (illustrations off)
// renders none at all.
function collectUsedIcons(deck: SlideDeck): Set<IllustrationIcon> {
  const icons = new Set<IllustrationIcon>();
  for (const slide of deck.slides) {
    if (slide.icon) icons.add(slide.icon);
    if (slide.layout === "grid") for (const item of slide.items) if (item.icon) icons.add(item.icon);
    if (slide.layout === "team") for (const m of slide.members) icons.add(m.icon ?? "team");
    if (slide.layout === "iconlist") for (const item of slide.items) icons.add(item.icon ?? "checklist");
    if (slide.layout === "presenter" && !slide.icon) icons.add("team");
    // "recap" always draws a "checklist" icon beside every takeaway line,
    // and defaults its example's own badge to "checklist" too when omitted.
    if (slide.layout === "recap") {
      icons.add("checklist");
      if (slide.example) icons.add(slide.example.icon ?? "checklist");
    }
    if (slide.layout === "canvas") for (const el of slide.elements) if (el.type === "icon") icons.add(el.icon);
    // New layouts with icon support
    if (slide.layout === "matrix") for (const row of slide.cells) for (const cell of row) if (cell.icon) icons.add(cell.icon);
    if (slide.layout === "gallery") for (const item of slide.items) if (item.icon) icons.add(item.icon);
  }
  return icons;
}

export async function buildPptx(deck: SlideDeck, opts?: BuildPptxOptions): Promise<Buffer> {
  const showPageNumbers = opts?.pageNumbers !== false;
  const baseColors = resolveColors(deck);
  // Only computed when at least one slide actually opts into it — an
  // unthemed or single-palette deck never pays for a second resolveColors
  // pass or a second set of cached icon renders.
  const usesContrastTone = deck.slides.some((s) => s.tone === "contrast");
  const contrastColors = usesContrastTone ? resolveContrastColors(deck, baseColors) : null;
  const pptx = new PptxGenJS();
  const totalSlides = deck.slides.length;

  // Pre-rendered once, up front, so the (synchronous) per-slide render loop
  // below never has to await mid-slide — see buildIconCache's own comment.
  // Icons render tinted to whichever palette's accent their slide actually
  // uses, so both palettes' accent (and on-accent) colors need caching
  // whenever a deck mixes tones — an icon cache miss silently draws a badge
  // with no glyph inside it (see getIconPng), not a visible error.
  const usedIcons = collectUsedIcons(deck);
  const iconColors = [baseColors.accent, contrastingTextColor(baseColors.accent)];
  if (contrastColors) iconColors.push(contrastColors.accent, contrastingTextColor(contrastColors.accent));
  const iconCache = usedIcons.size > 0 ? await buildIconCache(usedIcons, iconColors) : new Map();

  // Not pptx.defineSlideMaster({ background }) — pptxgenjs v4's
  // createSlideMaster() never actually applies a master's `background`
  // (the call that would is dead/commented out in its own source), so a
  // themed deck would silently render with a plain white background if set
  // that way. Setting `background` directly on each Slide instance below
  // does take effect (a per-slide property, not master-derived). Same
  // reasoning is why font is set per addText call (fontFace) rather than
  // via a master text style.
  if (deck.title) {
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: baseColors.background };
    const isFormalCover = !!(deck.subtitle || (deck.meta && deck.meta.length > 0));
    if (isFormalCover) {
      // A document-reference grid (Presented To / Division / Date, etc.) —
      // left-aligned with a thin accent spine, closer to a formal report
      // cover than the plain centered title every other deck gets.
      titleSlide.addShape("rect", { x: 0, y: 0, w: 0.12, h: 5.625, fill: { color: baseColors.accent }, line: { type: "none" } });
      titleSlide.addText(stripMarkdownLine(deck.title), {
        x: 0.6, y: 1.9, w: 8.6, h: 1.3, fontSize: 30, bold: true, color: baseColors.titleColor, fontFace: baseColors.headingFont,
      });
      if (deck.subtitle) {
        titleSlide.addText(stripMarkdownLine(deck.subtitle), { x: 0.6, y: 3.05, w: 8.6, h: 0.5, fontSize: 13, italic: true, color: baseColors.bodyColor, fontFace: baseColors.bodyFont });
      }
      if (deck.meta && deck.meta.length > 0) {
        const meta = deck.meta.slice(0, 4);
        const colW = 4.1;
        const rowH = 0.55;
        const gridTop = 3.85;
        meta.forEach((m, i) => {
          const x = 0.6 + (i % 2) * colW;
          const y = gridTop + Math.floor(i / 2) * rowH;
          titleSlide.addText(stripMarkdownLine(m.label).toUpperCase(), { x, y, w: colW - 0.2, h: 0.22, fontSize: 8.5, bold: true, color: baseColors.accent, fontFace: baseColors.headingFont, charSpacing: 1.5 });
          titleSlide.addText(stripMarkdownLine(m.value), { x, y: y + 0.22, w: colW - 0.2, h: 0.28, fontSize: 12, color: baseColors.titleColor, fontFace: baseColors.bodyFont });
        });
      }
    } else {
      titleSlide.addText(stripMarkdownLine(deck.title), {
        x: 0.5, y: 2.3, w: 9, h: 1.5,
        fontSize: 32, bold: true, color: baseColors.titleColor, fontFace: baseColors.headingFont, align: "center",
      });
    }
  }

  deck.slides.forEach((slide, slideIdx) => {
    const s = pptx.addSlide();
    // Shadows the outer baseColors for the rest of this iteration — every
    // "colors.*" reference below (there are dozens, across every layout
    // branch) resolves to whichever palette this one slide's tone picks,
    // with no per-layout changes needed.
    const colors = slide.tone === "contrast" && contrastColors ? contrastColors : baseColors;
    const chrome = (title?: string) =>
      addChrome(s, colors, iconCache, { title, icon: slide.icon, pageNum: slideIdx + 1, total: totalSlides, showPageNumbers });

    if (slide.layout === "custom") {
      s.background = { color: colors.background };
      const layout = getLayout(slide.custom);
      if (layout) {
        const helpers: LayoutHelpers = {
          chrome,
          clean: stripMarkdownLine,
          contentTop: CONTENT_TOP,
          contentBottom: CONTENT_BOTTOM,
          slideWidth: 10,
          slideHeight: 5.625,
        };
        try {
          layout.render({ slide: s, colors, pageNumber: slideIdx + 1, totalSlides, helpers }, slide.data);
        } catch {
          /* a broken layout costs its own slide, not the deck */
        }
      }
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "stat") {
      s.background = { color: colors.background };
      chrome();
      const boxH = 2.4;
      const boxY = CONTENT_TOP + (CONTENT_BOTTOM - CONTENT_TOP - boxH) / 2;
      s.addShape("rect", { x: 0.6, y: boxY, w: 6, h: boxH, fill: { color: colors.accent, transparency: 85 }, line: { type: "none" } });
      s.addText(stripMarkdownLine(slide.value), { x: 0.9, y: boxY + 0.3, w: 5.4, h: 1.1, fontSize: 44, bold: true, color: colors.accent, fontFace: colors.headingFont });
      s.addText(stripMarkdownLine(slide.caption), { x: 0.9, y: boxY + 1.35, w: 5.4, h: 0.9, fontSize: 14, color: colors.bodyColor, fontFace: colors.bodyFont });
    } else if (slide.layout === "stats_row") {
      s.background = { color: colors.background };
      chrome(slide.title);
      // Insight banners (if any) claim space at the bottom of the content
      // area first — the stat row then lays out within whatever's left,
      // shrinking cardH (and font sizes, past a "compact" threshold) rather
      // than overflowing past the reduced bottom.
      const effectiveBottom = renderInsightBanners(s, colors, slide.insights, { x: 0.5, w: 9, bottom: CONTENT_BOTTOM });
      const stats = slide.stats.slice(0, 6);
      const n = Math.max(stats.length, 1);
      const gap = 0.25;
      const blockW = (9 - gap * (n - 1)) / n;
      const cardH = Math.min(2.3, effectiveBottom - CONTENT_TOP);
      const y = CONTENT_TOP + (effectiveBottom - CONTENT_TOP - cardH) / 2;
      const compact = cardH < 1.8;
      // Proportional to cardH, at the exact same ratios as the original
      // fixed numbers (0.35/1.0/0.05/0.8 out of cardH=2.3) — pixel-identical
      // to before this change whenever no insights shrink the card, and
      // scales safely (each text box's bottom edge stays inside cardH) when
      // they do.
      const topPad = cardH * (0.35 / 2.3);
      const valueH = cardH * (1.0 / 2.3);
      const valueGap = cardH * (0.05 / 2.3);
      const labelH = cardH * (0.8 / 2.3);
      const palette = chartPalette(colors.accent, n);
      stats.forEach((stat, i) => {
        const x = 0.5 + i * (blockW + gap);
        s.addShape("rect", { x, y, w: blockW, h: cardH, fill: { color: palette[i], transparency: 88 }, line: { type: "none" } });
        s.addShape("rect", { x, y, w: blockW, h: 0.08, fill: { color: palette[i] }, line: { type: "none" } });
        s.addText(stripMarkdownLine(stat.value), { x: x + 0.1, y: y + topPad, w: blockW - 0.2, h: valueH, fontSize: compact ? 22 : 28, bold: true, color: colors.titleColor, fontFace: colors.headingFont, align: "center" });
        s.addText(stripMarkdownLine(stat.label), { x: x + 0.1, y: y + topPad + valueH + valueGap, w: blockW - 0.2, h: labelH, fontSize: compact ? 10 : 11.5, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center" });
      });
    } else if (slide.layout === "process") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const steps = slide.steps.slice(0, 6);
      const n = Math.max(steps.length, 1);
      const hasCaption = !!slide.caption;
      const captionH = hasCaption ? 0.55 : 0;
      const gap = 0.18;
      const cardW = (9 - gap * (n - 1)) / n;
      const cardY = CONTENT_TOP + 0.3;
      const cardH = CONTENT_BOTTOM - cardY - captionH - (hasCaption ? 0.15 : 0);
      const palette = chartPalette(colors.accent, n);
      const badgeSize = 0.42;
      steps.forEach((step, i) => {
        const x = 0.5 + i * (cardW + gap);
        const cardFill = palette[i];
        const onCard = contrastingTextColor(cardFill);
        s.addShape("rect", { x, y: cardY, w: cardW, h: cardH, fill: { color: cardFill }, line: { type: "none" } });
        s.addShape("ellipse", { x: x + (cardW - badgeSize) / 2, y: cardY - badgeSize / 2, w: badgeSize, h: badgeSize, fill: { color: colors.background }, line: { color: cardFill, width: 1.5 } });
        s.addText(String(i + 1).padStart(2, "0"), { x: x + (cardW - badgeSize) / 2, y: cardY - badgeSize / 2, w: badgeSize, h: badgeSize, fontSize: 12, bold: true, color: cardFill, fontFace: colors.headingFont, align: "center", valign: "middle" });
        s.addText(stripMarkdownLine(step.title), { x: x + 0.1, y: cardY + 0.3, w: cardW - 0.2, h: 0.5, fontSize: 12, bold: true, color: onCard, fontFace: colors.headingFont, align: "center" });
        if (step.description) {
          s.addText(stripMarkdownLine(step.description), { x: x + 0.1, y: cardY + 0.8, w: cardW - 0.2, h: cardH - 0.9, fontSize: 9.5, color: onCard, fontFace: colors.bodyFont, align: "center", transparency: 15 });
        }
        if (i < n - 1) {
          s.addShape("rightArrow", { x: x + cardW + 0.02, y: cardY + cardH / 2 - 0.07, w: gap - 0.04, h: 0.14, fill: { color: colors.bodyColor, transparency: 30 }, line: { type: "none" } });
        }
      });
      if (slide.caption) {
        const capY = cardY + cardH + 0.15;
        s.addShape("rect", { x: 0.5, y: capY, w: 9, h: captionH, fill: { color: colors.accent, transparency: 92 }, line: { color: colors.accent, width: 0.75, transparency: 60 } });
        s.addText(stripMarkdownLine(slide.caption), { x: 0.65, y: capY, w: 8.7, h: captionH, fontSize: 11, italic: true, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "middle" });
      }
    } else if (slide.layout === "recommendation") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const options = slide.options.slice(0, 3);
      const n = Math.max(options.length, 1);
      const gap = 0.3;
      const cardW = (9 - gap * (n - 1)) / n;
      const top = CONTENT_TOP;
      const cardH = CONTENT_BOTTOM - top;
      const spot = spotlightColors(colors);
      const onAccentHeader = contrastingTextColor(colors.accent);
      options.forEach((opt, i) => {
        const x = 0.5 + i * (cardW + gap);
        s.addShape("rect", { x, y: top, w: cardW, h: cardH, fill: { color: colors.background }, line: { color: colors.accent, width: 0.75, transparency: 40 } });
        const headerH = 0.5;
        s.addShape("rect", { x, y: top, w: cardW, h: headerH, fill: { color: colors.accent }, line: { type: "none" } });
        s.addText(stripMarkdownLine(opt.heading), { x: x + 0.12, y: top, w: cardW - 0.24, h: headerH, fontSize: 12, bold: true, color: onAccentHeader, fontFace: colors.headingFont, valign: "middle" });
        let y = top + headerH + 0.12;
        if (opt.items && opt.items.length > 0) {
          const itemsH = Math.min(0.22 * opt.items.length, cardH * 0.3);
          s.addText(
            opt.items.map((it) => ({ text: stripMarkdownLine(it), options: { bullet: true, color: colors.bodyColor, fontFace: colors.bodyFont, fontSize: 9.5, breakLine: true } })),
            { x: x + 0.15, y, w: cardW - 0.3, h: itemsH }
          );
          y += itemsH + 0.1;
        }
        const boxH = Math.max(1.2, top + cardH - y - 0.5);
        s.addShape("roundRect", { x: x + 0.12, y, w: cardW - 0.24, h: boxH, rectRadius: 0.05, fill: { color: spot.fill }, line: { type: "none" } });
        let ty = y + 0.15;
        if (opt.outcomeLabel) {
          s.addText(stripMarkdownLine(opt.outcomeLabel).toUpperCase(), { x: x + 0.25, y: ty, w: cardW - 0.5, h: 0.25, fontSize: 8.5, bold: true, color: colors.accent, fontFace: colors.headingFont, charSpacing: 1.5 });
          ty += 0.3;
        }
        s.addText(stripMarkdownLine(opt.outcome), { x: x + 0.25, y: ty, w: cardW - 0.5, h: 0.5, fontSize: 15, bold: true, color: spot.text, fontFace: colors.headingFont });
        ty += 0.5;
        if (opt.outcomeDetail) {
          s.addText(stripMarkdownLine(opt.outcomeDetail), { x: x + 0.25, y: ty, w: cardW - 0.5, h: 0.3, fontSize: 9.5, color: spot.text, fontFace: colors.bodyFont, transparency: 25 });
        }
        if (opt.rationale) {
          s.addText(stripMarkdownLine(opt.rationale), { x: x + 0.12, y: y + boxH + 0.08, w: cardW - 0.24, h: Math.max(0.3, top + cardH - (y + boxH + 0.08)), fontSize: 8.5, italic: true, color: colors.bodyColor, fontFace: colors.bodyFont });
        }
      });
    } else if (slide.layout === "comparison") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      s.addShape("line", { x: 5, y: top, w: 0, h: CONTENT_BOTTOM - top, line: { color: colors.bodyColor, width: 0.75, transparency: 60 } });
      for (const [col, x] of [[slide.left, 0.5], [slide.right, 5.3]] as const) {
        s.addShape("rect", { x, y: top, w: 4.2, h: 0.55, fill: { color: colors.accent }, line: { type: "none" } });
        s.addText(stripMarkdownLine(col.heading), { x, y: top, w: 4.2, h: 0.55, fontSize: 14, bold: true, color: colors.background, fontFace: colors.headingFont, align: "center", valign: "middle" });
        if (col.steps && col.steps.length > 0) {
          // A numbered sequence instead of a plain bullet list — for two
          // parallel workflows/processes being compared side by side. Solid
          // accent-filled badge (like "ranked", not "process"'s outlined
          // ring) since this sits on colors.background, the same context
          // "ranked" already handles.
          const steps = col.steps.slice(0, 5);
          const n = steps.length;
          const listTop = top + 0.65;
          const rowH = (CONTENT_BOTTOM - listTop) / n;
          const badgeSize = Math.max(0.3, Math.min(0.4, rowH - 0.15));
          steps.forEach((step, i) => {
            const y = listTop + i * rowH;
            s.addShape("ellipse", { x, y: y + 0.02, w: badgeSize, h: badgeSize, fill: { color: colors.accent }, line: { type: "none" } });
            s.addText(String(i + 1), { x, y: y + 0.02, w: badgeSize, h: badgeSize, fontSize: Math.round(badgeSize * 32), bold: true, color: colors.background, fontFace: colors.headingFont, align: "center", valign: "middle" });
            const textX = x + badgeSize + 0.15;
            const textW = 4.2 - badgeSize - 0.15;
            s.addText(stripMarkdownLine(step.label), { x: textX, y, w: textW, h: step.detail ? rowH * 0.55 : rowH, fontSize: 12, bold: true, color: colors.titleColor, fontFace: colors.headingFont, valign: step.detail ? "bottom" : "middle" });
            if (step.detail) {
              s.addText(stripMarkdownLine(step.detail), { x: textX, y: y + rowH * 0.55, w: textW, h: rowH * 0.45, fontSize: 9.5, color: colors.bodyColor, fontFace: colors.bodyFont, transparency: 15 });
            }
          });
        } else {
          s.addText(
            (col.bullets ?? []).map((b) => ({ text: stripMarkdownLine(b), options: { bullet: true, color: colors.bodyColor, fontFace: colors.bodyFont, fontSize: 14, breakLine: true } })),
            { x, y: top + 0.65, w: 4.2, h: CONTENT_BOTTOM - top - 0.65 }
          );
        }
      }
    } else if (slide.layout === "quote") {
      s.background = { color: colors.background };
      chrome();
      const top = CONTENT_TOP + 0.3;
      s.addShape("rect", { x: 0.6, y: top, w: 0.06, h: 2.2, fill: { color: colors.accent }, line: { type: "none" } });
      s.addText(stripMarkdownLine(slide.quote), { x: 1, y: top, w: 8, h: 1.8, fontSize: 22, italic: true, color: colors.titleColor, fontFace: colors.headingFont, valign: "middle" });
      if (slide.author) {
        s.addText(stripMarkdownLine(slide.author), { x: 1, y: top + 1.9, w: 8, h: 0.5, fontSize: 13, color: colors.bodyColor, fontFace: colors.bodyFont, align: "right" });
      }
    } else if (slide.layout === "section") {
      s.background = { color: colors.accent };
      const onAccent = contrastingTextColor(colors.accent);
      if (slide.eyebrow) {
        s.addText(stripMarkdownLine(slide.eyebrow).toUpperCase(), { x: 0.5, y: 0.75, w: 9, h: 0.3, fontSize: 13, bold: true, color: onAccent, fontFace: colors.headingFont, align: "center", charSpacing: 2, transparency: 25 });
      }
      s.addText(stripMarkdownLine(slide.title), { x: 0.5, y: 2.2, w: 9, h: 1.5, fontSize: 30, bold: true, color: onAccent, fontFace: colors.headingFont, align: "center" });
      // Centered above the title rather than the usual top-right corner —
      // top-right would look disconnected from a centered divider slide.
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache, { x: (10 - ICON_BADGE_SIZE) / 2, y: 1.1, onAccentBg: true });
      // No addChrome here — the slide is already full-bleed accent, so a
      // second accent bar on top would be invisible; use the bare page
      // number instead, recolored to contrast with the accent fill.
      if (showPageNumbers) addPageNumber(s, slideIdx + 1, totalSlides, colors, onAccent);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
      return;
    } else if (slide.layout === "thank_you") {
      // Same full-bleed treatment as "section" above, plus an optional
      // subtitle/contact stack below the title — same reasoning for the
      // early return (no addChrome, bare recolored page number, notes
      // handled here rather than the generic call at the loop's end).
      s.background = { color: colors.accent };
      const onAccent = contrastingTextColor(colors.accent);
      const hasSubtitle = !!slide.subtitle;
      const hasContact = !!slide.contact && slide.contact.length > 0;
      const titleY = hasSubtitle || hasContact ? 1.9 : 2.2;
      s.addText(stripMarkdownLine(slide.title?.trim() || "Thank You"), {
        x: 0.5, y: titleY, w: 9, h: 1.3, fontSize: 34, bold: true, color: onAccent, fontFace: colors.headingFont, align: "center",
      });
      if (hasSubtitle) {
        s.addText(stripMarkdownLine(slide.subtitle!), {
          x: 0.5, y: titleY + 1.3, w: 9, h: 0.5, fontSize: 15, color: onAccent, fontFace: colors.bodyFont, align: "center", transparency: 10,
        });
      }
      if (hasContact) {
        s.addText(stripMarkdownLine(slide.contact!.join("   ·   ")), {
          x: 0.5, y: titleY + (hasSubtitle ? 1.85 : 1.3), w: 9, h: 0.4, fontSize: 12, color: onAccent, fontFace: colors.bodyFont, align: "center", transparency: 25,
        });
      }
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache, { x: (10 - ICON_BADGE_SIZE) / 2, y: 0.75, onAccentBg: true });
      if (showPageNumbers) addPageNumber(s, slideIdx + 1, totalSlides, colors, onAccent);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
      return;
    } else if (slide.layout === "table") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const effectiveBottom = renderInsightBanners(s, colors, slide.insights, { x: 0.5, w: 9, bottom: CONTENT_BOTTOM });
      renderTableAt(s, colors, { x: 0.5, y: top, w: 9, h: effectiveBottom - top }, slide.headers, slide.rows, slide.columnColors);
    } else if (slide.layout === "chart") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const chartStyle: ChartStyle = {
        showLegend: slide.showLegend,
        showDataLabels: slide.showDataLabels,
        showGridLines: slide.showGridLines,
      };
      renderChartAt(s, colors, { x: 0.5, y: top, w: 9, h: CONTENT_BOTTOM - top }, slide.chartType, slide.categories, slide.values, slide.series, slide.title, chartStyle);
    } else if (slide.layout === "matrix") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const rows = slide.rows.slice(0, 3);
      const cols = slide.cols.slice(0, 3);
      const cellW = 8 / Math.max(cols.length, 1);
      const cellH = 1.2;
      const startX = 1;
      const startY = CONTENT_TOP + 0.5;
      
      // Render headers
      cols.forEach((col, i) => {
        s.addText(stripMarkdownLine(col), {
          x: startX + i * cellW, y: startY, w: cellW, h: 0.4,
          fontSize: 11, bold: true, color: colors.titleColor, fontFace: colors.headingFont, align: "center", valign: "middle",
        });
      });
      
      // Render cells
      slide.cells.forEach((row, i) => {
        row.forEach((cell, j) => {
          const cellFill = cell.highlight ? blendHex(colors.background, colors.accent, 0.16) : colors.background;
          s.addShape("rect", { x: startX + j * cellW, y: startY + 0.4 + i * cellH, w: cellW, h: cellH, fill: { color: cellFill }, line: { type: "solid", color: colors.bodyColor, pt: 0.5 } });
          s.addText(stripMarkdownLine(cell.content), {
            x: startX + j * cellW + 0.1, y: startY + 0.4 + i * cellH + 0.1, w: cellW - 0.2, h: cellH - 0.2,
            fontSize: 10, color: cell.highlight ? colors.accent : colors.bodyColor, fontFace: colors.bodyFont, valign: "middle",
          });
        });
      });
      
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "flowchart") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const height = CONTENT_BOTTOM - top;
      const nodeW = 1.5;
      const nodeH = 0.8;

      // Resolved once per node — reused for both the node's own box AND as
      // the target coordinates when a DIFFERENT node points at it, so a
      // connector line always ends exactly where its target box actually
      // got drawn instead of re-deriving (and disagreeing with) unclamped
      // raw coordinates. x is clamped to keep the node's full width inside
      // the 10"-wide canvas — position.x alone (already 0-10 from
      // normalization) says nothing about the node's own footprint, so an
      // uncapped box near the right edge would run off the slide; y is
      // likewise clamped against the chrome-safe content area.
      const positions = new Map(slide.nodes.map((node) => [
        node.id,
        {
          x: Math.min(Math.max(0, node.position.x), 10 - nodeW),
          y: Math.min(top + node.position.y * height, CONTENT_BOTTOM - nodeH),
        },
      ]));

      // Render nodes
      slide.nodes.forEach((node) => {
        const { x: nodeX, y: nodeY } = positions.get(node.id)!;

        // Different shapes for different node types
        const shape = node.type === "decision" ? "ellipse" : node.type === "start" || node.type === "end" ? "roundRect" : "rect";
        const fill = node.type === "decision" ? colors.accent : node.type === "start" || node.type === "end" ? blendHex(colors.background, colors.accent, 0.2) : blendHex(colors.background, colors.bodyColor, 0.06);

        s.addShape(shape, { x: nodeX, y: nodeY, w: nodeW, h: nodeH, fill: { color: fill }, line: { type: "solid", color: colors.bodyColor, pt: 1 } });
        s.addText(stripMarkdownLine(node.text), {
          x: nodeX + 0.1, y: nodeY + 0.1, w: nodeW - 0.2, h: nodeH - 0.2,
          fontSize: 9, color: contrastingTextColor(fill), fontFace: colors.bodyFont, align: "center", valign: "middle",
        });

        // Render connections (simple lines)
        if (node.connections) {
          node.connections.forEach((connId) => {
            const target = positions.get(connId);
            if (target) {
              // OOXML shape extents (<a:ext cx cy>) are ST_PositiveCoordinate
              // — negative, i.e. an upward or leftward-pointing connector
              // computed as (end - start) directly — is invalid content
              // that PowerPoint flags for repair (and silently drops
              // whatever it can't fix on load, which is what blanked
              // other slides in the same file). The box stays anchored at
              // its top-left corner with always-nonnegative w/h; flipH/
              // flipV mirror the line within that box so it still visually
              // runs from the real start point to the real end point,
              // arrowhead included, in any direction.
              const startX = nodeX + nodeW / 2;
              const startY = nodeY + nodeH;
              const endX = target.x + nodeW / 2;
              const endY = target.y;
              s.addShape("line", {
                x: Math.min(startX, endX), y: Math.min(startY, endY),
                w: Math.abs(endX - startX) || 0.01,
                h: Math.abs(endY - startY) || 0.01,
                flipH: startX > endX,
                flipV: startY > endY,
                line: { type: "solid", color: colors.bodyColor, pt: 1, endArrowType: "arrow" },
              });
            }
          });
        }
      });

      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "calendar") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const events = slide.events.slice(0, 6);
      const eventH = 0.8;
      let startY = top + 0.5;
      
      if (slide.period) {
        s.addText(stripMarkdownLine(slide.period), {
          x: 0.5, y: startY, w: 9, h: 0.4,
          fontSize: 12, bold: true, color: colors.accent, fontFace: colors.headingFont, align: "center",
        });
        startY += 0.5;
      }
      
      events.forEach((event, i) => {
        const eventY = startY + i * eventH;
        const eventFill = event.highlight ? blendHex(colors.background, colors.accent, 0.16) : blendHex(colors.background, colors.bodyColor, 0.06);
        
        s.addShape("rect", { x: 0.5, y: eventY, w: 9, h: eventH - 0.1, fill: { color: eventFill }, line: { type: "solid", color: colors.bodyColor, pt: 0.5 } });
        s.addText(stripMarkdownLine(event.date), {
          x: 0.7, y: eventY + 0.1, w: 1.5, h: eventH - 0.3,
          fontSize: 10, bold: true, color: colors.accent, fontFace: colors.headingFont, valign: "middle",
        });
        s.addText(stripMarkdownLine(event.title), {
          x: 2.3, y: eventY + 0.1, w: 5.5, h: eventH - 0.3,
          fontSize: 11, color: colors.titleColor, fontFace: colors.headingFont, valign: "middle",
        });
      });
      
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "gallery") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const items = slide.items.slice(0, 4);
      const n = items.length;
      const gap = 0.3;
      const arrangement = slide.arrangement ?? "horizontal";
      const top = CONTENT_TOP + 0.5;
      const bottom = CONTENT_BOTTOM;

      // Each arrangement just picks a different (x, y, w, h) per item —
      // the per-item rendering below (shape + title/description/caption) is
      // identical regardless of arrangement.
      const cols = arrangement === "grid" ? Math.min(2, n) : arrangement === "vertical" ? 1 : n;
      const rows = Math.ceil(n / cols);
      const itemW = (9 - gap * (cols - 1)) / cols;
      const itemH = arrangement === "horizontal" ? 3 : (bottom - top - gap * (rows - 1)) / rows;

      items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const itemX = 0.5 + col * (itemW + gap);
        const itemY = top + row * (itemH + gap);
        const itemFill = blendHex(colors.background, colors.bodyColor, 0.06);

        s.addShape("rect", { x: itemX, y: itemY, w: itemW, h: itemH, fill: { color: itemFill }, line: { type: "solid", color: colors.bodyColor, pt: 1 } });
        if (item.icon) addIconBadge(s, item.icon, colors, iconCache, { x: itemX + 0.15, y: itemY + 0.15, size: 0.3 });
        s.addText(stripMarkdownLine(item.title || ""), {
          x: itemX + 0.2, y: itemY + 0.2, w: itemW - 0.4, h: 0.4,
          fontSize: 12, bold: true, color: colors.titleColor, fontFace: colors.headingFont,
        });
        s.addText(stripMarkdownLine(item.description || ""), {
          x: itemX + 0.2, y: itemY + 0.6, w: itemW - 0.4, h: itemH - 1.2,
          fontSize: 10, color: colors.bodyColor, fontFace: colors.bodyFont,
        });
        if (item.caption) {
          s.addText(stripMarkdownLine(item.caption), {
            x: itemX + 0.2, y: itemY + itemH - 0.5, w: itemW - 0.4, h: 0.3,
            fontSize: 9, italic: true, color: colors.bodyColor, fontFace: colors.bodyFont,
          });
        }
      });

      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "quote_carousel") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const quotes = slide.quotes.slice(0, 4);
      const quoteH = 2;
      const top = CONTENT_TOP + 0.5;
      
      quotes.forEach((quote, i) => {
        const quoteY = top + i * quoteH;
        const quoteFill = blendHex(colors.background, colors.accent, 0.1);
        
        s.addShape("rect", { x: 0.5, y: quoteY, w: 9, h: quoteH - 0.2, fill: { color: quoteFill }, line: { type: "solid", color: colors.accent, pt: 1 } });
        s.addText(`"${stripMarkdownLine(quote.quote)}"`, {
          x: 0.7, y: quoteY + 0.2, w: 8.6, h: quoteH - 1.0,
          fontSize: 14, italic: true, color: colors.titleColor, fontFace: colors.bodyFont,
        });
        if (quote.author) {
          s.addText(`— ${stripMarkdownLine(quote.author)}`, {
            x: 0.7, y: quoteY + quoteH - 0.7, w: 8.6, h: 0.3,
            fontSize: 11, color: colors.bodyColor, fontFace: colors.bodyFont,
          });
        }
      });
      
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "advanced_table") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const effectiveBottom = renderInsightBanners(s, colors, slide.insights, { x: 0.5, w: 9, bottom: CONTENT_BOTTOM });
      
      // Convert advanced table cells to regular table cells for rendering
      const regularRows = slide.rows.map(row => 
        row.map(cell => {
          const baseCell: TableCell = { text: cell.text };
          if (cell.highlight) baseCell.highlight = true;
          if (cell.status) baseCell.status = cell.status;
          return baseCell;
        })
      );
      
      renderTableAt(s, colors, { x: 0.5, y: CONTENT_TOP, w: 9, h: effectiveBottom - CONTENT_TOP }, slide.headers, regularRows, slide.columnColors);
      
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
    } else if (slide.layout === "canvas") {
      // Handles its own background/chrome/notes internally (like "section"
      // above) — return here to skip the generic `if (slide.notes)` call at
      // the bottom of this loop, which would otherwise double-add notes.
      renderCanvasSlide(s, colors, iconCache, slide, slideIdx, totalSlides, showPageNumbers);
      return;
    } else if (slide.layout === "grid") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const effectiveBottom = renderInsightBanners(s, colors, slide.insights, { x: 0.5, w: 9, bottom: CONTENT_BOTTOM });
      // Capped at 6 — beyond that, cards get too small to read comfortably
      // on a single slide.
      const items = slide.items.slice(0, 6);
      const cols = items.length <= 2 ? Math.max(items.length, 1) : items.length <= 4 ? 2 : 3;
      const rows = Math.ceil(items.length / cols);
      const gap = 0.3;
      const cardW = (9 - gap * (cols - 1)) / cols;
      const cardH = (effectiveBottom - top - gap * (rows - 1)) / rows;
      const stripH = Math.min(0.5, cardH * 0.32);
      const onAccentCard = contrastingTextColor(colors.accent);
      items.forEach((item, i) => {
        const x = 0.5 + (i % cols) * (cardW + gap);
        const y = top + Math.floor(i / cols) * (cardH + gap);
        // Solid header strip (not a translucent tint) plus a plain body —
        // deliberately no numbered badge, unlike "ranked": a grid's items
        // are parallel, not ordered, so numbering them would be misleading.
        s.addShape("rect", { x, y, w: cardW, h: cardH, fill: { color: colors.background }, line: { color: colors.accent, width: 0.75, transparency: 55 } });
        s.addShape("rect", { x, y, w: cardW, h: stripH, fill: { color: colors.accent }, line: { type: "none" } });
        const iconW = item.icon ? stripH : 0;
        if (item.icon) {
          const png = getIconPng(iconCache, item.icon, onAccentCard);
          if (png) {
            const glyphSize = stripH * 0.65;
            s.addImage({ data: `image/png;base64,${png}`, x: x + 0.08 + (stripH - glyphSize) / 2, y: y + (stripH - glyphSize) / 2, w: glyphSize, h: glyphSize });
          }
        }
        s.addText(stripMarkdownLine(item.title), { x: x + 0.12 + iconW, y, w: cardW - 0.24 - iconW, h: stripH, fontSize: 13, bold: true, color: onAccentCard, fontFace: colors.headingFont, valign: "middle" });
        if (item.description) {
          s.addText(stripMarkdownLine(item.description), { x: x + 0.15, y: y + stripH + 0.1, w: cardW - 0.3, h: cardH - stripH - 0.2, fontSize: 11, color: colors.bodyColor, fontFace: colors.bodyFont });
        }
      });
    } else if (slide.layout === "ranked") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const listTop = CONTENT_TOP;
      const listBottom = CONTENT_BOTTOM;
      const rowH = (listBottom - listTop) / Math.max(slide.items.length, 1);
      const badgeSize = Math.max(0.35, Math.min(0.5, rowH - 0.15));
      slide.items.forEach((item, i) => {
        const y = listTop + i * rowH;
        const badgeY = y + rowH / 2 - badgeSize / 2;
        s.addShape("ellipse", { x: 0.6, y: badgeY, w: badgeSize, h: badgeSize, fill: { color: colors.accent }, line: { type: "none" } });
        s.addText(String(i + 1), { x: 0.6, y: badgeY, w: badgeSize, h: badgeSize, fontSize: Math.round(badgeSize * 40), bold: true, color: colors.background, fontFace: colors.headingFont, align: "center", valign: "middle" });
        s.addText(stripMarkdownLine(item), { x: 0.6 + badgeSize + 0.25, y, w: 8.65 - badgeSize, h: rowH, fontSize: 18, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "middle" });
      });
    } else if (slide.layout === "timeline") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const lineY = CONTENT_TOP + 1.75;
      s.addShape("line", { x: 0.7, y: lineY, w: 8.6, h: 0, line: { color: colors.accent, width: 2 } });
      // Capped at 6 — beyond that, the alternating labels start to
      // collide on a single row.
      const steps = slide.steps.slice(0, 6);
      const n = steps.length;
      const spacing = n > 1 ? 8.6 / (n - 1) : 0;
      const nodeSize = 0.22;
      const boxW = Math.min(n > 1 ? spacing - 0.15 : 2.2, 2.2);
      steps.forEach((step, i) => {
        const cx = n === 1 ? 5 : 0.7 + i * spacing;
        s.addShape("ellipse", { x: cx - nodeSize / 2, y: lineY - nodeSize / 2, w: nodeSize, h: nodeSize, fill: { color: colors.accent }, line: { color: colors.background, width: 2 } });
        const labelUp = i % 2 === 0;
        // Centered on cx, then clamped so the first/last node's label (whose
        // box would otherwise straddle the canvas edge) shifts inward
        // instead of running off-canvas — the box stays a consistent width,
        // it just isn't perfectly centered on its node for the endpoints.
        const x = Math.max(0.15, Math.min(cx - boxW / 2, 10 - 0.15 - boxW));
        if (labelUp) {
          if (step.detail) {
            s.addText(stripMarkdownLine(step.detail), { x, y: lineY - 1.05, w: boxW, h: 0.5, fontSize: 10.5, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center", valign: "bottom" });
          }
          s.addText(stripMarkdownLine(step.label), { x, y: lineY - 0.55, w: boxW, h: 0.4, fontSize: 14, bold: true, color: colors.titleColor, fontFace: colors.headingFont, align: "center", valign: "bottom" });
        } else {
          s.addText(stripMarkdownLine(step.label), { x, y: lineY + 0.15, w: boxW, h: 0.4, fontSize: 14, bold: true, color: colors.titleColor, fontFace: colors.headingFont, align: "center", valign: "top" });
          if (step.detail) {
            s.addText(stripMarkdownLine(step.detail), { x, y: lineY + 0.55, w: boxW, h: 0.5, fontSize: 10.5, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center", valign: "top" });
          }
        }
      });
    } else if (slide.layout === "columns") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      for (const [col, x] of [[slide.left, 0.5], [slide.right, 5.3]] as const) {
        let y = top;
        if (col.heading) {
          s.addText(stripMarkdownLine(col.heading), { x, y, w: 4.2, h: 0.45, fontSize: 15, bold: true, color: colors.accent, fontFace: colors.headingFont });
          y += 0.55;
        }
        s.addText(
          col.bullets.map((b) => ({ text: stripMarkdownLine(b), options: { bullet: true, color: colors.bodyColor, fontFace: colors.bodyFont, fontSize: 14, breakLine: true } })),
          { x, y, w: 4.2, h: CONTENT_BOTTOM - y }
        );
      }
    } else if (slide.layout === "problem_solution") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const problemH = 1.75;
      const arrowH = 0.5;
      const solutionTop = top + problemH + arrowH;
      s.addShape("roundRect", { x: 0.6, y: top, w: 8.8, h: problemH, rectRadius: 0.06, fill: { color: colors.bodyColor, transparency: 90 }, line: { type: "none" } });
      s.addText("PROBLEM", { x: 0.9, y: top + 0.12, w: 8.2, h: 0.3, fontSize: 11, bold: true, color: colors.bodyColor, fontFace: colors.headingFont, charSpacing: 2 });
      s.addText(stripMarkdownLine(slide.problem), { x: 0.9, y: top + 0.45, w: 8.2, h: problemH - 0.55, fontSize: 15, color: colors.titleColor, fontFace: colors.bodyFont, valign: "top" });
      s.addShape("downArrow", { x: 4.55, y: top + problemH + 0.05, w: 0.9, h: arrowH - 0.1, fill: { color: colors.accent }, line: { type: "none" } });
      const solutionH = Math.max(1.6, CONTENT_BOTTOM - solutionTop);
      s.addShape("roundRect", { x: 0.6, y: solutionTop, w: 8.8, h: solutionH, rectRadius: 0.06, fill: { color: colors.accent, transparency: 88 }, line: { color: colors.accent, width: 0.75, transparency: 40 } });
      s.addText("SOLUTION", { x: 0.9, y: solutionTop + 0.12, w: 8.2, h: 0.3, fontSize: 11, bold: true, color: colors.accent, fontFace: colors.headingFont, charSpacing: 2 });
      s.addText(stripMarkdownLine(slide.solution), { x: 0.9, y: solutionTop + 0.45, w: 8.2, h: solutionH - 0.55, fontSize: 15, color: colors.titleColor, fontFace: colors.bodyFont, valign: "top" });
    } else if (slide.layout === "team") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      // Same card-grid math as "grid" — capped at 6 for the same reason.
      const members = slide.members.slice(0, 6);
      const cols = members.length <= 2 ? Math.max(members.length, 1) : members.length <= 4 ? 2 : 3;
      const rows = Math.ceil(members.length / cols);
      const gap = 0.3;
      const cardW = (9 - gap * (cols - 1)) / cols;
      const cardH = (CONTENT_BOTTOM - top - gap * (rows - 1)) / rows;
      const avatarSize = Math.min(0.55, cardH * 0.28);
      members.forEach((member, i) => {
        const x = 0.5 + (i % cols) * (cardW + gap);
        const y = top + Math.floor(i / cols) * (cardH + gap);
        s.addShape("roundRect", { x, y, w: cardW, h: cardH, rectRadius: 0.08, fill: { color: colors.accent, transparency: 92 }, line: { color: colors.accent, width: 0.75, transparency: 40 } });
        s.addShape("ellipse", { x: x + 0.18, y: y + 0.18, w: avatarSize, h: avatarSize, fill: { color: colors.accent, transparency: 70 }, line: { type: "none" } });
        {
          const png = getIconPng(iconCache, member.icon ?? "team", colors.accent);
          if (png) {
            const glyphSize = avatarSize * 0.55;
            const inset = (avatarSize - glyphSize) / 2;
            s.addImage({ data: `image/png;base64,${png}`, x: x + 0.18 + inset, y: y + 0.18 + inset, w: glyphSize, h: glyphSize });
          }
        }
        const textX = x + 0.18 + avatarSize + 0.15;
        const textW = cardW - (0.18 + avatarSize + 0.15) - 0.15;
        s.addText(stripMarkdownLine(member.name), { x: textX, y: y + 0.15, w: textW, h: 0.3, fontSize: 13, bold: true, color: colors.titleColor, fontFace: colors.headingFont });
        if (member.role) {
          s.addText(stripMarkdownLine(member.role), { x: textX, y: y + 0.45, w: textW, h: 0.25, fontSize: 10.5, color: colors.accent, fontFace: colors.bodyFont });
        }
        if (member.description) {
          const descTop = y + 0.18 + avatarSize + 0.15;
          s.addText(stripMarkdownLine(member.description), { x: x + 0.18, y: descTop, w: cardW - 0.36, h: y + cardH - descTop - 0.1, fontSize: 10.5, color: colors.bodyColor, fontFace: colors.bodyFont });
        }
      });
    } else if (slide.layout === "presenter") {
      // A speaker credit slide — stays a chrome-free "spotlight" (no card
      // borders/fill, unlike "team"'s roster grid above) whether it's
      // introducing one person or a small panel.
      s.background = { color: colors.background };
      chrome();
      const presenters = slide.presenters.slice(0, 4);
      if (presenters.length <= 1) {
        const p = presenters[0];
        const centerY = CONTENT_TOP + (CONTENT_BOTTOM - CONTENT_TOP) / 2;
        let y = centerY - 1.3;
        addIconBadge(s, slide.icon ?? "team", colors, iconCache, { x: (10 - ICON_BADGE_SIZE) / 2, y });
        y += ICON_BADGE_SIZE + 0.25;
        s.addText(stripMarkdownLine(p.name), { x: 0.5, y, w: 9, h: 0.55, fontSize: 26, bold: true, color: colors.titleColor, fontFace: colors.headingFont, align: "center" });
        y += 0.6;
        const roleLine = [p.role, p.company].filter(Boolean).join(", ");
        if (roleLine) {
          s.addText(stripMarkdownLine(roleLine), { x: 0.5, y, w: 9, h: 0.35, fontSize: 14, color: colors.accent, fontFace: colors.bodyFont, align: "center" });
          y += 0.4;
        }
        if (p.bio) {
          s.addText(stripMarkdownLine(p.bio), { x: 1, y, w: 8, h: 0.5, fontSize: 12, italic: true, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center" });
          y += 0.55;
        }
        if (p.contact && p.contact.length > 0) {
          s.addText(stripMarkdownLine(p.contact.join("   ·   ")), { x: 0.5, y, w: 9, h: 0.35, fontSize: 11, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center", transparency: 25 });
        }
      } else {
        // 2-4 presenters: an evenly divided row, each column repeating the
        // same icon-badge → name → role/company → bio → contact stack at
        // reduced size — a panel/co-founder credit, not a "team" roster.
        const n = presenters.length;
        const gap = 0.3;
        const colW = (9 - gap * (n - 1)) / n;
        const badgeSize = 0.65;
        const top = CONTENT_TOP + 0.3;
        presenters.forEach((p, i) => {
          const x = 0.5 + i * (colW + gap);
          let y = top;
          addIconBadge(s, slide.icon ?? "team", colors, iconCache, { x: x + (colW - badgeSize) / 2, y, size: badgeSize });
          y += badgeSize + 0.2;
          s.addText(stripMarkdownLine(p.name), { x, y, w: colW, h: 0.4, fontSize: 16, bold: true, color: colors.titleColor, fontFace: colors.headingFont, align: "center" });
          y += 0.42;
          const roleLine = [p.role, p.company].filter(Boolean).join(", ");
          if (roleLine) {
            s.addText(stripMarkdownLine(roleLine), { x, y, w: colW, h: 0.55, fontSize: 10.5, color: colors.accent, fontFace: colors.bodyFont, align: "center" });
            y += 0.55;
          }
          if (p.bio) {
            s.addText(stripMarkdownLine(p.bio), { x, y, w: colW, h: 0.6, fontSize: 9.5, italic: true, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center" });
            y += 0.6;
          }
          if (p.contact && p.contact.length > 0) {
            s.addText(stripMarkdownLine(p.contact.join("   ·   ")), { x, y, w: colW, h: 0.45, fontSize: 8.5, color: colors.bodyColor, fontFace: colors.bodyFont, align: "center", transparency: 25 });
          }
        });
      }
    } else if (slide.layout === "hero") {
      // Full-bleed accent "impact moment" — same treatment as "thank_you"/
      // "section" (early return, bare recolored page number), but
      // left-aligned rather than centered, and with an optional bottom row
      // of stat or "pillar" cards. Deliberately uses onAccent uniformly for
      // every card — never a chartPalette-cycled hue — since palette[0] is
      // generated at the accent's own hue/lightness and would be invisible
      // (or near it) against this slide's accent-filled background; that
      // risk doesn't exist for "stats_row"/"tiers" below, which tint cards
      // against colors.background instead.
      s.background = { color: colors.accent };
      const onAccent = contrastingTextColor(colors.accent);
      const cards = slide.stats && slide.stats.length > 0
        ? slide.stats.slice(0, 4).map((st) => ({ big: st.value, small: st.label }))
        : (slide.pillars ?? []).slice(0, 4).map((p) => ({ big: p.label, small: p.description ?? "" }));
      const textW = slide.icon ? 7.7 : 9;
      let heroY = 0.85;
      if (slide.eyebrow) {
        s.addText(stripMarkdownLine(slide.eyebrow).toUpperCase(), { x: 0.5, y: heroY, w: textW, h: 0.3, fontSize: 11, bold: true, color: onAccent, fontFace: colors.headingFont, charSpacing: 2, transparency: 25 });
        heroY += 0.4;
      }
      s.addText(stripMarkdownLine(slide.title), { x: 0.5, y: heroY, w: textW, h: 1.3, fontSize: 32, bold: true, color: onAccent, fontFace: colors.headingFont });
      heroY += 1.35;
      if (slide.subtitle) {
        s.addText(stripMarkdownLine(slide.subtitle), { x: 0.5, y: heroY, w: textW, h: 0.7, fontSize: 14, color: onAccent, fontFace: colors.bodyFont, transparency: 12 });
      }
      if (slide.icon) addIconBadge(s, slide.icon, colors, iconCache, { onAccentBg: true });
      if (cards.length > 0) {
        const n = cards.length;
        const cardGap = 0.25;
        const rowY = 4.05;
        const rowH = 1.0;
        const cardW = (9 - cardGap * (n - 1)) / n;
        cards.forEach((card, i) => {
          const x = 0.5 + i * (cardW + cardGap);
          s.addShape("rect", { x, y: rowY, w: cardW, h: rowH, fill: { color: onAccent, transparency: 88 }, line: { type: "none" } });
          s.addText(stripMarkdownLine(card.big), { x: x + 0.12, y: rowY + 0.1, w: cardW - 0.24, h: 0.5, fontSize: 22, bold: true, color: onAccent, fontFace: colors.headingFont });
          if (card.small) {
            s.addText(stripMarkdownLine(card.small), { x: x + 0.12, y: rowY + 0.58, w: cardW - 0.24, h: 0.36, fontSize: 9.5, color: onAccent, fontFace: colors.bodyFont, transparency: 20 });
          }
        });
      }
      if (showPageNumbers) addPageNumber(s, slideIdx + 1, totalSlides, colors, onAccent);
      if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
      return;
    } else if (slide.layout === "tiers") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const tiers = slide.tiers.slice(0, 6);
      const n = Math.max(tiers.length, 1);
      const tierGap = 0.15;
      const rowH = (CONTENT_BOTTOM - top - tierGap * (n - 1)) / n;
      const palette = chartPalette(colors.accent, n);
      const barW = 0.12;
      const labelW = 2.3;
      tiers.forEach((tier, i) => {
        const y = top + i * (rowH + tierGap);
        const fill = palette[i];
        s.addShape("rect", { x: 0.5, y, w: 9, h: rowH, fill: { color: fill, transparency: 90 }, line: { type: "none" } });
        s.addShape("rect", { x: 0.5, y, w: barW, h: rowH, fill: { color: fill }, line: { type: "none" } });
        s.addText(stripMarkdownLine(tier.label), { x: 0.5 + barW + 0.15, y, w: labelW, h: rowH, fontSize: 13, bold: true, color: colors.titleColor, fontFace: colors.headingFont, valign: "middle" });
        if (tier.description) {
          s.addText(stripMarkdownLine(tier.description), { x: 0.5 + barW + 0.15 + labelW + 0.1, y, w: 9 - barW - 0.15 - labelW - 0.1 - 0.15, h: rowH, fontSize: 11, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "middle" });
        }
      });
    } else if (slide.layout === "recap") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const bottom = CONTENT_BOTTOM;
      const onAccent = contrastingTextColor(colors.accent);
      const takeaways = slide.takeaways.slice(0, 5);

      // Solid accent-filled checklist panel — shared between the two-panel
      // (example given) and full-width (example omitted) cases below, just
      // with a different x/w.
      const renderTakeaways = (x: number, w: number) => {
        s.addShape("rect", { x, y: top, w, h: bottom - top, fill: { color: colors.accent }, line: { type: "none" } });
        const pad = 0.28;
        s.addText("KEY TAKEAWAYS", { x: x + pad, y: top + 0.2, w: w - pad * 2, h: 0.3, fontSize: 11, bold: true, color: onAccent, fontFace: colors.headingFont, charSpacing: 1.5, transparency: 15 });
        const listTop = top + 0.65;
        const rowH = (bottom - 0.2 - listTop) / Math.max(takeaways.length, 1);
        const iconSize = Math.min(0.28, rowH - 0.1);
        takeaways.forEach((text, i) => {
          const y = listTop + i * rowH;
          const png = getIconPng(iconCache, "checklist", onAccent);
          if (png) s.addImage({ data: `image/png;base64,${png}`, x: x + pad, y: y + (rowH - iconSize) / 2, w: iconSize, h: iconSize });
          s.addText(stripMarkdownLine(text), { x: x + pad + iconSize + 0.15, y, w: w - pad * 2 - iconSize - 0.15, h: rowH, fontSize: 11.5, color: onAccent, fontFace: colors.bodyFont, valign: "middle" });
        });
      };

      if (slide.example) {
        const leftW = 4.5, gap = 0.2, rightX = 0.5 + leftW + gap, rightW = 9 - leftW - gap;
        const pad = 0.3, badgeSize = 0.5;
        s.addShape("rect", { x: 0.5, y: top, w: leftW, h: bottom - top, fill: { color: colors.accent, transparency: 92 }, line: { color: colors.accent, width: 0.75, transparency: 40 } });
        addIconBadge(s, slide.example.icon ?? "checklist", colors, iconCache, { x: 0.5 + pad, y: top + 0.25, size: badgeSize });
        s.addText(stripMarkdownLine(slide.example.heading ?? "Case in Point"), { x: 0.5 + pad + badgeSize + 0.15, y: top + 0.25, w: leftW - pad * 2 - badgeSize - 0.15, h: badgeSize, fontSize: 14, bold: true, color: colors.titleColor, fontFace: colors.headingFont, valign: "middle" });
        const textTop = top + 0.25 + badgeSize + 0.2;
        s.addText(stripMarkdownLine(slide.example.text), { x: 0.5 + pad, y: textTop, w: leftW - pad * 2, h: bottom - textTop - 0.2, fontSize: 12, color: colors.bodyColor, fontFace: colors.bodyFont });
        renderTakeaways(rightX, rightW);
      } else {
        renderTakeaways(0.5, 9);
      }
    } else if (slide.layout === "glossary") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const terms = slide.terms.slice(0, 8);
      const cols = 2;
      const rows = Math.ceil(terms.length / cols);
      const colGap = 0.4;
      const colW = (9 - colGap * (cols - 1)) / cols;
      const rowH = (CONTENT_BOTTOM - top) / Math.max(rows, 1);
      // Column-major (fills col 1 top-to-bottom, then col 2), matching how
      // a printed two-column glossary or index page reads.
      terms.forEach((t, i) => {
        const col = Math.floor(i / rows);
        const row = i % rows;
        const x = 0.5 + col * (colW + colGap);
        const y = top + row * rowH;
        s.addText(stripMarkdownLine(t.term), { x, y, w: colW, h: 0.3, fontSize: 13, bold: true, color: colors.accent, fontFace: colors.headingFont });
        s.addText(stripMarkdownLine(t.definition), { x, y: y + 0.32, w: colW, h: rowH - 0.42, fontSize: 11, color: colors.bodyColor, fontFace: colors.bodyFont });
      });
    } else if (slide.layout === "roadmap") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const bottom = CONTENT_BOTTOM;
      const steps = slide.steps.slice(0, 6);
      const n = Math.max(steps.length, 1);
      const rowH = (bottom - top) / n;
      const badgeSize = 0.4;
      if (n > 1) {
        // Drawn first so the numbered badges sit on top of it.
        s.addShape("line", {
          x: 0.5 + badgeSize / 2, y: top + badgeSize / 2, w: 0, h: bottom - top - badgeSize,
          line: { color: colors.bodyColor, width: 1, transparency: 60 },
        });
      }
      steps.forEach((step, i) => {
        const y = top + i * rowH;
        const isCurrent = slide.currentIndex === i;
        const numberColor = isCurrent ? contrastingTextColor(colors.accent) : colors.accent;
        s.addShape("ellipse", { x: 0.5, y, w: badgeSize, h: badgeSize, fill: { color: colors.accent, transparency: isCurrent ? 0 : 85 }, line: { type: "none" } });
        s.addText(String(i + 1), { x: 0.5, y, w: badgeSize, h: badgeSize, fontSize: 12, bold: true, color: numberColor, fontFace: colors.headingFont, align: "center", valign: "middle" });
        const textX = 0.5 + badgeSize + 0.25;
        const textW = 9 - badgeSize - 0.25;
        s.addText(stripMarkdownLine(step.label), {
          x: textX, y: y - 0.02, w: textW, h: step.description ? rowH * 0.5 : rowH,
          fontSize: 13, bold: true, color: isCurrent ? colors.accent : colors.titleColor, fontFace: colors.headingFont,
          valign: step.description ? "bottom" : "middle",
        });
        if (step.description) {
          s.addText(stripMarkdownLine(step.description), { x: textX, y: y + rowH * 0.48, w: textW, h: rowH * 0.5, fontSize: 10.5, color: colors.bodyColor, fontFace: colors.bodyFont, transparency: 15 });
        }
      });
    } else if (slide.layout === "iconlist") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const listBottom = CONTENT_BOTTOM;
      const items = slide.items.slice(0, 6);
      const rowH = (listBottom - top) / Math.max(items.length, 1);
      const badgeSize = Math.max(0.4, Math.min(0.55, rowH - 0.15));
      items.forEach((item, i) => {
        const y = top + i * rowH;
        const badgeY = y + rowH / 2 - badgeSize / 2;
        s.addShape("ellipse", { x: 0.6, y: badgeY, w: badgeSize, h: badgeSize, fill: { color: colors.accent, transparency: 85 }, line: { type: "none" } });
        {
          const png = getIconPng(iconCache, item.icon ?? "checklist", colors.accent);
          if (png) {
            const glyphSize = badgeSize * 0.55;
            const inset = (badgeSize - glyphSize) / 2;
            s.addImage({ data: `image/png;base64,${png}`, x: 0.6 + inset, y: badgeY + inset, w: glyphSize, h: glyphSize });
          }
        }
        s.addText(stripMarkdownLine(item.text), { x: 0.6 + badgeSize + 0.3, y, w: 8.6 - badgeSize, h: rowH, fontSize: 16, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "middle" });
      });
    } else if (slide.layout === "funnel") {
      s.background = { color: colors.background };
      chrome(slide.title);
      const top = CONTENT_TOP;
      const stages = slide.stages.slice(0, 6);
      const n = Math.max(stages.length, 1);
      const bottom = CONTENT_BOTTOM;
      const gap = 0.1;
      const rowH = (bottom - top - gap * (n - 1)) / n;
      const maxW = 8.6;
      const minW = maxW * 0.32;
      stages.forEach((stage, i) => {
        const w = n > 1 ? maxW - (i * (maxW - minW)) / (n - 1) : maxW;
        const x = 0.5 + (maxW - w) / 2;
        const y = top + i * (rowH + gap);
        s.addShape("rect", { x, y, w, h: rowH, fill: { color: colors.accent, transparency: 15 + (i * 60) / Math.max(n - 1, 1) }, line: { type: "none" } });
        const onFill = contrastingTextColor(colors.accent);
        s.addText(stripMarkdownLine(stage.label), { x: x + 0.15, y, w: w - 0.3, h: rowH, fontSize: 14, bold: true, color: onFill, fontFace: colors.headingFont, align: "center", valign: "middle" });
        if (stage.value) {
          s.addText(stripMarkdownLine(stage.value), { x: 5.5, y, w: 3.4, h: rowH, fontSize: 12, color: colors.bodyColor, fontFace: colors.bodyFont, align: "left", valign: "middle" });
        }
      });
    } else {
      s.background = { color: colors.background };
      chrome(slide.title);
      // Each bullet gets its own accent-colored dot and an evenly divided
      // row across the full content area, rather than one native bulleted
      // textbox — that left a short list looking sparse (all the rows
      // packed at the top with dead space below) and a plain grey bullet
      // character with no color tie to the deck's theme. Spreading rows
      // across the whole area fills a 2-bullet slide as deliberately as a
      // 6-bullet one.
      const listTop = CONTENT_TOP;
      const listBottom = CONTENT_BOTTOM;
      const rowH = (listBottom - listTop) / Math.max(slide.bullets.length, 1);
      slide.bullets.forEach((bullet, i) => {
        const y = listTop + i * rowH;
        s.addShape("ellipse", { x: 0.6, y: y + rowH / 2 - 0.07, w: 0.14, h: 0.14, fill: { color: colors.accent }, line: { type: "none" } });
        s.addText(stripMarkdownLine(bullet), { x: 0.95, y, w: 8.45, h: rowH, fontSize: 18, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "middle" });
      });
    }
    if (slide.notes) s.addNotes(stripMarkdownLine(slide.notes));
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
