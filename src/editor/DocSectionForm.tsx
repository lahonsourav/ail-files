"use client";

import { useState, type ReactNode } from "react";
import { CALLOUT_KINDS, MAX_CHART_POINTS, MAX_ITEMS, MAX_PICTURES, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, PICTURE_SIZES, type DocColumnBlock, type DocKind, type DocSection } from "../edit/docEdit.js";
import PictureSelect from "./PictureSelect.js";
import type { PictureChoice } from "./SlideForm.js";

// The fields of one section of a Word or PDF document, as a form. Every block a section can hold has its own small editor, and the blocks it
// does not have yet are offered under "Add to this section". `onChange` receives the whole changed section and a key that names what was
// changed, so typing in one field is one undo step (see `commit` with a key).

const inputClass =
  "w-full text-sm px-2.5 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";
const smallButton =
  "shrink-0 w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center rounded-md text-xs text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent";
const linkButton = "text-xs font-medium text-[var(--ds-accent)] hover:underline";
const labelClass = "text-xs font-medium text-[var(--ds-text-secondary)]";

type Change = (next: DocSection, key: string) => void;

const swap = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function Block({ title, onRemove, children }: { title: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-[var(--ds-border-muted)] p-2.5">
      <legend className="px-1 flex items-center gap-2">
        <span className={labelClass}>{title}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${title.toLowerCase()}`} className="text-[11px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] underline">Remove</button>
        )}
      </legend>
      {children}
    </fieldset>
  );
}

/** A list of lines of text (paragraphs, bullets, numbered items): each can be edited, moved and removed, and new ones added. */
function TextList({ label, noun, values, long, onChange, onRemoveAll }: { label: string; noun: string; values: string[]; long?: boolean; onChange: (next: string[], key: string) => void; onRemoveAll?: () => void }) {
  return (
    <Block title={label} onRemove={onRemoveAll}>
      <ol className="space-y-1.5">
        {values.map((v, i) => (
          <li key={i} className="flex items-start gap-1">
            {long ? (
              <textarea aria-label={`${noun} ${i + 1}`} rows={3} value={v} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)), `${i}`)} className={`${inputClass} resize-y`} />
            ) : (
              <input aria-label={`${noun} ${i + 1}`} value={v} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)), `${i}`)} className={inputClass} />
            )}
            <div className="flex flex-col pointer-coarse:flex-row">
              <button type="button" aria-label={`Move ${noun.toLowerCase()} ${i + 1} up`} disabled={i === 0} onClick={() => onChange(swap(values, i, i - 1), `move.${Date.now()}`)} className={smallButton}>↑</button>
              <button type="button" aria-label={`Move ${noun.toLowerCase()} ${i + 1} down`} disabled={i === values.length - 1} onClick={() => onChange(swap(values, i, i + 1), `move.${Date.now()}`)} className={smallButton}>↓</button>
            </div>
            <button type="button" aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`} onClick={() => onChange(values.filter((_, j) => j !== i), `rm.${Date.now()}`)} className={smallButton}>×</button>
          </li>
        ))}
      </ol>
      {values.length < MAX_ITEMS && (
        <button type="button" onClick={() => onChange([...values, ""], `add.${Date.now()}`)} className={linkButton}>+ Add {noun.toLowerCase()}</button>
      )}
    </Block>
  );
}

