"use client";

import type { CSSProperties } from "react";

// A chart as the builder recorded it (see addChart in lib/presentationBuilder.ts and lib/pptRecorded.ts), drawn as SVG so the
// preview and the editor show real charts, not a frame. The file has native PowerPoint charts; this only has to look like
// them: the same type, series, colours, legend and value labels. One SVG unit is a hundredth of an inch.

type Opts = Record<string, unknown>;
interface Series {
  name?: string;
  labels?: string[];
  values: number[];
}

const PALETTE = ["2563EB", "EB2563", "63EB25", "EBAD25", "AD25EB", "25EBAD"];
const FONT = 12.5; // about 9 pt
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const hex = (v: unknown, fallback: string) => `#${typeof v === "string" && /^[0-9a-fA-F]{6}$/.test(v) ? v : fallback}`;

function series(data: unknown): Series[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((s): s is Series => !!s && typeof s === "object" && Array.isArray((s as Series).values))
    .map((s) => ({ name: typeof s.name === "string" ? s.name : undefined, labels: Array.isArray(s.labels) ? s.labels.map(String) : undefined, values: s.values.map((v) => num(v)) }));
}

/** A round upper limit and step for an axis that has to reach `max`, with about five steps. */
export function niceScale(max: number): { top: number; step: number } {
  if (!(max > 0)) return { top: 1, step: 0.2 };
  const rough = max / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { top: Math.ceil(max / step) * step, step };
}

const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : String(Math.round(v * 100) / 100));

