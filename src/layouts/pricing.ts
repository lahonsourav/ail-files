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
    const gap = 0.25;
    const margin = 0.6;
    const cardW = (helpers.slideWidth - margin * 2 - gap * (n - 1)) / n;
    const top = helpers.contentTop + 0.1;
    const cardH = Math.min(helpers.contentBottom - top, 3.1);

    data.plans.forEach((plan, i) => {
      const x = margin + i * (cardW + gap);
      slide.addShape("roundRect", {
        x, y: top, w: cardW, h: cardH, rectRadius: 0.1,
        fill: { color: colors.accent, transparency: plan.highlight ? 80 : 94 },
        line: plan.highlight ? { color: colors.accent, width: 1.5 } : { type: "none" },
      });
      slide.addText(helpers.clean(plan.name), {
        x: x + 0.2, y: top + 0.15, w: cardW - 0.4, h: 0.4,
        fontSize: 16, bold: true, color: colors.titleColor, fontFace: colors.headingFont, isTextBox: true, margin: 0,
      });
      slide.addText(
        [
          { text: helpers.clean(plan.price), options: { fontSize: 28, bold: true, color: colors.accent } },
          ...(plan.period ? [{ text: ` ${helpers.clean(plan.period)}`, options: { fontSize: 12, color: colors.bodyColor } }] : []),
        ],
        { x: x + 0.2, y: top + 0.55, w: cardW - 0.4, h: 0.6, fontFace: colors.headingFont, isTextBox: true, margin: 0 },
      );
      if (plan.features.length) {
        slide.addText(
          plan.features.map((f, k) => ({
            text: helpers.clean(f),
            options: { bullet: true, breakLine: k < plan.features.length - 1, paraSpaceAfter: 4 },
          })),
          {
            x: x + 0.2, y: top + 1.25, w: cardW - 0.4, h: cardH - 1.4,
            fontSize: 11, color: colors.bodyColor, fontFace: colors.bodyFont, valign: "top", isTextBox: true, margin: 0,
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
