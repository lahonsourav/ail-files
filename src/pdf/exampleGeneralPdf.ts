import type { GeneralPdf } from "./pdfDocBuilder.js";

// Fixed marketing sample shown on /domain/pdf_maker — same idea as
// lib/exampleDeck.ts for PPT Maker: a real, deterministic render of actual
// product output, not a mockup. Deliberately a one-pager about Ail itself
// (fitting, and it exercises every section type PDF Maker supports —
// paragraphs, bullets, a numbered list, tables, both chart types (bar and
// pie — see PdfChartType in lib/pdfDocBuilder.ts), a callout, and a
// two-column block — in one cohesive document, rather than a toy example
// that only shows one at a time).
export const EXAMPLE_PDF_PROMPT =
  "Make me a one-page PDF overview of Ail — what it is, pricing, and the business model — I can share with investors.";

export const EXAMPLE_PDF: GeneralPdf = {
  title: "Ail — Your AI Lighthouse",
  subtitle: "Pay Per Task, Not Per Month · ailighthouse.in",
  sections: [
    {
      paragraphs: [
        "Ail (AI Lighthouse) is a free-to-try AI platform organised into 31 specialised task domains, each with its own tuned system prompt, pricing tiers, and free trial. Unlike general-purpose AI subscriptions, Ail is billed per task — you pay only for the work in front of you, not a recurring monthly fee.",
      ],
    },
    {
      heading: "The Problem",
      paragraphs: [
        "Most AI tools charge $20/month flat — whether used once a week or fifty times a day. A student writing one thesis chapter, a job seeker polishing one resume, or a founder drafting one pitch deck doesn't need a monthly subscription — they need that one task done well.",
      ],
      bullets: [
        "Typical AI subscription: $20/month (~Rs. 1,700) whether used or not",
        "Tasks most people actually need per month: 1-3",
        "Result: most subscribers are paying for AI they don't use",
      ],
    },
    {
      heading: "Ail vs. a Typical Subscription",
      columns: {
        left: {
          heading: "Ail",
          bullets: ["Pay only for the task you need", "5 free responses per domain to try first", "Tokens never expire"],
        },
        right: {
          heading: "Typical AI Subscription",
          bullets: ["Flat $20/month whether used or not", "Limited free tier, if any", "Unused allowance resets monthly"],
        },
      },
    },
    {
      heading: "Platform Overview",
      table: {
        headers: ["Category", "Example Domains"],
        rows: [
          ["Students & Academics", "Thesis, Research Report, Exam Prep, Career Guide"],
          ["Professionals", "Resume & Cover Letter, Interview Prep, Startup Pitch"],
          ["Legal, Medical & Government", "Legal Review, Medical Summary, Government Forms"],
          ["Content Creators", "Social Media, Podcast Scripts, Poetry & Shayari"],
          ["Tools", "PPT Maker, PDF Maker, DOCX Maker, Excel Maker"],
        ],
      },
    },
    {
      heading: "Monthly Cost: Subscription vs. Ail",
      chart: {
        type: "bar",
        title: "Cost for a Light-Usage Month (Rs.)",
        data: [
          { label: "ChatGPT Plus", value: 1700 },
          { label: "Claude Pro", value: 1700 },
          { label: "Ail (1 Task)", value: 150 },
        ],
      },
    },
    {
      heading: "Domain Category Breakdown",
      chart: {
        type: "pie",
        title: "31 Domains Across 6 Categories",
        data: [
          { label: "Students & Academics", value: 12 },
          { label: "Professionals", value: 10 },
          { label: "Content Creators", value: 6 },
          { label: "Legal/Medical/Govt", value: 4 },
          { label: "Language, Culture & General", value: 3 },
        ],
      },
    },
    {
      heading: "Key Features",
      bullets: [
        "No subscription trap — pay only for the task in front of you",
        "Unlimited revisions within your token budget, no per-message fee",
        "Model choice — auto-routes between Haiku, Sonnet, and Opus, or pick manually",
        "Generate real files — PPT, PDF, Word, and Excel documents, not just text",
        "Bring-Your-Own-Key (BYOK) — pay Anthropic directly instead of Ail's Sparks budget",
      ],
    },
    {
      heading: "Pricing in Practice",
      paragraphs: [
        "Starting price across the platform is just Rs. 29 (~$0.35). Higher tiers unlock bigger token budgets, document upload, and stronger models.",
      ],
      table: {
        headers: ["Domain", "Basic", "Standard", "Premium"],
        rows: [
          ["Resume & Cover Letter", "Rs. 69", "Rs. 149", "Rs. 349"],
          ["Legal Review", "Rs. 149", "Rs. 349", "Rs. 699"],
          ["PDF Maker", "Rs. 79", "Rs. 199", "Rs. 399"],
          ["Social Media", "Rs. 29", "Rs. 79", "Rs. 149"],
        ],
      },
    },
    {
      callout: {
        kind: "important",
        text: "Sparks — Ail's usage credit — never expire. Unlike a subscription's monthly reset, unused budget carries forward indefinitely.",
      },
    },
    {
      heading: "Business Model",
      numbered: [
        "Free trial (5 responses/domain) converts to a paid one-time task package",
        "Add-on fees: BYOK activation Rs. 49; PPT/PDF/DOCX/Excel plugin Rs. 99; document-upload unlock on lower tiers",
        "Bundle & save: buy 3 or more packages in one order across any domains and get 15% off",
        "Ambassador/referral programme: existing users earn credit when a referred user completes their first paid transaction",
      ],
    },
  ],
};
