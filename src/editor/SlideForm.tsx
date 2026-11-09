"use client";

import { fieldSpec, getAt, layoutOf, insertAt, moveWithin, newCanvasElement, newListItem, optionalFields, removeAt, setAt, setBox, LAYOUT_LABELS, type Box, type Path } from "../edit/deckEdit.js";
import PositionFields from "./PositionFields.js";
import ColorField from "./ColorField.js";
import PictureSelect from "./PictureSelect.js";
import type { SlideContent } from "../pptx/presentationBuilder.js";
import { SLIDE_OPTION_KEYS } from "../edit/slideOptionsEdit.js";

// The fields of one slide as a form. It does not know any layout: it walks the slide's own fields and gives each the control
// its kind asks for (lib/deckEdit.ts fieldSpec), lists get add, move and remove, objects nest. So every layout, including
// ones added later, can be edited without extra code. `onChange` receives the whole changed slide.

export interface PictureChoice {
  id: string;
  label: string;
  /** The picture itself (a data URL), for the thumbnails in the background picture list. */
  thumb?: string;
  width?: number;
  height?: number;
}

const inputClass =
  "w-full text-sm px-2.5 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";
const smallButton =
  "shrink-0 w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center rounded-md text-xs text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

interface Ctx {
  slide: unknown;
  pictures: PictureChoice[];
  set: (path: Path, value: unknown) => void;
  remove: (path: Path) => void;
  insert: (listPath: Path, index: number, value: unknown) => void;
  move: (listPath: Path, from: number, to: number) => void;
  /** The element picked on the slide (or in the form) and the way to pick one; its box is moved by position fields. */
  activeElement: number | null;
  select: (index: number) => void;
  box: (index: number, box: Box) => void;
}

