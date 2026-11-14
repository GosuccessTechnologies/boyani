/**
 * GOOGLE FONT CATALOG — selectable in Theme Manager for heading/body fonts.
 * Loaded dynamically by ThemeProvider (link injection) — no next/font needed.
 * Each entry: family name exactly as Google Fonts expects + weights.
 */
export const GOOGLE_FONTS: Array<{ family: string; weights: string; category: string }> = [
  { family: 'Inter', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Poppins', weights: '300;400;500;600;700;800', category: 'sans-serif' },
  { family: 'Roboto', weights: '300;400;500;700;900', category: 'sans-serif' },
  { family: 'Open Sans', weights: '300;400;500;600;700;800', category: 'sans-serif' },
  { family: 'Lato', weights: '300;400;700;900', category: 'sans-serif' },
  { family: 'Montserrat', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Source Sans 3', weights: '300;400;500;600;700;900', category: 'sans-serif' },
  { family: 'Nunito', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Work Sans', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Rubik', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'DM Sans', weights: '400;500;700;900', category: 'sans-serif' },
  { family: 'Manrope', weights: '300;400;500;600;700;800', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', weights: '300;400;500;600;700;800', category: 'sans-serif' },
  { family: 'Outfit', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Urbanist', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Figtree', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Raleway', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Barlow', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Karla', weights: '300;400;500;600;700;800', category: 'sans-serif' },
  { family: 'Mulish', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Mulish', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Josefin Sans', weights: '300;400;500;600;700', category: 'sans-serif' },
  { family: 'Quicksand', weights: '300;400;500;600;700', category: 'sans-serif' },
  { family: 'Playfair Display', weights: '400;500;600;700;800;900', category: 'serif' },
  { family: 'Merriweather', weights: '300;400;700;900', category: 'serif' },
  { family: 'Lora', weights: '400;500;600;700', category: 'serif' },
  { family: 'PT Serif', weights: '400;700', category: 'serif' },
  { family: 'Libre Baskerville', weights: '400;700', category: 'serif' },
  { family: 'Bitter', weights: '300;400;500;600;700;800;900', category: 'serif' },
  { family: 'Cormorant Garamond', weights: '300;400;500;600;700', category: 'serif' },
  { family: 'Space Grotesk', weights: '300;400;500;600;700', category: 'display' },
  { family: 'Sora', weights: '300;400;500;600;700;800', category: 'display' },
  { family: 'Lexend', weights: '300;400;500;600;700;800;900', category: 'display' },
  { family: 'Chivo', weights: '300;400;500;600;700;800;900', category: 'display' },
  { family: 'Archivo', weights: '300;400;500;600;700;800;900', category: 'display' },
  { family: 'Oswald', weights: '300;400;500;600;700', category: 'condensed' },
  { family: 'Fira Sans', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Cabin', weights: '400;500;600;700', category: 'sans-serif' },
  { family: 'Asap', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Assistant', weights: '300;400;500;600;700;800', category: 'sans-serif' },
  { family: 'IBM Plex Sans', weights: '300;400;500;600;700', category: 'sans-serif' },
  { family: 'JetBrains Mono', weights: '300;400;500;600;700;800', category: 'monospace' },
  { family: 'Fira Code', weights: '300;400;500;600;700', category: 'monospace' },
  { family: 'Noto Sans', weights: '300;400;500;600;700;800;900', category: 'sans-serif' },
  { family: 'Noto Serif', weights: '300;400;500;600;700;800;900', category: 'serif' },
];

/** Build a Google Fonts stylesheet URL for one or many families. */
export function googleFontsUrl(families: string[]): string {
  const uniq = [...new Set(families.filter(Boolean))];
  const params = uniq.map(f => {
    const entry = GOOGLE_FONTS.find(g => g.family === f);
    const weights = entry ? entry.weights : '400;500;600;700';
    return `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
