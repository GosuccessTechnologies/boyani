#!/bin/bash
# Analyze all inspirational design images and save layout descriptions
cd /home/z/my-project/reference

OUT=/home/z/my-project/reference/design-analyses
mkdir -p "$OUT"

analyze() {
  local file="$1"
  local name="$2"
  local out="$OUT/$name.md"
  if [ -s "$out" ]; then echo "SKIP $name"; return; fi
  z-ai vision -p "You are a senior UI designer. Analyze this screenshot and output a concise structured design spec (max 250 words): 1) Page type & overall layout pattern 2) Header/nav structure 3) Hero section design 4) Section-by-section order with layout of each (columns/grids/cards) 5) Color palette (hex approx) 6) Typography character (serif/sans, weights) 7) Distinctive design touches (shapes, curves, animations hints). Be specific and factual." -i "$file" -o "$OUT/$name.json" 2>/dev/null >/dev/null
  if [ -f "$OUT/$name.json" ]; then
    node -e "const d=require('$OUT/$name.json'); const c=d.choices?.[0]?.message?.content||'FAILED'; require('fs').writeFileSync('$out', c); require('fs').unlinkSync('$OUT/$name.json');" 2>/dev/null || echo "PARSE-FAIL $name"
  fi
  echo "DONE $name"
}
export -f analyze
export OUT

# Homepage inspirations (17)
for i in 1 2 3 5 6 7 8 9 10 11 12 13 14 15 16 17 18; do
  f="homepage-inspo/Homepage-inspirationals/Homepage$i.png"
  [ -f "$f" ] && echo "$f homepage$i"
done | xargs -P 4 -n 2 bash -c 'analyze "$0" "$1"'

# Website section inspirations (16)
for f in websites-inspo/Websites-section-inspirationals/*; do
  base=$(basename "$f" | tr ' ' '_' | sed 's/inspirationals_//;s/\.[^.]*$//')
  echo "$f section_$base"
done | xargs -P 4 -n 2 bash -c 'analyze "$0" "$1"'

# Dashboard inspirations (5)
for f in dashboard-inspo/Dashboard-inspirationals/*; do
  base=$(basename "$f" | tr ' ()' '_' | sed 's/\.[^.]*$//')
  echo "$f dash_$base"
done | xargs -P 4 -n 2 bash -c 'analyze "$0" "$1"'

echo "ALL ANALYSES COMPLETE"
ls "$OUT" | wc -l
