import { defineLayout } from "../pptx/layoutRegistry.js";

// Example community layout: a pricing table with up to four plans side by
// side. Copy this file to start your own layout.
//
//   { "layout": "pricing", "title": "Plans", "plans": [
//       { "name": "Free", "price": "$0", "features": ["1 project"] },
//       { "name": "Pro", "price": "$12", "period": "/month", "features": ["Unlimited projects"], "highlight": true } ] }

interface Plan {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlight: boolean;
}

interface PricingData {
  title?: string;
  plans: Plan[];
}

const MAX_PLANS = 4;
const MAX_FEATURES = 6;

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export const pricing = defineLayout<PricingData>({
  name: "pricing",
  description: "Two to four plans or options side by side, each with a price and a short feature list. One can be highlighted.",
  normalize(raw) {
    if (!Array.isArray(raw.plans)) return null;
    const plans: Plan[] = [];
    for (const p of raw.plans.slice(0, MAX_PLANS)) {
      if (!p || typeof p !== "object") continue;
      const r = p as Record<string, unknown>;
      const name = text(r.name, 40);
      const price = text(r.price, 20);
      if (!name || !price) continue;
      const features = Array.isArray(r.features)
        ? r.features.map((f) => text(f, 80)).filter(Boolean).slice(0, MAX_FEATURES)
        : [];
      plans.push({ name, price, period: text(r.period, 20) || undefined, features, highlight: r.highlight === true });
    }
    if (plans.length === 0) return null;
    return { title: text(raw.title, 100) || undefined, plans };
  },
  render({ slide, colors, helpers }, data) {
    helpers.chrome(data.title);
    const n = data.plans.length;
    const gap = 0.3;
    const margin = 0.7;
    const cardW = (helpers.slideWidth - margin * 2 - gap * (n - 1)) / n;
    const top = helpers.contentTop + 0.35;
    const cardH = helpers.contentBottom - top - 0.1;
    const pad = 0.3;

    data.plans.forEach((plan, i) => {
      const x = margin + i * (cardW + gap);
      slide.addShape("roundRect", {
        x, y: top, w: cardW, h: cardH, rectRadius: 0.12,
        fill: { color: colors.accent, transparency: plan.highlight ? 82 : 94 },
        line: plan.highlight ? { color: colors.accent, width: 2 } : { type: "none" },
      });
      if (plan.highlight) {
        // The badge text sits on the accent color, so it uses the background color, which the engine keeps readable against the accent.
        slide.addShape("roundRect", {
          x: x + cardW / 2 - 0.65, y: top - 0.17, w: 1.3, h: 0.34, rectRadius: 0.17,
          fill: { color: colors.accent }, line: { type: "none" },
        });
        slide.addText("MOST POPULAR", {
          x: x + cardW / 2 - 0.65, y: top - 0.17, w: 1.3, h: 0.34,
          fontSize: 9, bold: true, align: "center", valign: "middle", color: colors.background, fontFace: colors.bodyFont, isTextBox: true, margin: 0,
        });
      }
      slide.addText(helpers.clean(plan.name), {
        x: x + pad, y: top + 0.3, w: cardW - pad * 2, h: 0.4,
        fontSize: 18, bold: true, color: colors.titleColor, fontFace: colors.headingFont, isTextBox: true, margin: 0,
      });
      slide.addText(
        [
          { text: helpers.clean(plan.price), options: { fontSize: 38, bold: true, color: colors.accent } },
          ...(plan.period ? [{ text: ` ${helpers.clean(plan.period)}`, options: { fontSize: 13, color: colors.bodyColor } }] : []),
        ],
        { x: x + pad, y: top + 0.75, w: cardW - pad * 2, h: 0.8, valign: "middle", fontFace: colors.headingFont, isTextBox: true, margin: 0 },
      );
      if (plan.features.length) {
        slide.addText(
          plan.features.map((f, k) => ({
            text: helpers.clean(f),
            options: { bullet: { code: "2713" }, breakLine: k < plan.features.length - 1, paraSpaceAfter: 9 },
          })),
          {
            x: x + pad, y: top + 1.75, w: cardW - pad * 2, h: cardH - 1.95,
            fontSize: 13, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "top", isTextBox: true, margin: 0,
          },
        );
      }
    });
  },
  example: {
    layout: "pricing",
    title: "Choose a plan",
    plans: [
      { name: "Free", price: "$0", features: ["1 project", "Community support"] },
      { name: "Pro", price: "$12", period: "/month", features: ["Unlimited projects", "Priority support", "Export to PDF"], highlight: true },
      { name: "Team", price: "$40", period: "/month", features: ["Everything in Pro", "Shared workspace", "Admin controls"] },
    ],
  },
});
