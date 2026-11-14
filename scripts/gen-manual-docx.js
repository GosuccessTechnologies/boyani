/**
 * DEVELOPER MANUAL → DOCX (whitepaper — R2 Double-Rule Frame cover, CM-2 palette)
 * Per docx skill: calcTitleLayout, allNoBorders, 1.3x spacing, TOC + refresh hint.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, BorderStyle, WidthType, ShadingType,
  TableLayoutType, TableOfContents, NumberFormat, SectionType,
} = require("docx");
const fs = require("fs");

// ── CM-2 palette (Blue Orange — tech/corporate/whitepaper) ──
const P = {
  bg: "FEFEFE", primary: "1284BA", accent: "FF862F",
  cover: { titleColor: "1284BA", subtitleColor: "606060", metaColor: "707070", footerColor: "A0A0A0" },
  table: { headerBg: "1284BA", headerText: "FFFFFF", accentLine: "1284BA", innerLine: "D8E4EC", surface: "EDF4F9" },
};
const BODY = "000000";

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── calcTitleLayout + splitTitleLines (from design-system.md) ──
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...'，。、；：！？', ...'的与和及之在于为', ...'-_—–·/', ...' \t', ...'-— ']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

// ── R2 cover recipe (from design-system.md) ──
function buildCoverR2(config) {
  const padL = 1400, padR = 1400;
  const { titlePt, titleLines } = calcTitleLayout(config.title, 11906 - padL - padR, 40, 24);
  const titleSize = titlePt * 2;
  const thickBorder = { style: BorderStyle.SINGLE, size: 18, color: P.accent, space: 20 };
  const children = [];
  children.push(new Paragraph({ indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 1200, after: 200 }, border: { top: thickBorder }, children: [] }));
  children.push(new Paragraph({ spacing: { before: 1800 } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 500 },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: i < titleLines.length - 1 ? 80 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 1200 } }));
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 100, line: Math.ceil(18 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: line, size: 36, color: P.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 2000 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 200 },
    border: { bottom: thickBorder },
    children: [new TextRun({ text: config.footerRight || "", size: 18, color: P.cover.footerColor, font: { ascii: "Arial" } })],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

// ── Content helpers ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 110, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 90, line: 312 },
    children: [new TextRun({ text, bold: true, size: 26, color: "182030", font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 22, color: BODY, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, ...opts })],
  });
}
function pBold(text) { return p(text, { bold: true }); }
function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 22, color: BODY, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function code(lines) {
  return lines.map(line => new Paragraph({
    spacing: { line: 276, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F4F6F8" },
    indent: { left: 240 },
    children: [new TextRun({ text: line.length ? line : " ", size: 18, color: "24292F", font: { ascii: "Consolas", eastAsia: "Sarasa Mono SC" } })],
  }));
}
function makeTable(headers, rows) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: P.table.innerLine };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { top: { style: BorderStyle.SINGLE, size: 8, color: P.table.accentLine }, bottom: { style: BorderStyle.SINGLE, size: 8, color: P.table.accentLine }, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map(hdr => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: hdr, bold: true, size: 20, color: P.table.headerText, font: { ascii: "Calibri" } })] })],
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        cantSplit: true,
        children: row.map(cell => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? "FFFFFF" : P.table.surface },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: String(cell), size: 20, color: BODY, font: { ascii: "Calibri" } })] })],
        })),
      })),
    ],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 20, color: "506070", font: { ascii: "Calibri" } })],
  });
}

// ═══════════════ BODY CONTENT ═══════════════
const body = [];

body.push(h1("1. Project Overview"));
body.push(p("MedCare is a multi-portal Hospital, Clinic and Pharmacy Management System for Kenyan healthcare facilities with two faces: a public website (18 switchable homepage designs, online booking, services, news, careers, downloads, gallery — all managed through the Website Manager portal) and a management system with 11 launcher portals: Facility Management, Pharmacy, Doctor, Registrar, Cashier, Nursing, Laboratory, Attendance (PWA), Inventory, HR and Website Manager."));
body.push(p("The system is built on Next.js 16 with the App Router, TypeScript 5, Tailwind CSS 4 with shadcn/ui, Prisma ORM over SQLite, Zustand for client state, TanStack patterns for tables, Tiptap for rich text, Framer Motion for animation and Recharts for charts. Authentication uses Bearer-token sessions stored in the Session table — the same proven pattern imported from hills.zip."));

body.push(h2("1.1 Reference imports"));
body.push(tableTitle("Table 1 — Import provenance"));
body.push(makeTable(
  ["Source", "What was imported", "Adaptation"],
  [
    ["hills.zip", "api/printer-settings, api/pos, api/company, api/quotations, api/profit-loss, lib/auth.ts (Bearer sessions), CompanyConfig key-value pattern, Sale/SaleItem rigour", "POS became the patient cashier plus pharmacy POS; Quotations now quote medical services; Profit-loss aggregates departmental revenue; Company holds facility configuration"],
    ["clinic.zip", "api/pharmacy (Drug CRUD + KPIs), api/pharmacy-pos (drugs listing, sales, today-sales)", "Pharmacy sales moved from a JSON-in-config hack to proper PharmacySale/PharmacySaleItem tables; added prescription dispensing, SHA billing, per-pharmacist day view vs admin full view"],
    ["politicsmigori-deployable.zip", "Launcher module cards, Theme model, Slider/Menu/MenuItem/HomepageWidget models, Header/Footer/Slider design-router pattern, widget composition architecture", "Re-pointed from the politician domain to the hospital domain (services, departments, doctors, appointments)"],
    ["Inspirational zips + 4 Kenyan hospital sites", "18 homepage design directions, dashboard layouts", "Implemented as widget compositions driven by our own Prisma schemas"],
  ]
));

body.push(h1("2. Authentication and Roles"));
body.push(p("Authentication uses custom Bearer-token sessions (imported from hills.zip) rather than NextAuth. POST /api/auth/login validates credentials, creates a Session row with a 7-day token and returns the token plus user. The client stores the token in localStorage through the Zustand auth-store and sends Authorization: Bearer on every API call. requireAuth(request, roles) from lib/auth guards every protected route. POST /api/auth/logout deletes the session; GET /api/auth/me returns the current user."));
body.push(p("A hydration-safe guard hook (useAuthGuard) waits one tick before redirecting unauthenticated users, because Zustand persist rehydrates localStorage after React's first commit — an immediate null-token check would wrongly bounce logged-in users to the login page."));
body.push(tableTitle("Table 2 — Roles"));
body.push(makeTable(
  ["Role", "Primary portal", "Key capabilities"],
  [
    ["ADMIN", "Facility Management", "Everything: services and drug pricing, users, departments, wards, themes, printer settings, quotations, profit-loss, shifts, website manager"],
    ["DOCTOR", "Doctor Portal", "Consultations, diagnoses, prescriptions, lab requests, appointments, patient history"],
    ["NURSE", "Nursing Portal", "Vitals, admissions, ward and bed management, discharge initiation"],
    ["PHARMACIST", "Pharmacy POS", "Dispensing, walk-in counter sales, own daily takings only (weekly/monthly views are admin-only)"],
    ["LAB_TECH", "Laboratory Portal", "Order queue, sample tracking, result entry, verification"],
    ["CASHIER", "Cashier POS", "Consolidated visit billing across all departments, cash/MPESA/card/SHA receipting"],
    ["RECEPTIONIST", "Registrar Portal", "Patient registration with Kenyan demographics, visit management, patient search"],
    ["HR", "HR Portal", "Employees, payroll, job postings, application review, attendance oversight"],
    ["INVENTORY", "Inventory Portal", "Items, movements, assignments; staff see only what is assigned to them"],
    ["STAFF", "Attendance PWA", "GPS-checked check-in and check-out"],
  ]
));

body.push(h1("3. The 11 Launcher Portals"));
body.push(p("After login, users land on /launcher — module cards (the pattern borrowed from the politicsmigori platform) filtered by role. Each portal has a mandated layout enforced by the PortalShell component."));
body.push(tableTitle("Table 3 — Portals and layouts"));
body.push(makeTable(
  ["Portal", "Route", "Layout"],
  [
    ["Facility Management", "/admin", "Sidebar + header + footer"],
    ["Pharmacy", "/pharmacy", "Full-screen POS"],
    ["Doctor", "/doctor", "Header + footer with pill sub-navigation"],
    ["Registrar", "/registrar", "Header + footer"],
    ["Cashier", "/cashier", "Full-screen POS"],
    ["Nursing", "/nursing", "Header + footer"],
    ["Laboratory", "/lab", "Header + footer"],
    ["Attendance", "/attendance", "PWA — mobile-first, installable (manifest + service worker)"],
    ["Inventory", "/inventory", "Sidebar + header + footer"],
    ["HR", "/hr", "Sidebar + header + footer"],
    ["Website Manager", "/website-manager", "Sidebar + header + footer"],
  ]
));

body.push(h1("4. Data Model"));
body.push(p("The Prisma schema (prisma/schema.prisma) is the single source of truth with more than 45 models. Highlights: User, Session, AuditLog; CompanyConfig, Branch, Department, Service (admin-priced with shaCovered flag); Patient with full Kenyan demographics (county, sub-county, location, sub-location, village, national ID, next-of-kin, paymentMode CASH/SHA/INSURANCE) and Visit; Appointment, Consultation, Prescription and items, LabTest/LabOrder and items, VitalRecord, Ward/Bed/Admission; ANCRegistration, DeliveryRecord, VaccinationRecord for MCH; Drug, DrugStockMovement, PharmacySale and items; Bill and BillItem consolidating charges from every department, Payment; Quotation and items; Employee, StaffAssignment (shifts), JobPosting, JobApplication, PayrollRecord with Kenyan deductions (PAYE, NSSF, SHIF, housing levy); AttendanceConfig and AttendanceRecord (GPS-validated); InventoryItem and movements; FileRecord; and the website set — Slider, Menu/MenuItem, HomepageDesign/HomepageWidget, WebPage, NewsPost, Download, ContactMessage, GalleryAlbum/Photo, Testimonial, Faq, DoctorProfile — plus Theme and SiteSetting."));
body.push(h2("4.1 The clinical workflow chain"));
body.push(...code([
  "Registrar registers patient (+ optional quick tests billed to the visit)",
  "  → Lab conducts tests (records results; charges to the visit)",
  "  → Doctor consults (diagnosis; prescription; consultation fee to the visit)",
  "  → Pharmacy dispenses (walk-in pays at counter; registered patient is billed to the visit)",
  "  → Nurse admits (ward/bed; daily rates to the visit)",
  "  → Cashier imports ALL visit charges → receipt (A4/A5 portrait) — cash or SHA",
]));

body.push(h1("5. API Routes"));
body.push(p("All routes follow one pattern: import db from lib/db, guard with requireAuth(request, roles), paginate with getPagination, filter with Prisma contains (SQLite forbids mode:'insensitive'), write AuditLog entries after mutations and return JSON with proper status codes. Public website endpoints accept ?public=1 to skip authentication and return only published records."));
body.push(tableTitle("Table 4 — Imported and adapted APIs"));
body.push(makeTable(
  ["Route", "Source", "Purpose"],
  [
    ["/api/company", "hills.zip", "Facility configuration GET (public) and PUT (admin) with snake-case to camel-case maps and bulk upsert"],
    ["/api/printer-settings", "hills.zip", "Printer configuration plus test print with facility identity from CompanyConfig"],
    ["/api/pos", "hills.zip", "Cashier POS — pending bills consolidate charges from every department; checkout creates Bill and Payment with CASH/MPESA/CARD/SHA/MIXED modes"],
    ["/api/quotations (+/[id])", "hills.zip", "Medical service quotations with SERVICE/DRUG/PACKAGE items and CONVERTED_TO_BILL guard"],
    ["/api/profit-loss", "hills.zip", "BillItem (clinical) plus PharmacySaleItem (pharmacy) sources, department and category breakdowns, monthly trend, payment mix including SHA"],
    ["/api/pharmacy", "clinic.zip", "Drug catalog CRUD (admin-only writes) with KPIs and CSV bulk import"],
    ["/api/pharmacy-pos", "clinic.zip", "Dispensing, walk-in and bill-to-visit sales, prescription queue; pharmacist sees own day, admin sees everything"],
  ]
));
body.push(p("Domain routes added: auth (login, logout, me, module-access), patients, visits, appointments (public POST feeding doctor dashboards), consultations, prescriptions, lab-tests, lab-orders, vitals, wards, beds, admissions, anc, deliveries, vaccinations, bills, payments, services, departments, branches, users, employees, shifts, jobs, applications, payroll, payroll-config, attendance, attendance-config, inventory, inventory-movements, dashboard (per-portal aggregates), themes, site-settings, sliders, menus, homepage-designs, web-pages, news, downloads, contact (public POST), gallery, testimonials, faqs, doctors, upload, files and export helpers."));

body.push(h1("6. UI System Standards"));
body.push(h2("6.1 Theme system — 10 themes"));
body.push(p("ThemeProvider reads the active Theme row plus SiteSetting.activeThemeId and injects --mc-* CSS variables on the html element. Tailwind 4 consumes them through the globals.css theme block, and shadcn's own variables are mapped onto the theme tokens, so every component — dashboards and public website alike — follows the active theme automatically. The ten seeded presets are Medical Teal, Ocean Blue, Nairobi Green, Sunset Orange, Royal Purple, Rose Care, Dark Clinical, Warm Neutral, High Contrast and Pediatric Playful. Admins apply a theme from the Theme Manager with one click; the change cascades system-wide instantly."));
body.push(h2("6.2 DataTable — the canonical table"));
body.push(p("Built on TanStack Table patterns, the DataTable shows four data columns plus the action column by default; a column-toggle expander reveals the remaining columns for the session only. Rows are zebra-striped with visible alternating colours, column headers alternate backgrounds, and every row carries a number and a leading checkbox for selection. Advanced filters include a global search and a per-column filter row; headers are sortable; pagination is built in. Row actions use uniquely coloured, uniformly designed buttons (view cyan, edit amber, delete red, print purple, download green). Selected or filtered data can be exported to CSV or PDF one at a time or printed — the print view renders only the content with a facility hero header and module details, never the application chrome. Column statistics appear on dashboard pages only."));
body.push(h2("6.3 Forms"));
body.push(p("Forms are multi-column and grid-based with numbered sections for multi-part flows. Every field label carries a branded icon; inputs use the sinking inset style (1.5px themed border, inset shadow, themed focus ring) applied through the mc-input class. Selects share the same premium branding. Submit areas provide primary and secondary buttons in uniform styling. Every form modal offers a CSV template download and an upload path for bulk entry."));
body.push(h2("6.4 Modals"));
body.push(p("PremiumModal renders a hero header with the module icon, the title and a red close button that blinks infinitely as a reminder, followed by the body and a hero footer containing a short description on the left and the action buttons on the right."));
body.push(h2("6.5 Uploads and the file manager"));
body.push(p("FileUploader combines drag-and-drop, click-to-browse and URL import from the internet. Images are compressed client-side through a canvas (maximum 1200px, JPEG quality 0.82) before upload. Every upload is registered in FileRecord and browsable in the File Manager portal grouped by module and date."));
body.push(h2("6.6 Rich text"));
body.push(p("The Tiptap-based RichTextEditor provides headings, bold, italic, underline, strike, font family and size, colour and highlight, bullet and numbered lists, text alignment, links, images, tables, YouTube embeds, blockquotes, horizontal rules, undo/redo and clear formatting. Pasting from Word preserves formatting. It backs WebPage content, NewsPost bodies, job descriptions and more."));
body.push(h2("6.7 Printing and receipts"));
body.push(p("The receipt builder honours printer-settings (paper size A4 or A5 portrait, copies, footer message, logo and QR toggles). Printed or exported documents include the facility hero header and render content only."));

body.push(h1("7. Public Website System"));
body.push(h2("7.1 Homepage architecture"));
body.push(p("SiteSetting.activeHomepageDesign (1 to 18) selects the design rendered by the public homepage. Each design is a fixed composition of widgets imitating one inspirational direction — the 17 PNG inspirations plus the four Kenyan hospital references (thenairobihosp.org, avenuehealthcare.com, karenhospital.org, knh.or.ke) — while sourcing all content from our own schemas. Forty widget modules are available (hero slider, emergency strip, quick actions, services grids, department browser, stats counters, about split, why-choose-us, doctor carousel and grid, MCH and maternity showcases, laboratory and pharmacy showcases, admission info, testimonials, news grid and list and magazine, appointment CTA and inline form, contact banner, downloads, gallery masonry and carousel, FAQ accordion, partners and insurance strips, video story, timeline, values, vision and mission, leadership, pricing tables, health tips, gradient CTA, app download, map contact, newsletter, opening hours and trust badges). Widgets read live schema data — nothing is hardcoded, so the platform works for any facility."));
body.push(p("The slider module offers twelve animation designs (fade, slide, zoom ken-burns, vertical, split-text, clip-reveal, parallax, typewriter, flip, blur, cube and carousel-cards); administrators choose one or several animations per slide set with configurable titles, descriptions and buttons."));
body.push(h2("7.2 Headers, footers and menus"));
body.push(p("Ten header designs (classic three-tier topbar, split layout, centred logo, transparent-over-hero, slim gradient accent, mega-menu band, compact utility, two-tone stacked, drawer and floating pill) and ten footer designs (classic dark four-column, light minimal, gradient with emergency banner, mega footer, newsletter focus, dense sitemap, contact-heavy, social ribbon, centred minimal and split curve) are switchable from Site Settings. Twenty menu designs — most mega-menu capable with descriptions, icons, multi-column layouts and theme colours — are managed through the menu builder. Six breadcrumb and hero-header templates are configurable per page, and the page layout switches between boxed and full-width site-wide."));
body.push(h2("7.3 Public modules"));
body.push(p("Each public module is independently publishable or deactivatable: clinical services with sub-pages, pharmaceutical services, treatment, laboratory, admission, maternity and neonatal care, diagnostic imaging, why choose us, about us, values, vision and mission, contact (info from CompanyConfig with a form feeding the dashboard inbox), gallery, appointments (delivering bookings to doctor dashboards), news, careers, downloads, FAQ and the doctors directory. A Google sitemap at /sitemap.xml and per-page SEO metadata wire everything into search consoles."));

body.push(h1("8. Seeding and Data Conventions"));
body.push(p("prisma/seed.ts seeds every model with realistic Kenyan hospital data: the MedCare Hospital facility with KES pricing across 38 services, 48 common drugs with KEMSA suppliers, ten wards with beds, 15 patients with Kenyan demographics, visits, appointments, lab orders with results, prescriptions, bills and payments, payroll with PAYE/NSSF/SHIF/housing-levy deductions, attendance history, inventory, the ten themes, 18 homepage designs with widgets, sliders, menus, web pages, news, downloads, gallery, testimonials, FAQs and doctor profiles. Run with: bunx tsx prisma/seed.ts (or bun run db:seed)."));
body.push(tableTitle("Table 5 — Demo accounts"));
body.push(makeTable(
  ["Username", "Password", "Role"],
  [
    ["admin", "Admin123!", "Facility admin"],
    ["doctor", "Doctor123!", "Doctor"],
    ["nurse", "Nurse123!", "Nurse"],
    ["pharmacist", "Pharma123!", "Pharmacist"],
    ["labtech", "Lab123!", "Laboratory technologist"],
    ["cashier", "Cashier123!", "Cashier"],
    ["registrar", "Reception123!", "Registrar"],
    ["hr", "Hr123!", "Human resources"],
    ["inventory", "Stores123!", "Inventory"],
  ]
));

body.push(h1("9. Development Workflow"));
body.push(p("Edit the schema then run bun run db:push. New API routes follow the guarded pattern below; client fetches always send the Bearer token through the apiFetch helper from lib/client-api, which also provides CSV template download, CSV parsing, export helpers and authenticated uploads."));
body.push(...code([
  "import { db } from '@/lib/db';",
  "import { NextRequest, NextResponse } from 'next/server';",
  "import { requireAuth } from '@/lib/auth';",
  "",
  "export async function GET(request: NextRequest) {",
  "  const auth = await requireAuth(request, ['ADMIN']);",
  "  if (auth instanceof NextResponse) return auth;",
  "  // ... db queries, NextResponse.json",
  "}",
]));
body.push(p("Lint with bun run lint; watch the dev log at dev.log. Commit to git after every module so progress survives. The quality checklist for each module: server-side role guard (never UI-only), DataTable conventions, form standards with CSV import, PremiumModal hero header with the blinking red close button, audit log on mutation, theme-awareness across all ten themes, mobile-first responsiveness, seeded sample data, and no hardcoded facility data."));

body.push(h1("10. Commands"));
body.push(tableTitle("Table 6 — Common commands"));
body.push(makeTable(
  ["Command", "Purpose"],
  [
    ["bun run dev", "Start the dev server on port 3000"],
    ["bun run lint", "ESLint across the project"],
    ["bun run db:push", "Push the Prisma schema to SQLite"],
    ["bun run db:generate", "Regenerate the Prisma client"],
    ["bun run db:seed", "Seed the full Kenyan hospital dataset"],
    ["bunx tsc --noEmit", "Type-check without emitting"],
  ]
));

// ═══════════════ DOCUMENT ═══════════════
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: BODY },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  features: { updateFields: true },
  sections: [
    // Cover section (margin 0)
    {
      properties: { page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR2({
        title: "MedCare Hospital, Clinic & Pharmacy Management System",
        subtitle: "Developer Manual — Complete Development Guide",
        englishLabel: "DEVELOPER MANUAL",
        metaLines: ["Version 1.0.0", "Next.js 16 · TypeScript · Prisma · Tailwind 4 · shadcn/ui", "September 2026"],
        footerRight: "MedCare Hospital Management System",
      }),
    },
    // TOC section (Roman numbering)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }),
      },
      children: [
        new Paragraph({ spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: P.primary })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({
          spacing: { before: 160 },
          children: [new TextRun({ text: "Right-click the table above and choose Update Field to refresh page numbers.", italics: true, size: 18, color: "8A8A8A" })],
        }),
        new Paragraph({ children: [new TextRun({ text: "", size: 2 }), new PageBreakRun()] }),
      ],
    },
    // Body section (Arabic numbering)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "MedCare Developer Manual", size: 16, color: "8A8A8A" })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }),
      },
      children: body,
    },
  ],
});

// PageBreak inside a paragraph with a run
function PageBreakRun() {
  const { PageBreak } = require("docx");
  return new PageBreak();
}

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/MedCare-Developer-Manual.docx", buf);
  console.log("DOCX written:", buf.length, "bytes");
});
