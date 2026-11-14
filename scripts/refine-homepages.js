/**
 * Refine homepage design compositions:
 * - Sets the correct HERO_SLIDER widget variantId for each of the 18 homepage designs.
 * - The variantId maps directly to a SliderDesign (1-14) in SliderDesigns.tsx.
 *
 * Four visual types are distributed evenly across the 18 designs:
 *   Type A – Frosted transparent box + zoom-in/out:  designs 1, 2, 3, 10
 *   Type B – Opaque bottom band fused to page:       designs 4, 5, 11, 14
 *   Type C – Hero bg + content left + framed image:  designs 6, 7
 *   Type D – Diagonal split (deep gradient / image): designs 8, 9, 13
 *   Special – Carousel cards:                        design  12
 *
 * Run:  node scripts/refine-homepages.js
 * Safe to re-run — uses updateMany so it is idempotent.
 */

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// designKey (1-18) → SliderDesign number (1-14)
const HERO_VARIANT = {
  1:  1,  // Nairobi Hospital Classic  → Type A: fade + zoom + frosted box
  2:  4,  // Avenue Modern Care        → Type B: LTR slide + opaque bottom band
  3:  6,  // Karen Centres             → Type C: hero bg + framed image right
  4:  8,  // KNH Institutional         → Type D: diagonal + typewriter left
  5:  2,  // Editorial Split           → Type A: LTR + zoom + frosted box
  6:  5,  // Bold Health Banner        → Type B: split-text + opaque bottom band
  7:  7,  // Magazine Health           → Type C: parallax + framed image right
  8:  9,  // Clinical Clarity          → Type D: diagonal + flip image right
  9:  3,  // Warm Community            → Type A: ken-burns zoom-in/out + frosted box
  10: 11, // Mega Department           → Type B: gradient opaque bottom band
  11: 13, // App-first                 → Type D: diagonal teal split
  12:  6, // Video Story               → Type C: hero bg + framed image right
  13: 10, // Insurance & Trust         → Type A: blur + zoom + frosted box
  14: 14, // Maternal Focus            → Type B: full-bleed + zoom + opaque bottom band
  15:  7, // Diagnostics Lab           → Type C: parallax + framed image right
  16: 12, // Pharmacy Retail           → carousel cards (premium)
  17:  8, // Leadership Trust          → Type D: diagonal + typewriter left
  18:  4, // Booking-first             → Type B: LTR slide + opaque bottom band
};

async function main() {
  const designs = await db.homepageDesign.findMany({ orderBy: { designKey: 'asc' } });

  if (!designs.length) {
    console.error('No homepage designs found in the database. Run the seed first.');
    process.exit(1);
  }

  let updated = 0;
  let notFound = 0;

  for (const d of designs) {
    const variant = HERO_VARIANT[d.designKey];
    if (!variant) {
      console.warn(`  ⚠  designKey ${d.designKey} (${d.name}) — no mapping defined, skipping`);
      notFound++;
      continue;
    }

    const result = await db.homepageWidget.updateMany({
      where: { designId: d.id, moduleKey: 'HERO_SLIDER' },
      data: { variantId: variant },
    });

    if (result.count > 0) {
      const typeLetter = variant <= 3 || variant === 10 ? 'A'
        : variant === 4 || variant === 5 || variant === 11 || variant === 14 ? 'B'
        : variant === 6 || variant === 7 ? 'C'
        : variant === 8 || variant === 9 || variant === 13 ? 'D'
        : '(carousel)';
      console.log(`  ✓  design ${String(d.designKey).padStart(2)} "${d.name}" → SliderDesign ${String(variant).padStart(2)} [Type ${typeLetter}]`);
      updated++;
    } else {
      console.warn(`  ⚠  design ${d.designKey} "${d.name}" — no HERO_SLIDER widget found (add one via the homepage manager)`);
      notFound++;
    }
  }

  console.log(`\nDone — ${updated} HERO_SLIDER widget(s) updated, ${notFound} skipped/not found.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