function TableEditor({ table, onChange, onRemove }: { table: NonNullable<DocSection["table"]>; onChange: (next: NonNullable<DocSection["table"]>, key: string) => void; onRemove: () => void }) {
  const cols = table.headers?.length ?? table.rows[0]?.length ?? 0;
  const setCell = (r: number, c: number, v: string) => onChange({ ...table, rows: table.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) }, `cell.${r}.${c}`);
  return (
    <Block title="Table" onRemove={onRemove}>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="p-0 font-normal">
                  <input aria-label={`Column ${c + 1} heading`} placeholder="Heading" value={table.headers?.[c] ?? ""} onChange={(e) => onChange({ ...table, headers: Array.from({ length: cols }, (_, j) => (j === c ? e.target.value : table.headers?.[j] ?? "")) }, `head.${c}`)} className={`${inputClass} font-semibold min-w-24`} />
                </th>
              ))}
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="p-0">
                    <input aria-label={`Row ${r + 1}, column ${c + 1}`} value={cell} onChange={(e) => setCell(r, c, e.target.value)} className={`${inputClass} min-w-24`} />
                  </td>
                ))}
                <td className="p-0">
                  <button type="button" aria-label={`Remove row ${r + 1}`} onClick={() => onChange({ ...table, rows: table.rows.filter((_, i) => i !== r) }, `rmrow.${Date.now()}`)} className={smallButton}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        {table.rows.length < MAX_TABLE_ROWS && <button type="button" onClick={() => onChange({ ...table, rows: [...table.rows, Array.from({ length: cols }, () => "")] }, `addrow.${Date.now()}`)} className={linkButton}>+ Add row</button>}
        {cols < MAX_TABLE_COLUMNS && <button type="button" onClick={() => onChange({ headers: [...(table.headers ?? Array.from({ length: cols }, () => "")), ""], rows: table.rows.map((r) => [...r, ""]) }, `addcol.${Date.now()}`)} className={linkButton}>+ Add column</button>}
        {cols > 1 && <button type="button" onClick={() => onChange({ ...(table.headers ? { headers: table.headers.slice(0, -1) } : {}), rows: table.rows.map((r) => r.slice(0, -1)) }, `rmcol.${Date.now()}`)} className={linkButton}>− Remove last column</button>}
      </div>
    </Block>
  );
}

function ChartEditor({ chart, onChange, onRemove }: { chart: NonNullable<DocSection["chart"]>; onChange: (next: NonNullable<DocSection["chart"]>, key: string) => void; onRemove: () => void }) {
  return (
    <Block title="Chart" onRemove={onRemove}>
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <select aria-label="Chart type" value={chart.type} onChange={(e) => onChange({ ...chart, type: e.target.value as "bar" | "pie" }, "type")} className={inputClass}>
          <option value="bar">Bar</option>
          <option value="pie">Pie</option>
        </select>
        <input aria-label="Chart title" placeholder="Chart title (optional)" value={chart.title ?? ""} onChange={(e) => onChange({ ...chart, title: e.target.value }, "title")} className={inputClass} />
      </div>
      <ul className="space-y-1.5">
        {chart.data.map((d, i) => (
          <li key={i} className="flex gap-1.5">
            <input aria-label={`Chart label ${i + 1}`} placeholder="Label" value={d.label} onChange={(e) => onChange({ ...chart, data: chart.data.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }, `label.${i}`)} className={inputClass} />
            <input aria-label={`Chart value ${i + 1}`} type="number" inputMode="decimal" value={Number.isFinite(d.value) ? d.value : 0} onChange={(e) => onChange({ ...chart, data: chart.data.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) || 0 } : x)) }, `value.${i}`)} className={`${inputClass} w-24`} />
            <button type="button" aria-label={`Remove chart entry ${i + 1}`} disabled={chart.data.length <= 1} onClick={() => onChange({ ...chart, data: chart.data.filter((_, j) => j !== i) }, `rm.${Date.now()}`)} className={smallButton}>×</button>
          </li>
        ))}
      </ul>
      {chart.data.length < MAX_CHART_POINTS && <button type="button" onClick={() => onChange({ ...chart, data: [...chart.data, { label: "", value: 0 }] }, `add.${Date.now()}`)} className={linkButton}>+ Add entry</button>}
    </Block>
  );
}

function ColumnEditor({ title, block, onChange }: { title: string; block: DocColumnBlock; onChange: (next: DocColumnBlock, key: string) => void }) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--ds-border-muted)] p-2">
      <p className={labelClass}>{title}</p>
      <input aria-label={`${title} heading`} placeholder="Heading" value={block.heading ?? ""} onChange={(e) => onChange({ ...block, heading: e.target.value }, "heading")} className={inputClass} />
      <TextList label="Text" noun="Paragraph" long values={block.paragraphs ?? []} onChange={(next, key) => onChange({ ...block, paragraphs: next }, `p.${key}`)} />
      <TextList label="Bullets" noun="Bullet" values={block.bullets ?? []} onChange={(next, key) => onChange({ ...block, bullets: next }, `b.${key}`)} />
    </div>
  );
}

