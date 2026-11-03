"use client";

import type { CSSProperties, ReactNode } from "react";
import SlideChart from "./SlideChart.js";
import { SLIDE_H, SLIDE_W, type RecordedDeck, type RecordedItem, type RecordedRun, type RecordedSlide } from "../pptx/pptRecorded.js";

// Draws one recorded slide (see recordDeck in lib/presentationBuilder.ts) with plain DOM. Every length is in container
// query units, so the slide scales with its box and needs no measuring: 10 inches wide is 100cqw, so an inch is 10cqw
// and a point (1/72 inch) is 10/72 cqw. What is drawn is what the export drew, so this only has to know how to
// paint the few things the builder uses: text, a handful of shapes, pictures, a table, and a stand-in for charts.

const INCH = 10; // cqw
const PT = INCH / 72; // cqw
const cq = (inches: number) => `${(inches * INCH).toFixed(4)}cqw`;
const pt = (points: number) => `${(points * PT).toFixed(4)}cqw`;

type Opts = Record<string, unknown>;
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const hex = (v: unknown, fallback = "000000") => (typeof v === "string" && /^[0-9a-fA-F]{6}$/.test(v) ? v : fallback);

function rgba(color: string, transparency?: number): string {
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const alpha = transparency === undefined ? 1 : Math.max(0, Math.min(1, 1 - transparency / 100));
  return `rgba(${r},${g},${b},${alpha})`;
}

// Fonts the builder asks for, with the nearest families a browser is likely to have. Widths differ a little from
// PowerPoint's, which is why text is allowed to run past its box here exactly as it does there.
function fontFamily(face: string | undefined): string {
  const f = face ?? "Calibri";
  if (/arial black/i.test(f)) return `"Arial Black", Impact, "Arial Bold", sans-serif`;
  if (/georgia/i.test(f)) return `Georgia, "Times New Roman", serif`;
  if (/calibri/i.test(f)) return `Calibri, Carlito, "Segoe UI", Helvetica, Arial, sans-serif`;
  if (/arial/i.test(f)) return `Arial, "Liberation Sans", Helvetica, sans-serif`;
  return `"${f}", Calibri, Carlito, Helvetica, Arial, sans-serif`;
}

function box(o: Opts): CSSProperties {
  return { position: "absolute", left: cq(num(o.x)), top: cq(num(o.y)), width: cq(num(o.w)), height: cq(num(o.h)), boxSizing: "border-box" };
}

interface Paragraph {
  runs: { text: string; o: Opts }[];
  bullet: boolean;
  numbered: boolean;
  indentPt: number;
}

// pptxgenjs starts a new paragraph after a run with breakLine, and after each line of a plain string.
function paragraphs(text: string | RecordedRun[]): Paragraph[] {
  const out: Paragraph[] = [];
  let current: Paragraph | null = null;
  const start = (o: Opts): Paragraph => {
    const b = o.bullet;
    const indent = b && typeof b === "object" ? num((b as Opts).indent, 27) : 27;
    const p: Paragraph = { runs: [], bullet: !!b, numbered: !!b && typeof b === "object" && (b as Opts).type === "number", indentPt: indent };
    out.push(p);
    return p;
  };
  if (typeof text === "string") {
    for (const line of text.split(/\r?\n/)) {
      const p = start({});
      p.runs.push({ text: line, o: {} });
    }
    return out;
  }
  for (const run of text) {
    const o = (run.options ?? {}) as Opts;
    if (!current) current = start(o);
    current.runs.push({ text: run.text, o });
    if (o.breakLine) current = null;
  }
  return out;
}