export default function SlideChart({ chartType, data, opts, style }: { chartType: unknown; data: unknown; opts: Opts; style: CSSProperties }) {
  const type = typeof chartType === "string" ? chartType : "bar";
  const all = series(data);
  const W = num(opts.w, 9) * 100;
  const H = num(opts.h, 4) * 100;
  const colors = Array.isArray(opts.chartColors) && opts.chartColors.length > 0 ? (opts.chartColors as string[]) : PALETTE;
  const color = (i: number) => hex(colors[i % colors.length], PALETTE[i % PALETTE.length]);
  const showLegend = opts.showLegend !== false;
  const showValue = opts.showValue === true;
  const textColor = hex(opts.dataLabelColor ?? opts.catAxisLabelColor, "374151");
  const gridColor = hex((opts.valGridLine as Opts | undefined)?.color, "374151");
  const labels = all[0]?.labels ?? all[0]?.values.map((_, i) => String(i + 1)) ?? [];

  const legendItems: { name: string; color: string }[] =
    type === "pie" || type === "doughnut" ? labels.map((l, i) => ({ name: l, color: color(i) })) : all.filter((s, i) => !(type === "scatter" && i === 0)).map((s, i) => ({ name: s.name ?? `Series ${i + 1}`, color: color(i) }));
  const legendH = showLegend && legendItems.length > 0 ? 30 : 0;

  const empty = all.length === 0 || all.every((s) => s.values.length === 0);
  const children: React.ReactNode[] = [];

  if (!empty && (type === "pie" || type === "doughnut")) {
    const values = all[0].values.map((v) => Math.max(0, v));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2;
    const cy = (H - legendH) / 2;
    const r = Math.min(W, H - legendH) / 2 - 8;
    let angle = -Math.PI / 2;
    values.forEach((v, i) => {
      const a0 = angle;
      const a1 = angle + (v / total) * Math.PI * 2;
      angle = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const hole = type === "doughnut" ? r * 0.5 : 0;
      const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      const d = values.filter((x) => x > 0).length === 1
        ? `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0 ${hole ? `M ${cx - hole},${cy} a ${hole},${hole} 0 1,1 ${2 * hole},0 a ${hole},${hole} 0 1,1 ${-2 * hole},0` : ""}`
        : `M ${p(r, a0)} A ${r},${r} 0 ${large} 1 ${p(r, a1)} ${hole ? `L ${p(hole, a1)} A ${hole},${hole} 0 ${large} 0 ${p(hole, a0)} Z` : `L ${cx},${cy} Z`}`;
      children.push(<path key={`s${i}`} d={d} fill={color(i)} fillRule="evenodd" />);
      if (showValue && v > 0) {
        const mid = (a0 + a1) / 2;
        const lr = hole ? (r + hole) / 2 : r * 0.62;
        children.push(<text key={`v${i}`} x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid) + FONT / 3} fontSize={FONT} textAnchor="middle" fill={textColor}>{fmt(v)}</text>);
      }
    });
  } else if (!empty && type === "radar") {
    const n = labels.length || all[0].values.length;
    const cx = W / 2;
    const cy = (H - legendH) / 2;
    const r = Math.min(W, H - legendH) / 2 - 34;
    const max = niceScale(Math.max(...all.flatMap((s) => s.values), 1)).top;
    const pt = (i: number, frac: number) => [cx + r * frac * Math.sin((i / n) * Math.PI * 2), cy - r * frac * Math.cos((i / n) * Math.PI * 2)];
    for (let ring = 1; ring <= 4; ring++) children.push(<polygon key={`g${ring}`} points={Array.from({ length: n }, (_, i) => pt(i, ring / 4).join(",")).join(" ")} fill="none" stroke={gridColor} strokeOpacity={0.35} strokeWidth={0.8} />);
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, 1);
      const [lx, ly] = pt(i, 1.12);
      children.push(<line key={`a${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={gridColor} strokeOpacity={0.35} strokeWidth={0.8} />);
      children.push(<text key={`l${i}`} x={lx} y={ly + FONT / 3} fontSize={FONT} textAnchor="middle" fill={textColor}>{labels[i]}</text>);
    }
    all.forEach((s, si) => {
      children.push(<polygon key={`p${si}`} points={s.values.map((v, i) => pt(i, v / max).join(",")).join(" ")} fill={color(si)} fillOpacity={0.18} stroke={color(si)} strokeWidth={2} />);
      if (showValue) s.values.forEach((v, i) => { const [x, y] = pt(i, v / max); children.push(<text key={`n${si}-${i}`} x={x} y={y - 5} fontSize={FONT - 1} textAnchor="middle" fill={textColor}>{fmt(v)}</text>); });
    });
  } else if (!empty) {
    // Axes: bar (columns, or rows when barDir is "bar"), line, area and scatter.
    const horizontal = type === "bar" && opts.barDir === "bar";
    const stacked = type === "bar" && /stacked/i.test(String(opts.barGrouping ?? "")) || type === "bar-stacked";
    const isScatter = type === "scatter" || type === "bubble";
    const plot = isScatter ? all.slice(1) : all;
    const xs = isScatter ? all[0].values : null;
    const left = horizontal ? 86 : 56;
    const top = 16;
    const right = 20;
    const bottom = 34 + legendH;
    const px0 = left;
    const px1 = W - right;
    const py0 = top;
    const py1 = H - bottom;
    const cats = isScatter ? 0 : Math.max(...plot.map((s) => s.values.length), labels.length);
    const stackedTotals = Array.from({ length: cats }, (_, c) => plot.reduce((sum, s) => sum + Math.max(0, s.values[c] ?? 0), 0));
    const vmax = stacked ? Math.max(...stackedTotals, 1) : Math.max(...plot.flatMap((s) => s.values), 1);
    const vmin = Math.min(0, ...plot.flatMap((s) => s.values));
    const { top: vTop, step } = niceScale(vmax);
    const lo = vmin < 0 ? -niceScale(-vmin).top : 0;
    const span = vTop - lo || 1;
    // value → position along the value axis
    const vy = (v: number) => (horizontal ? px0 + ((v - lo) / span) * (px1 - px0) : py1 - ((v - lo) / span) * (py1 - py0));
    const ticks: number[] = [];
    for (let t = lo; t <= vTop + step / 2; t += step) ticks.push(t);
    ticks.forEach((t, i) => {
      const y = vy(t);
      children.push(horizontal ? <line key={`gl${i}`} x1={y} y1={py0} x2={y} y2={py1} stroke={gridColor} strokeOpacity={0.3} strokeWidth={0.8} /> : <line key={`gl${i}`} x1={px0} y1={y} x2={px1} y2={y} stroke={gridColor} strokeOpacity={0.3} strokeWidth={0.8} />);
      children.push(horizontal ? <text key={`gt${i}`} x={y} y={py1 + FONT + 4} fontSize={FONT} textAnchor="middle" fill={hex(opts.valAxisLabelColor, "374151")}>{fmt(t)}</text> : <text key={`gt${i}`} x={px0 - 6} y={y + FONT / 3} fontSize={FONT} textAnchor="end" fill={hex(opts.valAxisLabelColor, "374151")}>{fmt(t)}</text>);
    });
    children.push(<line key="axis" x1={px0} y1={py1} x2={px1} y2={py1} stroke={gridColor} strokeOpacity={0.6} strokeWidth={1} />);

    if (isScatter && xs) {
      const xmax = niceScale(Math.max(...xs, 1)).top;
      const xmin = Math.min(0, ...xs);
      const sx = (v: number) => px0 + ((v - xmin) / (xmax - xmin || 1)) * (px1 - px0);
      for (let t = xmin; t <= xmax + 0.0001; t += niceScale(xmax).step) children.push(<text key={`xt${t}`} x={sx(t)} y={py1 + FONT + 4} fontSize={FONT} textAnchor="middle" fill={hex(opts.catAxisLabelColor, "374151")}>{fmt(t)}</text>);
      plot.forEach((s, si) => {
        const pts = s.values.map((v, i) => [sx(xs[i] ?? i), vy(v)]);
        if (pts.length > 1) children.push(<polyline key={`ln${si}`} points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color(si)} strokeWidth={num(opts.lineSize, 2)} />);
        pts.forEach((p, i) => {
          children.push(<circle key={`pt${si}-${i}`} cx={p[0]} cy={p[1]} r={4} fill={color(si)} />);
          if (showValue) children.push(<text key={`pv${si}-${i}`} x={p[0] + 4} y={p[1] - 6} fontSize={FONT - 1} fill={textColor}>{fmt(s.values[i])}</text>);
        });
      });
    } else {
      const slot = ((horizontal ? py1 - py0 : px1 - px0) || 1) / Math.max(cats, 1);
      // category labels
      for (let c = 0; c < cats; c++) {
        const mid = (horizontal ? py0 : px0) + slot * (c + 0.5);
        children.push(horizontal ? <text key={`ct${c}`} x={px0 - 6} y={mid + FONT / 3} fontSize={FONT} textAnchor="end" fill={hex(opts.catAxisLabelColor, "374151")}>{labels[c] ?? ""}</text> : <text key={`ct${c}`} x={mid} y={py1 + FONT + 4} fontSize={FONT} textAnchor="middle" fill={hex(opts.catAxisLabelColor, "374151")}>{labels[c] ?? ""}</text>);
      }
      if (type === "bar" || type === "bar-stacked") {
        const groupW = slot * 0.7;
        const barW = stacked ? groupW : groupW / plot.length;
        plot.forEach((s, si) => {
          s.values.forEach((v, c) => {
            const mid = (horizontal ? py0 : px0) + slot * (c + 0.5);
            const base = stacked ? plot.slice(0, si).reduce((sum, p) => sum + Math.max(0, p.values[c] ?? 0), 0) : 0;
            const a = vy(base);
            const b = vy(base + v);
            const along = (stacked ? 0 : (si - (plot.length - 1) / 2) * barW) - barW / 2;
            const zero = vy(Math.max(0, lo));
            const from = stacked ? a : zero;
            const to = stacked ? b : vy(v);
            const rect = horizontal ? { x: Math.min(from, to), y: mid + along, width: Math.abs(to - from), height: barW } : { x: mid + along, y: Math.min(from, to), width: barW, height: Math.abs(to - from) };
            children.push(<rect key={`b${si}-${c}`} {...rect} fill={color(si)} />);
            if (showValue) {
              const lx = horizontal ? Math.max(from, to) + 4 : rect.x + rect.width / 2;
              const ly = horizontal ? rect.y + rect.height / 2 + FONT / 3 : stacked ? rect.y + rect.height / 2 + FONT / 3 : rect.y - 4;
              children.push(<text key={`bv${si}-${c}`} x={lx} y={ly} fontSize={FONT - 1} textAnchor={horizontal ? "start" : "middle"} fill={stacked ? "#111827" : textColor}>{fmt(v)}</text>);
            }
          });
        });
      } else {
        plot.forEach((s, si) => {
          const pts = s.values.map((v, c) => [px0 + slot * (c + 0.5), vy(v)]);
          if (type === "area") children.push(<polygon key={`ar${si}`} points={`${pts[0]?.[0]},${py1} ${pts.map((p) => p.join(",")).join(" ")} ${pts[pts.length - 1]?.[0]},${py1}`} fill={color(si)} fillOpacity={0.25} />);
          children.push(<polyline key={`ln${si}`} points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color(si)} strokeWidth={num(opts.lineSize, 2)} strokeLinejoin="round" />);
          pts.forEach((p, i) => {
            children.push(<circle key={`pt${si}-${i}`} cx={p[0]} cy={p[1]} r={3.5} fill={color(si)} />);
            if (showValue) children.push(<text key={`pv${si}-${i}`} x={p[0]} y={p[1] - 7} fontSize={FONT - 1} textAnchor="middle" fill={textColor}>{fmt(s.values[i])}</text>);
          });
        });
      }
    }
  }

  // legend along the bottom
  if (legendH > 0) {
    const itemW = Math.min(150, (W - 20) / legendItems.length);
    const startX = (W - itemW * legendItems.length) / 2;
    legendItems.forEach((it, i) => {
      children.push(<rect key={`lg${i}`} x={startX + i * itemW} y={H - 20} width={9} height={9} fill={it.color} />);
      children.push(<text key={`lt${i}`} x={startX + i * itemW + 14} y={H - 12} fontSize={FONT - 2} fill={textColor}>{it.name.length > 22 ? `${it.name.slice(0, 21)}…` : it.name}</text>);
    });
  }

  return (
    <svg style={{ ...style, overflow: "hidden" }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${type} chart${all[0]?.name ? `: ${all[0].name}` : ""}`} fontFamily="Calibri, Carlito, 'Segoe UI', Helvetica, Arial, sans-serif">
      {empty ? <text x={W / 2} y={H / 2} fontSize={FONT} textAnchor="middle" fill={textColor}>No data</text> : children}
    </svg>
  );
}