function Control({ k, value, path, ctx, label }: { k: string; value: unknown; path: Path; ctx: Ctx; label?: string }) {
  const spec = fieldSpec(k, value);
  const text = label ?? spec.label;
  if (spec.kind === "hidden") return null;

  if (spec.kind === "list") {
    const list = Array.isArray(value) ? value : [];
    const isElements = path.length === 1 && path[0] === "elements";
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-[var(--ds-text-secondary)]">{text}</legend>
        {list.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              {item && typeof item === "object" && !Array.isArray(item) ? (
                <div
                  onFocusCapture={isElements ? () => ctx.select(i) : undefined}
                  className={`rounded-lg border p-2.5 space-y-2 bg-[var(--ds-bg-elevated)] ${isElements && ctx.activeElement === i ? "border-[var(--ds-accent)]" : "border-[var(--ds-border-muted)]"}`}
                >
                  {isElements && typeof (item as Record<string, unknown>).x === "number" && (
                    <PositionFields label={`${String((item as Record<string, unknown>).type ?? "Element")} ${i + 1}`} box={item as Box} onChange={(b) => ctx.box(i, b)} />
                  )}
                  {Object.entries(item as Record<string, unknown>).map(([ik, iv]) => (
                    <Control key={ik} k={ik} value={iv} path={[...path, i, ik]} ctx={ctx} />
                  ))}
                </div>
              ) : Array.isArray(item) ? (
                <Control k="row" value={item} path={[...path, i]} ctx={ctx} label={`Row ${i + 1}`} />
              ) : typeof item === "number" ? (
                <input type="number" aria-label={`${text} ${i + 1}`} value={Number.isFinite(item) ? item : 0} onChange={(e) => ctx.set([...path, i], Number(e.target.value))} className={inputClass} />
              ) : (
                <input aria-label={`${text} ${i + 1}`} value={String(item ?? "")} onChange={(e) => ctx.set([...path, i], e.target.value)} className={inputClass} />
              )}
            </div>
            <div className="flex">
              <button type="button" aria-label={`Move ${text} ${i + 1} up`} disabled={i === 0} onClick={() => ctx.move(path, i, i - 1)} className={smallButton}>↑</button>
              <button type="button" aria-label={`Move ${text} ${i + 1} down`} disabled={i === list.length - 1} onClick={() => ctx.move(path, i, i + 1)} className={smallButton}>↓</button>
            </div>
            <button type="button" aria-label={`Remove ${text} ${i + 1}`} onClick={() => ctx.remove([...path, i])} className={smallButton}>×</button>
          </div>
        ))}
        {isElements ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {([["text", "text"], ["shape", "a shape"], ["icon", "an icon"], ["image", "a picture"]] as const).map(([kind, name]) => (
              <button key={kind} type="button" onClick={() => ctx.insert(path, list.length, newCanvasElement(kind, kind === "image" ? ctx.pictures[0]?.id : undefined))} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">
                + Add {name}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => ctx.insert(path, list.length, newListItem(list))} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">
            + Add {k === "bullets" ? "a bullet" : "an item"}
          </button>
        )}
      </fieldset>
    );
  }

  if (spec.kind === "object") {
    return (
      <fieldset className="space-y-2 rounded-lg border border-[var(--ds-border-muted)] p-2.5">
        <legend className="px-1 text-xs font-medium text-[var(--ds-text-secondary)]">{text}</legend>
        {Object.entries((value ?? {}) as Record<string, unknown>).map(([ik, iv]) => (
          <Control key={ik} k={ik} value={iv} path={[...path, ik]} ctx={ctx} />
        ))}
      </fieldset>
    );
  }

  // A picture list is a button with a pop-up, so its wrapper is a div: inside a label, a click on a row would also click the button.
  const wrap = (control: React.ReactNode, removable = false, plain = false) => {
    const Box = plain ? "div" : "label";
    return (
    <Box className="block space-y-1">
      <span className="flex items-center justify-between text-xs font-medium text-[var(--ds-text-secondary)]">
        {text}
        {removable && (
          <button type="button" onClick={() => ctx.remove(path)} className="text-[10px] font-normal text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] underline">
            Remove
          </button>
        )}
      </span>
      {control}
    </Box>
    );
  };
  const removable = k === "notes" || k === "caption" || k === "eyebrow" || k === "tone" || k === "icon";

  if (spec.kind === "flag") {
    return (
      <label className="flex items-center gap-2 text-sm text-[var(--ds-text-primary)]">
        <input type="checkbox" checked={value === true} onChange={(e) => ctx.set(path, e.target.checked)} />
        {text}
      </label>
    );
  }
  if (spec.kind === "number") return wrap(<input type="number" value={Number.isFinite(value as number) ? (value as number) : 0} onChange={(e) => ctx.set(path, Number(e.target.value))} className={inputClass} />);
  if (spec.kind === "choice" || spec.kind === "icon") {
    return wrap(
      <select value={String(value ?? "")} onChange={(e) => ctx.set(path, e.target.value)} className={inputClass}>
        {spec.kind === "icon" && <option value="">No icon</option>}
        {[...(spec.options ?? []), ...(value !== undefined && value !== "" && !(spec.options ?? []).includes(String(value)) ? [String(value)] : [])].map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>,
      removable
    );
  }
  if (spec.kind === "picture") {
    const id = String(value ?? "");
    return wrap(
      <PictureSelect
        ariaLabel={text}
        value={id}
        buttonClassName="!text-sm !px-2.5 !py-1.5"
        options={[
          { value: "", label: "No picture (an empty box)" },
          ...(id && !ctx.pictures.some((p) => p.id === id) ? [{ value: id, label: `${id} (picture not found)` }] : []),
          ...ctx.pictures.map((p) => ({ value: p.id, label: `${p.id} · ${p.label}`, thumb: p.thumb })),
        ]}
        onChange={(next) => (next ? ctx.set(path, next) : ctx.remove(path))}
      />,
      false,
      true
    );
  }
  if (spec.kind === "longtext") {
    return wrap(<textarea rows={k === "notes" ? 3 : 2} value={String(value ?? "")} onChange={(e) => ctx.set(path, e.target.value)} className={`${inputClass} resize-y`} />, removable);
  }
  return wrap(<input value={String(value ?? "")} onChange={(e) => ctx.set(path, e.target.value)} className={inputClass} />, removable);
}

function buildCtx(slide: SlideContent, pictures: PictureChoice[], onChange: (next: SlideContent, key: string) => void, activeElement: number | null, onSelectElement?: (index: number) => void): Ctx {
  const apply = (next: unknown, key: string) => onChange(next as SlideContent, key);
  return {
    slide,
    pictures,
    set: (path, value) => apply(setAt(slide, path, value), path.join(".")),
    remove: (path) => apply(removeAt(slide, path), `${path.join(".")}:remove`),
    insert: (listPath, index, value) => apply(insertAt(slide, listPath, index, value), `${listPath.join(".")}:add`),
    move: (listPath, from, to) => apply(moveWithin(slide, listPath, from, to), `${listPath.join(".")}:move`),
    activeElement,
    select: (index) => onSelectElement?.(index),
    box: (index, box) => apply(setBox(slide, "elements", index, box), `elements.${index}.box`),
  };
}