function TextItem({ text, opts }: { text: string | RecordedRun[]; opts: Opts }) {
  const margin = opts.margin;
  // pptxgenjs: a number is points on every side; an array is [left, right, bottom, top]; none leaves PowerPoint's own 0.1 and 0.05 inch.
  const [mL, mR, mB, mT] = Array.isArray(margin) ? [num(margin[0]), num(margin[1]), num(margin[2]), num(margin[3])] : typeof margin === "number" ? [margin, margin, margin, margin] : [7.2, 7.2, 3.6, 3.6];
  const valign = str(opts.valign);
  const align = str(opts.align) === "center" ? "center" : str(opts.align) === "right" ? "right" : "left";
  const baseSize = num(opts.fontSize, 12);
  const style: CSSProperties = {
    ...box(opts),
    display: "flex",
    flexDirection: "column",
    // pptxgenjs writes anchor="ctr" when no valign is given, so unset means middle, not top.
    justifyContent: valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center",
    padding: `${pt(mT)} ${pt(mR)} ${pt(mB)} ${pt(mL)}`,
    opacity: typeof opts.transparency === "number" ? Math.max(0, 1 - opts.transparency / 100) : undefined,
    textAlign: align,
    lineHeight: 1.2,
    letterSpacing: typeof opts.charSpacing === "number" ? pt(opts.charSpacing) : undefined,
    overflow: "visible",
    wordBreak: "break-word",
  };
  const paras = paragraphs(text);
  // 1, 2, 3 for a run of numbered paragraphs; the count starts again after any other paragraph.
  const numbers = paras.reduce<number[]>((acc, p, i) => [...acc, p.numbered ? (i > 0 && paras[i - 1].numbered ? acc[i - 1] + 1 : 1) : 0], []);
  return (
    <div style={style}>
      {paras.map((p, i) => {
        const n = numbers[i];
        const first = p.runs[0]?.o ?? {};
        const size = num(first.fontSize, baseSize);
        const content: ReactNode = p.runs.map((r, j) => {
          const o = { ...opts, ...r.o };
          return (
            <span
              key={j}
              style={{
                fontFamily: fontFamily(str(o.fontFace)),
                fontSize: pt(num(o.fontSize, baseSize)),
                color: `#${hex(o.color)}`,
                fontWeight: o.bold ? (/arial black/i.test(str(o.fontFace) ?? "") ? 900 : 700) : undefined,
                fontStyle: o.italic ? "italic" : undefined,
                whiteSpace: "pre-wrap",
              }}
            >
              {r.text}
            </span>
          );
        });
        if (!p.bullet) return <div key={i} style={{ minHeight: pt(size * 1.2) }}>{content}</div>;
        return (
          <div key={i} style={{ display: "flex", minHeight: pt(size * 1.2) }}>
            <span style={{ flex: "none", width: pt(p.indentPt), fontSize: pt(size), color: `#${hex(first.color ?? opts.color)}`, fontFamily: fontFamily(str(first.fontFace ?? opts.fontFace)) }}>{p.numbered ? `${n}.` : "•"}</span>
            <span style={{ minWidth: 0 }}>{content}</span>
          </div>
        );
      })}
    </div>
  );
}

function ShapeItem({ shape, opts }: { shape: string; opts: Opts }) {
  const fill = opts.fill as Opts | undefined;
  const line = opts.line as Opts | undefined;
  const fillColor = fill && typeof fill.color === "string" ? rgba(hex(fill.color), typeof fill.transparency === "number" ? fill.transparency : undefined) : undefined;
  const hasLine = !!line && line.type !== "none" && typeof line.color === "string";
  const lineColor = hasLine ? rgba(hex(line!.color), typeof line!.transparency === "number" ? (line!.transparency as number) : undefined) : undefined;
  const lineWidth = hasLine ? num(line!.width, 1) : 0;
  const dash = hasLine && typeof line!.dashType === "string" && line!.dashType !== "solid" ? (/dot/i.test(line!.dashType as string) ? "dotted" : "dashed") : "solid";

  if (shape === "line" && (num(opts.w) < 0.001 || num(opts.h) < 0.001)) {
    const thick = num(line?.width, 1) * PT;
    const horizontal = num(opts.h) < 0.001;
    return (
      <div
        style={{
          position: "absolute",
          left: horizontal ? cq(num(opts.x)) : `calc(${cq(num(opts.x))} - ${(thick / 2).toFixed(4)}cqw)`,
          top: horizontal ? `calc(${cq(num(opts.y))} - ${(thick / 2).toFixed(4)}cqw)` : cq(num(opts.y)),
          width: horizontal ? cq(num(opts.w)) : `${thick.toFixed(4)}cqw`,
          height: horizontal ? `${thick.toFixed(4)}cqw` : cq(num(opts.h)),
          background: lineColor ?? "currentColor",
        }}
      />
    );
  }
  if (shape === "line" || shape === "rightArrow" || shape === "downArrow") {
    const w = num(opts.w);
    const h = num(opts.h);
    const flipH = opts.flipH === true;
    const flipV = opts.flipV === true;
    return (
      <svg style={{ ...box(opts), overflow: "visible" }} viewBox={`0 0 ${Math.max(w, 0.0001)} ${Math.max(h, 0.0001)}`} preserveAspectRatio="none">
        {shape === "line" ? (
          <line
            x1={flipH ? w : 0}
            y1={flipV ? h : 0}
            x2={flipH ? 0 : w}
            y2={flipV ? 0 : h}
            stroke={lineColor ?? "currentColor"}
            strokeWidth={lineWidth / 72}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: pt(lineWidth) }}
          />
        ) : shape === "rightArrow" ? (
          <polygon points={`0,${h * 0.25} ${w - Math.min(w, h) * 0.5},${h * 0.25} ${w - Math.min(w, h) * 0.5},0 ${w},${h / 2} ${w - Math.min(w, h) * 0.5},${h} ${w - Math.min(w, h) * 0.5},${h * 0.75} 0,${h * 0.75}`} fill={fillColor ?? "none"} />
        ) : (
          <polygon points={`${w * 0.25},0 ${w * 0.75},0 ${w * 0.75},${h - Math.min(w, h) * 0.5} ${w},${h - Math.min(w, h) * 0.5} ${w / 2},${h} 0,${h - Math.min(w, h) * 0.5} ${w * 0.25},${h - Math.min(w, h) * 0.5}`} fill={fillColor ?? "none"} />
        )}
      </svg>
    );
  }
  const radius = shape === "ellipse" ? "50%" : shape === "roundRect" ? cq(num(opts.rectRadius, 0.1)) : undefined;
  return <div style={{ ...box(opts), background: fillColor, borderRadius: radius, border: hasLine ? `${pt(lineWidth)} ${dash} ${lineColor}` : undefined }} />;
}

