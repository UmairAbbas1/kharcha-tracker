/**
 * generate_pptx_node.js
 * Generates kharcha-tracker-phase4.pptx using pptxgenjs (Node.js).
 * Companion to generate_pptx.py for environments where Python is unavailable.
 */

const PptxGenJS = require("pptxgenjs");
const path = require("path");

// ── Palette ────────────────────────────────────────────────────────────────
const ROYAL_BLUE = "4169E1";
const WHITE      = "FFFFFF";
const LIGHT_BLUE = "EEF2FF";
const DARK_TEXT  = "1E1E32";
const MID_GREY   = "B4B4BE";
const FONT       = "Calibri";

function newPrs() {
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";
  return prs;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function rect(slide, x, y, w, h, fillColor, lineColor) {
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: fillColor || "FFFFFF" },
    line: { color: lineColor || fillColor || "FFFFFF", pt: lineColor ? 1 : 0 },
  });
}

function blueTopBar(slide)    { rect(slide, 0, 0, "100%", 0.08, ROYAL_BLUE); }
function blueBottomBar(slide) { rect(slide, 0, 7.42, "100%", 0.08, ROYAL_BLUE); }

function blueTitle(slide, text, y = 0.22) {
  slide.addText(text, {
    x: 0.5, y, w: 12.33, h: 0.7,
    fontSize: 30, bold: true, color: ROYAL_BLUE, fontFace: FONT, align: "left",
  });
}
function divider(slide, y = 1.02) {
  rect(slide, 0.5, y, 12.33, 0.04, ROYAL_BLUE);
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ══════════════════════════════════════════════════════════════════════════════
function slide1(prs) {
  const s = prs.addSlide();
  s.background = { color: ROYAL_BLUE };
  rect(s, 0, 0, "100%", 0.12, WHITE);
  rect(s, 0, 7.38, "100%", 0.12, WHITE);

  s.addText("Kharcha Tracker", {
    x: 1, y: 1.7, w: 11.33, h: 1.3,
    fontSize: 54, bold: true, color: WHITE, fontFace: FONT, align: "center",
  });
  s.addText("Pakistan\u2019s First AI-Native Expense Tracker", {
    x: 1, y: 3.15, w: 11.33, h: 0.75,
    fontSize: 24, color: WHITE, fontFace: FONT, align: "center",
  });
  rect(s, 4.5, 4.2, 4.33, 0.04, WHITE);
  s.addText("Phase 4 R\u0026D Plan \u2014 July 2026", {
    x: 1, y: 4.4, w: 11.33, h: 0.6,
    fontSize: 18, color: WHITE, fontFace: FONT, align: "center",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — The Problem
// ══════════════════════════════════════════════════════════════════════════════
function slide2(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "The Problem");
  divider(s, 1.05);

  const bullets = [
    "Pakistanis track expenses manually \u2014 in notebooks or WhatsApp messages",
    "Global apps (Toshl, Spendee) don\u2019t understand PKR, Easypaisa, or JazzCash",
    "No app sends WhatsApp budget alerts or parses bank SMS automatically",
  ];
  let y = 1.3;
  bullets.forEach(b => {
    s.addText("\u25C6  " + b, {
      x: 0.5, y, w: 12.33, h: 1.5,
      fontSize: 20, color: DARK_TEXT, fontFace: FONT, align: "left", valign: "middle", wrap: true,
    });
    y += 1.6;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — USP Table
// ══════════════════════════════════════════════════════════════════════════════
function slide3(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "Our Unique Advantage");
  divider(s, 1.0);

  const rows = [
    ["Competitors", "Kharcha Tracker"],
    ["AI OCR is paid-only", "AI Receipt Scanning \u2014 FREE"],
    ["No WhatsApp alerts", "WhatsApp Budget Alerts"],
    ["USD-first, global design", "PKR-native, Pakistani receipts"],
    ["No voice entry", "Urdu + English Voice Entry (Phase 4)"],
    ["No bank SMS parsing", "HBL/MCB/UBL SMS Auto-Parse (Phase 4)"],
    ["Paid team features", "Free multi-user workspaces"],
  ];

  const tableData = rows.map((row, r) => {
    const isHeader = r === 0;
    const isOdd = r % 2 === 1;
    const bg = isHeader ? ROYAL_BLUE : (isOdd ? LIGHT_BLUE : WHITE);
    const fg = isHeader ? WHITE : DARK_TEXT;
    return row.map(cell => ({
      text: cell,
      options: {
        bold: isHeader, fontSize: 13, color: fg,
        fill: { color: bg },
        align: isHeader ? "center" : "left", fontFace: FONT,
      },
    }));
  });

  s.addTable(tableData, {
    x: 0.5, y: 1.1, w: 12.33, h: 5.9,
    border: { pt: 0.5, color: "D0D8F0" },
    colW: [5.5, 6.83],
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — What We Built
// ══════════════════════════════════════════════════════════════════════════════
function slide4(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "What\u2019s Already Built");
  divider(s, 1.05);

  const items = [
    { label: "Phase 1 \u2014 Multi-tenant SaaS",   detail: "Supabase auth, workspaces, roles, RLS security" },
    { label: "Phase 2 \u2014 Smart Budget Alerts", detail: "Email + WhatsApp notifications at 80 / 90 / 100% spend" },
    { label: "Phase 3 \u2014 AI Receipt Scanning", detail: "Groq Llama 4 Scout OCR, mobile UI, optimistic updates" },
  ];

  let y = 1.25;
  items.forEach(({ label, detail }) => {
    rect(s, 0.5, y, 12.33, 1.5, LIGHT_BLUE, "D0D8F0");
    s.addText("\u2705  " + label, {
      x: 0.7, y: y + 0.1, w: 11.8, h: 0.55,
      fontSize: 18, bold: true, color: ROYAL_BLUE, fontFace: FONT,
    });
    s.addText(detail, {
      x: 1.1, y: y + 0.65, w: 11.3, h: 0.65,
      fontSize: 14, color: DARK_TEXT, fontFace: FONT,
    });
    y += 1.65;
  });

  s.addText("All built on zero-cost infrastructure", {
    x: 0.5, y: 6.8, w: 12.33, h: 0.4,
    fontSize: 12, italic: true, color: MID_GREY, fontFace: FONT, align: "center",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Phase 4 Features Table
// ══════════════════════════════════════════════════════════════════════════════
function slide5(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "Phase 4 \u2014 What We Build Next");
  divider(s, 1.0);

  const rows = [
    ["Feature", "Effort", "Why It Wins"],
    ["\uD83C\uDFA4  Voice Expense Entry",  "1 day",    "Say \u2018Rs 450 biryani\u2019 \u2014 done. No competitor offers this"],
    ["\uD83D\uDCF1  Bank SMS Parsing",     "2 days",   "HBL/MCB/UBL SMS auto-creates expense drafts"],
    ["\uD83D\uDCCA  Monthly AI Summary",   "1 day",    "Plain-language spending report delivered by email"],
    ["\uD83D\uDCE4  CSV / Excel Export",   "2 hours",  "Every user wants data portability"],
    ["\uD83C\uDFA8  Google Stitch UI",     "1 day",    "AI-generated polished UI via Google\u2019s design tool"],
    ["\uD83D\uDD01  AI Provider Failover", "2 hours",  "Groq + Gemini fallback \u2014 never breaks in production"],
    ["Total Phase 4",                      "\u22486 days", "Full production-ready SaaS"],
  ];

  const tableData = rows.map((row, r) => {
    const isHeader = r === 0;
    const isTotal  = r === rows.length - 1;
    const isOdd    = r % 2 === 1;
    const bg = (isHeader || isTotal) ? ROYAL_BLUE : (isOdd ? LIGHT_BLUE : WHITE);
    const fg = (isHeader || isTotal) ? WHITE : DARK_TEXT;
    return row.map((cell, ci) => ({
      text: cell,
      options: {
        bold: isHeader || isTotal, fontSize: 12, color: fg,
        fill: { color: bg },
        align: (isHeader || ci === 1) ? "center" : "left", fontFace: FONT,
      },
    }));
  });

  s.addTable(tableData, {
    x: 0.5, y: 1.1, w: 12.33, h: 6.1,
    border: { pt: 0.5, color: "D0D8F0" },
    colW: [4.5, 1.8, 6.03],
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Google Stitch
// ══════════════════════════════════════════════════════════════════════════════
function slide6(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "Google Stitch \u2014 AI UI Design");
  divider(s, 1.05);

  s.addText(
    "Google\u2019s new AI design tool (launched I/O 2025) generates complete UI screens from a text prompt in under 60 seconds",
    { x: 0.5, y: 1.2, w: 12.33, h: 0.85, fontSize: 17, italic: true, color: ROYAL_BLUE, fontFace: FONT, wrap: true }
  );

  const bullets = [
    "Exports clean HTML/CSS and Figma files \u2014 no manual design work",
    "Connects to Kiro AI via Model Context Protocol (MCP) \u2014 designs flow straight into code",
    "Prompt used: \u2018Pakistani expense tracker, royal blue #4169E1, mobile-first, glassmorphism\u2019",
  ];
  let y = 2.25;
  bullets.forEach(b => {
    s.addText("\u2192  " + b, {
      x: 0.6, y, w: 12.1, h: 1.0,
      fontSize: 18, color: DARK_TEXT, fontFace: FONT, wrap: true,
    });
    y += 1.1;
  });

  rect(s, 0.5, 6.55, 12.33, 0.62, LIGHT_BLUE, "D0D8F0");
  s.addText("stitch.withgoogle.com  \u2014  Free", {
    x: 0.5, y: 6.6, w: 12.33, h: 0.5,
    fontSize: 14, bold: true, color: ROYAL_BLUE, fontFace: FONT, align: "center",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Tech Stack
// ══════════════════════════════════════════════════════════════════════════════
function slide7(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "Technology Stack \u2014 All Free Tier");
  divider(s, 1.05);

  const left  = ["Supabase (Database + Auth)", "React 18 + Vite + Tailwind CSS", "Node.js + Express", "Groq AI (OCR + Text)", "Resend (Email alerts)"];
  const right = ["Groq Whisper (Voice)", "Google Gemini (AI fallback)", "Google Stitch (UI design)", "Vercel + Render (Deployment)", "cron-job.org (Scheduled jobs)"];

  rect(s, 0.5, 1.2, 5.8, 5.85, LIGHT_BLUE, "D0D8F0");
  s.addText("Already in use", { x: 0.65, y: 1.28, w: 5.5, h: 0.5, fontSize: 15, bold: true, color: ROYAL_BLUE, fontFace: FONT });
  rect(s, 0.65, 1.82, 5.5, 0.04, ROYAL_BLUE);
  let y = 1.98;
  left.forEach(item => { s.addText("\u2714  " + item, { x: 0.8, y, w: 5.3, h: 0.7, fontSize: 15, color: DARK_TEXT, fontFace: FONT }); y += 0.82; });

  rect(s, 7.0, 1.2, 5.83, 5.85, LIGHT_BLUE, "D0D8F0");
  s.addText("Adding in Phase 4", { x: 7.15, y: 1.28, w: 5.5, h: 0.5, fontSize: 15, bold: true, color: ROYAL_BLUE, fontFace: FONT });
  rect(s, 7.15, 1.82, 5.5, 0.04, ROYAL_BLUE);
  y = 1.98;
  right.forEach(item => { s.addText("\u2726  " + item, { x: 7.3, y, w: 5.5, h: 0.7, fontSize: 15, color: DARK_TEXT, fontFace: FONT }); y += 0.82; });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Pricing
// ══════════════════════════════════════════════════════════════════════════════
function slide8(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "Business Model");
  divider(s, 1.05);

  const cards = [
    { tier: "Free",  price: "Rs 0 / month",     bg: WHITE,      fg: ROYAL_BLUE, detail: "1 workspace, manual entry, basic alerts" },
    { tier: "Pro",   price: "Rs 499 / month",   bg: ROYAL_BLUE, fg: WHITE,      detail: "AI OCR, voice entry, CSV export, monthly summary" },
    { tier: "Team",  price: "Rs 1,499 / month", bg: LIGHT_BLUE, fg: ROYAL_BLUE, detail: "Multi-user, SMS parsing, WhatsApp alerts" },
  ];

  let x = 0.5;
  cards.forEach(({ tier, price, bg, fg, detail }) => {
    rect(s, x, 1.28, 3.9, 5.2, bg, ROYAL_BLUE);
    s.addText(tier,  { x, y: 1.5,  w: 3.9, h: 0.65, fontSize: 26, bold: true, color: fg, fontFace: FONT, align: "center" });
    rect(s, x + 0.3, 2.22, 3.3, 0.04, fg);
    s.addText(price, { x, y: 2.35, w: 3.9, h: 0.75, fontSize: 22, bold: true, color: fg, fontFace: FONT, align: "center" });
    s.addText(detail, { x: x + 0.2, y: 3.25, w: 3.5, h: 2.9, fontSize: 14, color: fg, fontFace: FONT, align: "center", wrap: true, valign: "top" });
    x += 4.17;
  });

  s.addText("Pakistan-first pricing.  Approx $1.80 / $5.40 USD", {
    x: 0.5, y: 6.75, w: 12.33, h: 0.4,
    fontSize: 12, italic: true, color: MID_GREY, fontFace: FONT, align: "center",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Timeline
// ══════════════════════════════════════════════════════════════════════════════
function slide9(prs) {
  const s = prs.addSlide();
  blueTopBar(s); blueBottomBar(s);
  blueTitle(s, "6-Day Implementation Plan");
  divider(s, 1.05);

  const timeline = [
    { day: "Day 1",         task: "CSV Export + OCR Provider Abstraction" },
    { day: "Day 2\u20133",  task: "Bank SMS Parsing" },
    { day: "Day 4",         task: "Voice Expense Entry" },
    { day: "Day 5",         task: "Monthly AI Summary Email" },
    { day: "Day 6",         task: "Google Stitch UI Refresh + Deploy to Vercel + Render" },
  ];

  let y = 1.28;
  timeline.forEach(({ day, task }) => {
    rect(s, 0.5, y, 1.6, 0.9, ROYAL_BLUE);
    s.addText(day, { x: 0.5, y: y + 0.1, w: 1.6, h: 0.7, fontSize: 15, bold: true, color: WHITE, fontFace: FONT, align: "center" });
    rect(s, 2.25, y, 10.6, 0.9, LIGHT_BLUE, "D0D8F0");
    s.addText(task, { x: 2.45, y: y + 0.1, w: 10.2, h: 0.7, fontSize: 16, color: DARK_TEXT, fontFace: FONT, valign: "middle" });
    rect(s, 2.1, y + 0.38, 0.15, 0.15, ROYAL_BLUE);
    y += 1.05;
  });

  s.addText("Built entirely with Kiro AI on zero-cost infrastructure", {
    x: 0.5, y: 6.75, w: 12.33, h: 0.45,
    fontSize: 13, italic: true, color: MID_GREY, fontFace: FONT, align: "center",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Closing
// ══════════════════════════════════════════════════════════════════════════════
function slide10(prs) {
  const s = prs.addSlide();
  s.background = { color: ROYAL_BLUE };
  rect(s, 0, 0, "100%", 0.12, WHITE);
  rect(s, 0, 7.38, "100%", 0.12, WHITE);

  s.addText("Kharcha Tracker", {
    x: 1, y: 1.7, w: 11.33, h: 1.3,
    fontSize: 52, bold: true, color: WHITE, fontFace: FONT, align: "center",
  });
  s.addText("Pakistan\u2019s smartest expense tracker", {
    x: 1, y: 3.1, w: 11.33, h: 0.75,
    fontSize: 22, color: WHITE, fontFace: FONT, align: "center",
  });
  rect(s, 4.5, 4.0, 4.33, 0.04, WHITE);
  s.addText("Built by Umair Abbas  \u00B7  AI Engineering Intern  \u00B7  July 2026", {
    x: 1, y: 4.2, w: 11.33, h: 0.65,
    fontSize: 16, color: WHITE, fontFace: FONT, align: "center",
  });
  s.addText("github.com/UmairAbbas1/kharcha-tracker", {
    x: 1, y: 4.95, w: 11.33, h: 0.5,
    fontSize: 13, italic: true, color: WHITE, fontFace: FONT, align: "center",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const prs = newPrs();
  console.log("Building slides \u2026");
  slide1(prs);  console.log("  \u2713 Slide  1 \u2014 Title");
  slide2(prs);  console.log("  \u2713 Slide  2 \u2014 The Problem");
  slide3(prs);  console.log("  \u2713 Slide  3 \u2014 USP table");
  slide4(prs);  console.log("  \u2713 Slide  4 \u2014 What We Built");
  slide5(prs);  console.log("  \u2713 Slide  5 \u2014 Phase 4 Features");
  slide6(prs);  console.log("  \u2713 Slide  6 \u2014 Google Stitch");
  slide7(prs);  console.log("  \u2713 Slide  7 \u2014 Tech Stack");
  slide8(prs);  console.log("  \u2713 Slide  8 \u2014 Pricing");
  slide9(prs);  console.log("  \u2713 Slide  9 \u2014 Timeline");
  slide10(prs); console.log("  \u2713 Slide 10 \u2014 Closing");

  const outPath = path.join(__dirname, "kharcha-tracker-phase4.pptx");
  await prs.writeFile({ fileName: outPath });
  console.log("\n\u2705  Saved \u2192 " + outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
