import type { SlideDeck } from "./presentationBuilder.js";

// The prompt ExamplePreview.tsx shows as though a real user typed it —
// EXAMPLE_DECK's own background/accent below are exactly what that prompt's
// theme phrase would resolve to, so the shown-prompt and shown-output
// actually match instead of merely sitting next to each other.
export const EXAMPLE_PROMPT =
  "Use the uploaded file for reference. Make an investor-style pitch deck for Ail, our own AI platform — the problem, our solution, market breakdown, feature comparison, cost trends, revenue model, growth outlook, roadmap, and a recommended plan for different kinds of users. Use a clean blue and white theme.";

// Shown above the prompt bubble in ExamplePreview.tsx as though the user
// had attached this before asking — matches the product's real reference-
// document upload, which accepts .pdf/.docx/.txt/.csv (see a chat UI's
// docRef/fileRef inputs), never .pptx itself.
export const EXAMPLE_UPLOADED_FILE = "Ail-platform-overview.docx";

// Fixed marketing sample shown on /domain/ppt_maker before purchase — real
// content rendered by the same builder real decks use (see
// app/api/presentations/example/route.ts), not a mockup. Deliberately hits
// EVERY layout the builder supports (see the SlideContent union in
// lib/presentationBuilder.ts — this includes "canvas" and "presenter" too,
// even though the model itself only reaches for those in narrower
// circumstances: canvas behind the ppt_canvas_layout beta flag, presenter
// only when a user explicitly asks to be credited) and every chart type
// (bar/line/pie/doughnut/bar-stacked/scatter/radar/area) at least once, so
// this one deck is a complete visual tour of what the tool can build — not
// just a realistic pitch deck, a kitchen-sink one. Colors match the real Ail deck a prior
// conversation actually generated (white background FFFFFF, blue accent
// 2563EB), so the shown example is the tool's genuine output, not a
// separately hand-styled mockup. ExamplePreview.tsx's inline preview only
// ever reads slides[0], so later slides are free to use any layout without
// touching that component.
//
// Run `grep -oP 'layout: "\K[a-z_]+' lib/presentationBuilder.ts | sort -u`
// against this file's own layouts whenever a new one ships — this deck's
// whole point is 100% coverage, so a gap here is a regression, not a
// stylistic choice.
export const EXAMPLE_DECK: SlideDeck = {
  title: "Ail",
  subtitle: "Your AI Lighthouse — Pay Per Task, Not Per Month",
  background: "FFFFFF",
  accent: "2563EB",
  slides: [
    {
      title: "The Problem",
      icon: "warning",
      bullets: [
        "Most AI tools charge $20/month flat — used once a week or fifty times a day",
        "Students, job seekers, and founders doing one or two tasks a month overpay badly",
        "In price-sensitive markets like India, Nepal, and Bangladesh, a recurring USD subscription is a real barrier",
        "General-purpose chatbots aren't tuned for any specific task",
      ],
    },
    {
      layout: "problem_solution",
      title: "Subscription Fatigue, Solved",
      icon: "idea",
      problem: "A flat monthly fee whether you use the AI once or fifty times — most of that spend is wasted on idle months.",
      solution: "Ail charges per task, not per month. Pick a domain, try it free, then buy only the token budget you need. Tokens never expire.",
    },
    {
      layout: "glossary",
      title: "Terms Worth Knowing",
      terms: [
        { term: "Domain", definition: "A specialised task category — Thesis, Resume, Legal Review, PPT Maker, and 24 more." },
        { term: "Sparks", definition: "Ail's usage credit, drawn from a package's token budget as you chat. Never expires." },
        { term: "BYOK", definition: "Bring Your Own Key — pay Anthropic directly instead of drawing from a Sparks budget." },
        { term: "Free Trial", definition: "5 free AI responses per domain, no card required, before any purchase." },
      ],
    },
    {
      layout: "stat",
      value: "28",
      caption: "Specialised domains, one platform — from thesis writing to legal review to startup pitches",
      icon: "globe",
    },
    {
      layout: "stats_row",
      title: "Why the Subscription Model Fails Most Users",
      icon: "money",
      stats: [
        { value: "₹1,700", label: "Typical monthly cost of ChatGPT Plus or Claude Pro" },
        { value: "1–3", label: "Tasks most people actually need AI help with per month" },
        { value: "₹0", label: "What Ail costs you in a month you don't need it" },
      ],
    },
    {
      layout: "chart",
      title: "28 Domains Across 6 Categories",
      chartType: "pie",
      categories: ["Students & Academics", "Professionals", "Content Creators", "Legal/Medical/Govt", "Language & Culture", "General"],
      values: [12, 10, 6, 4, 2, 1],
      icon: "chart",
    },
    { layout: "section", eyebrow: "PART TWO", title: "How Ail Works" },
    {
      layout: "hero",
      eyebrow: "The promise",
      title: "One Task. One Payment. Zero Subscriptions.",
      subtitle: "Every domain boils down to the same three steps.",
      pillars: [
        { label: "PICK", description: "Choose from 28 specialised domains" },
        { label: "TRY", description: "5 free responses, no card required" },
        { label: "BUY", description: "A token budget sized for your task" },
      ],
    },
    {
      layout: "process",
      title: "Three Simple Steps",
      icon: "rocket",
      caption: "One task. One payment. Zero subscriptions.",
      steps: [
        { title: "Pick a Domain", description: "Choose from 28 specialised domains — Thesis, Resume, Legal Review, Startup Pitch, and more" },
        { title: "Try It Free", description: "5 free AI responses per domain, no credit card required" },
        { title: "Buy What You Need", description: "A token-budget package sized for your task. Chat until it's done. Tokens never expire." },
      ],
    },
    {
      layout: "flowchart",
      title: "How Pricing Decides Itself",
      icon: "gear",
      nodes: [
        { id: "start", text: "Pick a Domain", type: "start", position: { x: 1, y: 0.05 }, connections: ["decision"] },
        { id: "decision", text: "Free Trial Left?", type: "decision", position: { x: 4, y: 0.05 }, connections: ["free", "buy"] },
        { id: "free", text: "Use a Free Reply", type: "process", position: { x: 1.5, y: 0.45 }, connections: ["done"] },
        { id: "buy", text: "Buy a Package", type: "process", position: { x: 6.5, y: 0.45 }, connections: ["done"] },
        { id: "done", text: "Chat Until the Task Is Done", type: "end", position: { x: 4, y: 0.85 } },
      ],
    },
    {
      layout: "grid",
      title: "Key Features",
      icon: "gear",
      items: [
        { title: "No Subscription Trap", description: "Pay only for the task in front of you — idle months cost ₹0", icon: "money" },
        { title: "Document Upload", description: "Read PDFs, Word, PowerPoint, Excel, and images directly", icon: "book" },
        { title: "Model Choice", description: "Auto-routes between Haiku, Sonnet, and Opus, or pick manually", icon: "target" },
        { title: "ATS Resume Score", description: "Real AI assessment against a pasted job description", icon: "checklist" },
        { title: "One-Click Citations", description: "APA / MLA / Chicago citations generated inline", icon: "book" },
        { title: "Localised by Default", description: "Responds in your country's context — currency, law, tone", icon: "globe" },
      ],
    },
    {
      layout: "iconlist",
      title: "Built-In Tools, Not Add-Ons",
      icon: "checklist",
      items: [
        { text: "Voice input — dictate instead of typing", icon: "idea" },
        { text: "Bring your own Anthropic key, anytime", icon: "shield" },
        { text: "Export to PDF or Word, or a read-only share link", icon: "book" },
        { text: "Conversations encrypted at rest, never used to train models", icon: "shield" },
        { text: "Bundle 3+ packages across any domain for 15% off", icon: "money" },
      ],
    },
    {
      layout: "comparison",
      title: "Ail vs. a Typical Subscription",
      icon: "chart",
      left: {
        heading: "Ail",
        bullets: ["Pay only for the task you need", "5 free responses per domain to try first", "Tokens never expire", "₹0 in a month you don't use it"],
      },
      right: {
        heading: "Typical AI Subscription",
        bullets: ["Flat $20/month whether used or not", "Limited free tier, if any", "Unused allowance resets monthly", "Full price even in an idle month"],
      },
    },
    {
      layout: "matrix",
      title: "Model Tiers at a Glance",
      icon: "target",
      rows: ["Haiku", "Sonnet", "Opus"],
      cols: ["Speed", "Best For"],
      cells: [
        [{ content: "Fastest", highlight: true }, { content: "Quick drafts — Basic tier" }],
        [{ content: "Balanced" }, { content: "Most everyday tasks — Standard tier" }],
        [{ content: "Most capable", highlight: true }, { content: "Polished, high-stakes work — Premium tier" }],
      ],
    },
    {
      layout: "table",
      title: "Ail vs. The Competition",
      icon: "chart",
      columnColors: ["2563EB", "2563EB", "9CA3AF", "9CA3AF", "9CA3AF"],
      headers: ["Feature", "Ail", "ChatGPT Plus", "Claude Pro", "Fiverr"],
      rows: [
        ["Pricing model", { text: "Pay per task", highlight: true }, "$20/month flat", "$20/month flat", "Per gig, $20–100+"],
        ["Free trial", { text: "5 responses/domain, no card", status: "yes" }, { text: "Limited free tier", status: "no" }, { text: "Limited free tier", status: "no" }, { text: "Rarely free", status: "no" }],
        ["Task specialisation", { text: "28 tuned domains", status: "yes" }, { text: "General purpose", status: "no" }, { text: "General purpose", status: "no" }, { text: "Depends on freelancer", status: "no" }],
        ["Idle-month cost", { text: "₹0", highlight: true }, "Full price", "Full price", "₹0"],
        ["Unused credit expires?", { text: "Never expires", status: "yes" }, { text: "Resets monthly", status: "no" }, { text: "Resets monthly", status: "no" }, "N/A"],
        ["Bring-your-own-key", { text: "Yes", status: "yes" }, { text: "No", status: "no" }, { text: "No", status: "no" }, { text: "No", status: "no" }],
      ],
    },
    {
      layout: "advanced_table",
      title: "Domain Capabilities at Launch",
      icon: "checklist",
      sortable: true,
      filterable: true,
      headers: ["Capability", "Free Trial", "Standard", "Premium"],
      rows: [
        [{ text: "Document upload" }, { text: "No", status: "no" }, { text: "No", status: "no" }, { text: "Yes", status: "yes" }],
        [{ text: "Unlimited revisions within budget" }, { text: "Limited", status: "warning" }, { text: "Yes", status: "yes" }, { text: "Yes", status: "yes" }],
        [{ text: "Opus-tier model" }, { text: "No", status: "no" }, { text: "No", status: "no" }, { text: "Yes", status: "yes", highlight: true }],
        [{ text: "Card required to start" }, { text: "No", status: "yes" }, { text: "No", status: "yes" }, { text: "No", status: "yes" }],
      ],
    },
    {
      layout: "chart",
      title: "Cost for a Light-Usage Month (₹)",
      chartType: "bar",
      categories: ["ChatGPT Plus", "Claude Pro", "Ail (1 Standard Task)"],
      values: [1700, 1700, 150],
      icon: "money",
    },
    {
      layout: "chart",
      title: "Monthly Active Conversations",
      chartType: "line",
      categories: ["M1", "M2", "M3", "M4", "M5", "M6"],
      values: [1200, 2100, 3400, 5200, 7600, 10500],
      icon: "growth",
    },
    {
      layout: "chart",
      title: "Revenue by Stream",
      chartType: "doughnut",
      categories: ["Task Packages", "Add-Ons (BYOK/PPT/Upload)", "Bundles"],
      values: [70, 18, 12],
      icon: "chart",
    },
    {
      layout: "chart",
      title: "Domains Added by Category",
      chartType: "bar-stacked",
      categories: ["Year 1", "Year 2"],
      series: [
        { name: "Students & Academics", values: [8, 12] },
        { name: "Professionals", values: [6, 10] },
        { name: "Other categories", values: [4, 8] },
      ],
      icon: "chart",
    },
    {
      layout: "chart",
      title: "Sparks Consumed vs. Task Length",
      chartType: "scatter",
      categories: ["1", "2", "3", "4", "5", "6"],
      values: [1200, 2100, 3400, 4300, 5100, 6200],
      icon: "activity",
    },
    {
      layout: "chart",
      title: "Where Ail Scores Highest",
      chartType: "radar",
      categories: ["Cost Efficiency", "No Commitment", "Task Specialisation", "Trial Access", "Flexibility"],
      values: [9, 10, 8, 9, 7],
      icon: "target",
    },
    {
      layout: "chart",
      title: "Cumulative Sign-Ups Since Launch",
      chartType: "area",
      categories: ["M1", "M2", "M3", "M4", "M5", "M6"],
      values: [1200, 3300, 6700, 11900, 19500, 30000],
      icon: "growth",
    },
    {
      layout: "funnel",
      title: "From Visitor to Paying User",
      icon: "target",
      stages: [
        { label: "Site Visitors", value: "100,000" },
        { label: "Sign-Ups", value: "18,000" },
        { label: "Free Trial Responses Used", value: "12,500" },
        { label: "Paying Users", value: "3,200" },
      ],
    },
    {
      layout: "ranked",
      title: "Why Users Pick Ail",
      icon: "celebration",
      items: [
        "No subscription — pay only for what you use",
        "28 specialised domains tuned for real tasks",
        "Tokens never expire",
        "Bring-your-own-key option for power users",
        "Built-in tools: ATS score, citations, document upload",
      ],
    },
    {
      layout: "timeline",
      title: "Product Roadmap",
      icon: "calendar",
      steps: [
        { label: "Now — Live", detail: "28 domains, Sparks billing, BYOK, document upload, voice input, ATS scoring" },
        { label: "Next — PPT Maker", detail: "Dedicated PPT Maker domain, per-conversation plugin for every other domain" },
        { label: "Later — Scale", detail: "More domains, team accounts, developer API access, mobile app" },
      ],
    },
    {
      layout: "roadmap",
      title: "Building the Document Engine",
      icon: "gear",
      currentIndex: 3,
      steps: [
        { label: "Canvas layout (beta)", description: "Free-form dynamic slide composition." },
        { label: "Monochrome icons", description: "Rasterized, theme-tinted icon system replacing colored emoji." },
        { label: "Recap, glossary, roadmap", description: "Three new fixed layouts, shipped this release." },
        { label: "Unlimited doc-gen tokens", description: "Removed the package cap that could truncate a large deck." },
      ],
    },
    {
      layout: "calendar",
      title: "2026 Launch Milestones",
      icon: "calendar",
      period: "2026",
      events: [
        { date: "Jan", title: "PPT Maker domain launches", highlight: true },
        { date: "Mar", title: "Canvas free-form layout (beta)" },
        { date: "Jun", title: "Team accounts" },
        { date: "Sep", title: "Developer API access" },
      ],
    },
    {
      layout: "canvas",
      title: "Free-Form Layouts, When You Need Them",
      icon: "gear",
      elements: [
        { type: "text", x: 0.5, y: 1.0, w: 4, h: 1, text: "3,200+", fontRole: "heading", textRole: "accent", size: "xl", bold: true },
        { type: "text", x: 0.5, y: 1.9, w: 4, h: 0.6, text: "Paying users onboarded through pay-per-task pricing", fontRole: "body", textRole: "body", size: "sm" },
        { type: "shape", x: 0.5, y: 2.7, w: 4, h: 1.9, shape: "roundRect", fillRole: "card" },
        { type: "icon", x: 0.7, y: 2.9, w: 0.6, h: 0.6, icon: "growth" },
        { type: "text", x: 1.5, y: 2.95, w: 2.8, h: 0.5, text: "Bespoke composition", fontRole: "heading", textRole: "title", size: "sm", bold: true },
        { type: "text", x: 0.7, y: 3.55, w: 3.6, h: 0.9, text: "Text, shapes, icons, charts, and tables placed exactly where a slide needs them.", fontRole: "body", textRole: "body", size: "xs" },
        { type: "chart", x: 5, y: 1.0, w: 4.5, h: 2.1, chartType: "bar", categories: ["M1", "M3", "M5"], values: [1200, 3400, 7600], title: "Active Conversations" },
        { type: "table", x: 5, y: 3.3, w: 4.5, h: 1.3, headers: ["Layout", "Kind"], rows: [["canvas", "Free-form"], ["hero", "Full-bleed"]] },
      ],
    },
    {
      layout: "columns",
      title: "Key Risks & Mitigation",
      icon: "shield",
      left: { heading: "Risk", bullets: ["Anthropic API cost volatility", "Low awareness in a subscription-first market", "Free-trial abuse"] },
      right: { heading: "Mitigation", bullets: ["Model auto-routing keeps average cost low", "Pay-per-task pricing is the differentiator to lead with", "Per-domain trial caps and rate limits"] },
    },
    {
      layout: "team",
      title: "Who Ail Is Built For",
      icon: "target",
      members: [
        { name: "The Student", role: "School to PhD", description: "Thesis chapters, exam prep, assignments, academic emails", icon: "book" },
        { name: "The Job Seeker", role: "Career transition", description: "Resume, cover letter, interview prep, career guidance", icon: "target" },
        { name: "The Founder", role: "Early-stage startup", description: "Pitch decks, business content, startup narratives", icon: "rocket" },
        { name: "The Creator", role: "Content & social", description: "Captions, bios, podcast scripts, poetry", icon: "idea" },
      ],
    },
    {
      layout: "gallery",
      title: "What People Build With Ail",
      icon: "book",
      arrangement: "grid",
      items: [
        { title: "Investor Pitch Decks", description: "Market sizing, roadmap, and funding ask, generated slide by slide.", caption: "Startup founders", icon: "rocket" },
        { title: "Thesis Chapters", description: "Structured academic writing with proper citations.", caption: "Graduate students", icon: "book" },
        { title: "ATS-Scored Resumes", description: "Tailored to a specific job description, scored before you apply.", caption: "Job seekers", icon: "target" },
      ],
    },
    {
      layout: "presenter",
      presenters: [
        {
          name: "The Ail Team",
          role: "Building Ail",
          bio: "Independent builders shipping Ail as a pay-per-task alternative to AI subscriptions.",
          contact: ["ailighthouse.in"],
        },
      ],
    },
    {
      layout: "recap",
      title: "The Story So Far",
      icon: "idea",
      example: {
        heading: "Case in Point",
        text: "A student pays ₹149 once for a thesis chapter, instead of ₹1,700/month for a subscription they'd use twice.",
      },
      takeaways: [
        "28 specialised domains, one platform",
        "Pay per task — idle months cost ₹0",
        "Real files: PPT, PDF, Word, and Excel, not just text",
      ],
    },
    {
      layout: "tiers",
      title: "Every Domain, Three Tiers",
      icon: "money",
      tiers: [
        { label: "Free Trial", description: "5 responses per domain — no card required" },
        { label: "Standard", description: "A full task's worth of budget, from ₹149" },
        { label: "Premium", description: "Opus-tier quality, document upload, biggest budget" },
      ],
    },
    {
      layout: "recommendation",
      title: "Which Plan Should You Start With?",
      icon: "checklist",
      options: [
        { heading: "Just trying it out", items: ["No commitment", "Want to see the quality first"], outcomeLabel: "START WITH", outcome: "Free Trial", outcomeDetail: "5 responses per domain, no card needed", rationale: "Zero risk way to evaluate Ail on your real task" },
        { heading: "One-off task", items: ["A single resume, essay, or deck", "Done in one sitting"], outcomeLabel: "START WITH", outcome: "Standard Package", outcomeDetail: "From ₹149, sized for the task", rationale: "Best balance of budget and model quality" },
        { heading: "Ongoing heavy use", items: ["Multiple domains, regularly", "Want direct API billing"], outcomeLabel: "START WITH", outcome: "Premium + BYOK", outcomeDetail: "Opus-tier quality, pay Anthropic directly", rationale: "Lowest per-task cost at high volume" },
      ],
    },
    {
      layout: "quote_carousel",
      title: "What Early Users Say",
      icon: "chat",
      quotes: [
        { quote: "I used to pay for a subscription I opened twice a month. Now I pay for exactly the one thesis chapter I needed.", author: "Graduate student, early user" },
        { quote: "Tried it free, bought the Standard package for one pitch deck, done in an afternoon.", author: "First-time founder" },
      ],
    },
    {
      layout: "quote",
      quote: "Pay per task, not per month — your AI lighthouse, exactly when you need it.",
      author: "Ail — ailighthouse.in",
      icon: "celebration",
    },
    {
      layout: "thank_you",
      subtitle: "Try Ail free — no card required.",
      contact: ["ailighthouse.in"],
    },
  ],
};