function ImageItem({ item, assets, images, logoRound }: { item: Extract<RecordedItem, { kind: "image" }>; assets: RecordedDeck["assets"]; images: Record<string, string>; logoRound?: boolean }) {
  const src = "asset" in item.src ? assets[item.src.asset] : images[item.src.ref];
  const sizing = item.opts.sizing as Opts | undefined;
  // sizing cover: the picture fills a w by h box at x, y and is cropped to it.
  const frame = sizing && sizing.type === "cover" ? { ...item.opts, w: num(sizing.w, num(item.opts.w)), h: num(sizing.h, num(item.opts.h)) } : item.opts;
  // A round logo is cropped to a circle when the export prepares it; here the person's own picture is, so do the same.
  const roundLogo = logoRound && "ref" in item.src && item.src.ref === "logo";
  const style: CSSProperties = { ...box(frame), objectFit: roundLogo || (sizing && sizing.type === "cover") ? "cover" : "fill", borderRadius: roundLogo ? "50%" : undefined };
  if (!src) return <div style={{ ...style, background: "rgba(128,128,128,0.25)" }} aria-label="Picture not available" />;
  // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimise
  return <img src={src} alt={str(item.opts.altText) ?? ""} style={style} draggable={false} />;
}

function cellOf(cell: unknown): { text: string; o: Opts } {
  if (typeof cell === "string") return { text: cell, o: {} };
  if (cell && typeof cell === "object") {
    const c = cell as { text?: unknown; options?: Opts };
    const text = typeof c.text === "string" ? c.text : Array.isArray(c.text) ? (c.text as RecordedRun[]).map((r) => r.text).join("") : "";
    return { text, o: c.options ?? {} };
  }
  return { text: "", o: {} };
}

function TableItem({ rows, opts }: { rows: unknown; opts: Opts }) {
  const data = Array.isArray(rows) ? (rows as unknown[][]) : [];
  const border = opts.border as Opts | undefined;
  const borderCss = border && typeof border.color === "string" ? `${pt(num(border.pt, 1))} solid #${hex(border.color)}` : undefined;
  return (
    <table style={{ ...box(opts), tableLayout: "fixed", borderCollapse: "collapse", height: undefined }}>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} style={{ height: cq(num(opts.h, 1) / Math.max(1, data.length)) }}>
            {row.map((cell, j) => {
              const { text, o } = cellOf(cell);
              const fill = o.fill as Opts | undefined;
              return (
                <td
                  key={j}
                  style={{
                    border: borderCss,
                    padding: `${cq(0.05)} ${cq(0.1)}`,
                    background: fill && typeof fill.color === "string" ? `#${hex(fill.color)}` : undefined,
                    color: `#${hex(o.color)}`,
                    fontFamily: fontFamily(str(o.fontFace)),
                    fontSize: pt(num(o.fontSize, 12)),
                    fontWeight: o.bold ? 700 : undefined,
                    fontStyle: o.italic ? "italic" : undefined,
                    textAlign: str(o.align) === "center" ? "center" : str(o.align) === "right" ? "right" : "left",
                    verticalAlign: str(o.valign) === "top" ? "top" : str(o.valign) === "bottom" ? "bottom" : "middle",
                    overflow: "hidden",
                    lineHeight: 1.2,
                  }}
                >
                  {text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface SlideStageProps {
  slide: RecordedSlide;
  assets: RecordedDeck["assets"];
  /** Picture pixels the slide refers to, by id ("img1", "logo"), as data URLs. */
  images?: Record<string, string>;
  /** The logo is round: crop the person's logo picture to a circle, as the export does. */
  logoRound?: boolean;
  className?: string;
}

export default function SlideStage({ slide, assets, images = {}, logoRound, className }: SlideStageProps) {
  const bg = slide.background;
  const backdrop = bg.image ? images[bg.image] : undefined;
  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, containerType: "inline-size", overflow: "hidden", background: `#${hex(bg.color, "FFFFFF")}` }}
    >
      {backdrop && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimise */}
          <img src={backdrop} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: rgba(hex(bg.color, "FFFFFF"), (1 - (bg.scrim ?? 0.7)) * 100) }} />
        </>
      )}
      {slide.items.map((item, i) => {
        if (item.kind === "text") return <TextItem key={i} text={item.text} opts={item.opts} />;
        if (item.kind === "shape") return <ShapeItem key={i} shape={item.shape} opts={item.opts} />;
        if (item.kind === "image") return <ImageItem key={i} item={item} assets={assets} images={images} logoRound={logoRound} />;
        if (item.kind === "table") return <TableItem key={i} rows={item.rows} opts={item.opts} />;
        return <SlideChart key={i} chartType={item.chartType} data={item.data} opts={item.opts} style={box(item.opts)} />;
      })}
    </div>
  );
}
