const fs = require('fs');
const html = fs.readFileSync('midevela-homepage-mockup.html', 'utf8');
const match = html.match(/<style>([\s\S]*?)<\/style>/);
if (match) {
  let css = match[1];
  // Add the font import at the top
  const header = `/* ═══════════════════════════════════════════════════════════
   MIDEVELA — Design System & Global Styles
   Premium paper and ink aesthetic with rust and teal accents.
   Extracted from midevela-homepage-mockup.html
   ═══════════════════════════════════════════════════════════ */\n\n@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');\n`;
  fs.writeFileSync('app/src/app/globals.css', header + css);
  console.log('Successfully extracted CSS to globals.css');
} else {
  console.log('No style block found');
}