const ELEMENT_NAMES: Record<string, string> = { text: "Text", shape: "Shape", icon: "Icon", image: "Picture", chart: "Chart", table: "Table" };

/** When one part of a free-form slide is picked: only that part's fields, its place on the slide and its order, nothing else. */
export function ElementPanel({ slide, pictures, index, onChange, onSelect, onBack, defaultTextColor = "111827" }: { slide: SlideContent; pictures: PictureChoice[]; index: number; defaultTextColor?: string; onChange: (next: SlideContent, key: string) => void; onSelect: (index: number) => void; onBack: () => void }) {
  const ctx = buildCtx(slide, pictures, onChange, index, onSelect);
  const list = (getAt(slide, ["elements"]) as unknown[] | undefined) ?? [];
  const item = list[index] as Record<string, unknown> | undefined;
  if (!item) return null;
  const kind = String(item.type ?? "element");
  const name = `${ELEMENT_NAMES[kind] ?? kind[0].toUpperCase() + kind.slice(1)} ${index + 1}`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{name}</h2>
        <button type="button" onClick={onBack} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">← Whole slide</button>
      </div>
      {typeof item.x === "number" && <PositionFields label={name} box={item as unknown as Box} onChange={(b) => ctx.box(index, b)} />}
      {kind === "text" && (
        <ColorField label="Text colour" value={typeof item.color === "string" ? item.color : undefined} fallback={defaultTextColor} onChange={(hex) => (hex === undefined ? ctx.remove(["elements", index, "color"]) : ctx.set(["elements", index, "color"], hex))} />
      )}
      {kind === "shape" && item.shape !== "line" && (
        <ColorField label="Own fill colour" value={typeof item.fill === "string" ? item.fill : undefined} fallback="FFFFFF" onChange={(hex) => (hex === undefined ? ctx.remove(["elements", index, "fill"]) : ctx.set(["elements", index, "fill"], hex))} />
      )}
      {Object.entries(item).filter(([k]) => k !== "color" && k !== "fill").map(([k, v]) => (
        <Control key={k} k={k} value={v} path={["elements", index, k]} ctx={ctx} />
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        <button type="button" disabled={index >= list.length - 1} onClick={() => { ctx.move(["elements"], index, index + 1); ctx.select(index + 1); }} className="text-xs font-medium text-[var(--ds-accent)] hover:underline disabled:opacity-40 disabled:no-underline">Bring forward</button>
        <button type="button" disabled={index === 0} onClick={() => { ctx.move(["elements"], index, index - 1); ctx.select(index - 1); }} className="text-xs font-medium text-[var(--ds-accent)] hover:underline disabled:opacity-40 disabled:no-underline">Send back</button>
        <button type="button" onClick={() => { ctx.remove(["elements", index]); onBack(); }} className="text-xs font-medium text-red-500 hover:underline">Remove this part</button>
      </div>
    </div>
  );
}

export default function SlideForm({ slide, pictures, onChange, activeElement = null, onSelectElement }: { slide: SlideContent; pictures: PictureChoice[]; onChange: (next: SlideContent, key: string) => void; activeElement?: number | null; onSelectElement?: (index: number) => void }) {
  const ctx = buildCtx(slide, pictures, onChange, activeElement, onSelectElement);
  const layout = layoutOf(slide);
  const present = new Set(Object.keys(slide));
  // notes, tone and icon go last, after the slide's own fields.
  const tail = new Set<string>(["notes", "tone", "icon", ...SLIDE_OPTION_KEYS]);
  const own = Object.entries(slide as unknown as Record<string, unknown>).filter(([k]) => !tail.has(k));
  const addable = optionalFields(layout).filter(([k]) => !present.has(k));

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--ds-text-muted)]">{LAYOUT_LABELS[layout] ?? layout}</p>
      {own.map(([k, v]) => (
        <Control key={k} k={k} value={v} path={[k]} ctx={ctx} />
      ))}
      {(["icon", "tone", "notes"] as const).filter((k) => present.has(k)).map((k) => (
        <Control key={k} k={k} value={getAt(slide, [k])} path={[k]} ctx={ctx} />
      ))}
      {!present.has("icon") && layout !== "canvas" && (
        <button type="button" onClick={() => ctx.set(["icon"], "idea")} className="block text-xs font-medium text-[var(--ds-accent)] hover:underline">+ Add an icon</button>
      )}
      {addable.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {addable.map(([k, start]) => (
            <button key={k} type="button" onClick={() => ctx.set([k], start)} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">
              + Add {k === "tone" ? "the contrast look" : k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