export default function DocSectionForm({ section, kind, pictures, onChange, onUploadPicture }: { section: DocSection; kind: DocKind; pictures: PictureChoice[]; onChange: Change; onUploadPicture?: (file: File) => Promise<{ id: string } | { error: string }> }) {
  const [uploadError, setUploadError] = useState("");
  const set = (patch: Partial<DocSection>, key: string) => onChange({ ...section, ...patch }, key);
  const drop = (field: keyof DocSection) => {
    const next = { ...section };
    delete next[field];
    onChange(next, `drop.${field}.${Date.now()}`);
  };
  const pdf = kind === "pdf";

  // What can still be added to this section.
  const adders: [string, () => void][] = [];
  if (section.paragraphs === undefined) adders.push(["Text", () => set({ paragraphs: [""] }, `add.paragraphs.${Date.now()}`)]);
  if (section.pictures === undefined) adders.push(["Picture", () => set({ pictures: [{ image: "", size: "medium" }] }, `add.pictures.${Date.now()}`)]);
  if (section.bullets === undefined) adders.push(["Bullets", () => set({ bullets: [""] }, `add.bullets.${Date.now()}`)]);
  if (section.numbered === undefined) adders.push(["Numbered list", () => set({ numbered: [""] }, `add.numbered.${Date.now()}`)]);
  if (section.table === undefined) adders.push(["Table", () => set({ table: { headers: ["Column 1", "Column 2"], rows: [["", ""], ["", ""]] } }, `add.table.${Date.now()}`)]);
  if (pdf && section.chart === undefined) adders.push(["Chart", () => set({ chart: { type: "bar", title: "", data: [{ label: "First", value: 1 }, { label: "Second", value: 2 }] } }, `add.chart.${Date.now()}`)]);
  if (pdf && section.callout === undefined) adders.push(["Callout", () => set({ callout: { kind: "note", text: "" } }, `add.callout.${Date.now()}`)]);
  if (pdf && section.columns === undefined) adders.push(["Two columns", () => set({ columns: { left: { heading: "Left", paragraphs: [""] }, right: { heading: "Right", paragraphs: [""] } } }, `add.columns.${Date.now()}`)]);

  const pics = section.pictures ?? [];
  const options = [{ value: "", label: "Choose a picture…", noSwatch: true }, ...pictures.map((p) => ({ value: p.id, label: `${p.id} · ${p.label}`, thumb: p.thumb }))];

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className={labelClass}>Heading</span>
        <input value={section.heading ?? ""} onChange={(e) => set({ heading: e.target.value }, "heading")} className={inputClass} />
      </label>

      {section.paragraphs !== undefined && <TextList label="Text" noun="Paragraph" long values={section.paragraphs} onChange={(next, key) => set({ paragraphs: next }, `paragraphs.${key}`)} onRemoveAll={() => drop("paragraphs")} />}

      {section.pictures !== undefined && (
        <Block title="Pictures" onRemove={() => drop("pictures")}>
          <ul className="space-y-2">
            {pics.map((p, i) => (
              <li key={i} className="space-y-1.5 rounded-md border border-[var(--ds-border-muted)] p-2">
                <div className="flex items-center gap-1.5">
                  <PictureSelect ariaLabel={`Picture ${i + 1}`} value={p.image} options={options} buttonClassName="!text-sm !px-2.5 !py-1.5" onChange={(id) => set({ pictures: pics.map((x, j) => (j === i ? { ...x, image: id } : x)) }, `pic.${i}.image.${Date.now()}`)} className="flex-1 min-w-0" />
                  <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => set({ pictures: pics.filter((_, j) => j !== i) }, `rmpic.${Date.now()}`)} className={smallButton}>×</button>
                </div>
                <div className="grid grid-cols-[1fr_6.5rem] gap-1.5">
                  <input aria-label={`Caption for picture ${i + 1}`} placeholder="Caption (optional)" value={p.caption ?? ""} onChange={(e) => set({ pictures: pics.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) }, `pic.${i}.caption`)} className={inputClass} />
                  <select aria-label={`Size of picture ${i + 1}`} value={p.size ?? "medium"} onChange={(e) => set({ pictures: pics.map((x, j) => (j === i ? { ...x, size: e.target.value as (typeof PICTURE_SIZES)[number] } : x)) }, `pic.${i}.size`)} className={inputClass}>
                    {PICTURE_SIZES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {pics.length < MAX_PICTURES && <button type="button" onClick={() => set({ pictures: [...pics, { image: "", size: "medium" }] }, `addpic.${Date.now()}`)} className={linkButton}>+ Add a picture</button>}
            {onUploadPicture && (
              <label className="cursor-pointer">
                <span className={linkButton}>Upload a new picture</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Upload a new picture"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadError("");
                    const r = await onUploadPicture(file);
                    if ("error" in r) setUploadError(r.error);
                    else {
                      const at = pics.findIndex((p) => !p.image);
                      set({ pictures: at >= 0 ? pics.map((x, j) => (j === at ? { ...x, image: r.id } : x)) : [...pics, { image: r.id, size: "medium" as const }].slice(0, MAX_PICTURES) }, `uploaded.${Date.now()}`);
                    }
                  }}
                />
              </label>
            )}
          </div>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          {pictures.length === 0 && !onUploadPicture && <p className="text-[11px] text-[var(--ds-text-muted)]">No pictures to place yet. Add pictures in the chat, then come back.</p>}
        </Block>
      )}

      {section.bullets !== undefined && <TextList label="Bullets" noun="Bullet" values={section.bullets} onChange={(next, key) => set({ bullets: next }, `bullets.${key}`)} onRemoveAll={() => drop("bullets")} />}
      {section.numbered !== undefined && <TextList label="Numbered list" noun="Item" values={section.numbered} onChange={(next, key) => set({ numbered: next }, `numbered.${key}`)} onRemoveAll={() => drop("numbered")} />}
      {section.table && <TableEditor table={section.table} onChange={(next, key) => set({ table: next }, `table.${key}`)} onRemove={() => drop("table")} />}
      {pdf && section.chart && <ChartEditor chart={section.chart} onChange={(next, key) => set({ chart: next }, `chart.${key}`)} onRemove={() => drop("chart")} />}
      {pdf && section.callout && (
        <Block title="Callout" onRemove={() => drop("callout")}>
          <select aria-label="Callout kind" value={section.callout.kind ?? "note"} onChange={(e) => set({ callout: { ...section.callout!, kind: e.target.value as (typeof CALLOUT_KINDS)[number] } }, "callout.kind")} className={inputClass}>
            {CALLOUT_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
          </select>
          <textarea aria-label="Callout text" rows={3} value={section.callout.text} onChange={(e) => set({ callout: { ...section.callout!, text: e.target.value } }, "callout.text")} className={`${inputClass} resize-y`} />
        </Block>
      )}
      {pdf && section.columns && (
        <Block title="Two columns" onRemove={() => drop("columns")}>
          <ColumnEditor title="Left column" block={section.columns.left} onChange={(next, key) => set({ columns: { ...section.columns!, left: next } }, `left.${key}`)} />
          <ColumnEditor title="Right column" block={section.columns.right} onChange={(next, key) => set({ columns: { ...section.columns!, right: next } }, `right.${key}`)} />
        </Block>
      )}

      <label className="flex items-center gap-2 text-xs text-[var(--ds-text-secondary)] cursor-pointer">
        <input type="checkbox" checked={section.newPage === true} onChange={(e) => (e.target.checked ? set({ newPage: true }, "newPage") : drop("newPage"))} />
        Start this section on a new page
      </label>

      {adders.length > 0 && (
        <div className="space-y-1.5">
          <p className={labelClass}>Add to this section</p>
          <div className="flex flex-wrap gap-1.5">
            {adders.map(([label, add]) => (
              <button key={label} type="button" onClick={add} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--ds-border-muted)] text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:border-[var(--ds-accent)]">+ {label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
