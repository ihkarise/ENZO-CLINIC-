/**
 * Decorative inline SVG: line icons and the hero illustration. All purely
 * presentational (aria-hidden); no text, labels or scores are ever drawn
 * here — those are always real HTML.
 */
const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3.5L2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4M12 17h.01"/>',
  phone: '<path d="M6.6 3.5h3l1.5 4.2-2 1.4a11 11 0 0 0 5.8 5.8l1.4-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
  whatsapp: '<path d="M4 20l1.2-3.6A8 8 0 1 1 8 19z"/><path d="M9.2 8.6c.3 2.6 2.4 5 5.2 5.6l1-1.1 1.8.9c-.2 1.2-1.2 1.9-2.3 1.8-3.4-.3-6.6-3.5-6.9-6.9-.1-1.1.6-2.1 1.8-2.3l.9 1.8z"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>'
};

export function icon(name){
  return `<svg class="gs-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

/** Soft, simplified digestive motif with botanical accents. */
export function illustration(){
  return `
<svg class="gs-illus" viewBox="0 0 420 420" role="presentation" focusable="false">
  <defs>
    <linearGradient id="gsStom" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F8DAD7"/><stop offset="1" stop-color="#F2C6C1"/>
    </linearGradient>
  </defs>
  <path d="M210 28c92 0 176 58 182 158 6 104-70 206-186 206S20 312 28 204C36 96 118 28 210 28z" fill="#DDEFE3"/>
  <circle cx="330" cy="92" r="38" fill="#F7E8C8"/>
  <circle cx="86" cy="330" r="26" fill="#E9E2F3"/>
  <!-- leaves -->
  <g fill="none" stroke="#163F3A" stroke-width="3" stroke-linecap="round" opacity=".55">
    <path d="M74 150c18-40 58-52 82-46-4 30-34 62-82 46z" fill="#BFDDCB" stroke="none"/>
    <path d="M74 150c26-12 50-26 82-46"/>
    <path d="M338 300c-6-38 18-68 42-76 10 26-4 66-42 76z" fill="#BFDDCB" stroke="none"/>
    <path d="M338 300c10-24 24-48 42-76"/>
  </g>
  <!-- oesophagus + stomach -->
  <path d="M196 70c0 28 2 46 10 64" fill="none" stroke="#E9B8B2" stroke-width="16" stroke-linecap="round"/>
  <path d="M206 128c40-10 82 8 86 46 4 34-26 58-62 60-30 2-52-8-70-4-16 4-24 20-14 30-26-6-32-36-14-54 18-18 46-12 62-30 12-14 2-34 12-48z" fill="url(#gsStom)"/>
  <!-- intestines: large-intestine frame around soft small-intestine folds -->
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M128 372V262c0-18 12-28 28-28h112c16 0 28 10 28 28v84c0 16-10 26-26 26h-36" stroke="#C9BCE3" stroke-width="18"/>
    <path d="M160 268c18-14 34 14 52 0s34 14 52 0c16 2 16 28 0 30-18 14-34-14-52 0s-34-14-52 0c-16 2-16 28 0 30 18-14 34 14 52 0s34 14 52 0" stroke="#DCEAF4" stroke-width="13"/>
    <path d="M160 268c18-14 34 14 52 0s34 14 52 0c16 2 16 28 0 30-18 14-34-14-52 0s-34-14-52 0c-16 2-16 28 0 30 18-14 34 14 52 0s34 14 52 0" stroke="#9CC0DA" stroke-width="2.5" opacity=".75"/>
  </g>
  <!-- sparkles -->
  <g fill="#163F3A" opacity=".35"><circle cx="300" cy="196" r="4"/><circle cx="120" cy="214" r="3"/><circle cx="262" cy="378" r="3"/></g>
</svg>`;
}
