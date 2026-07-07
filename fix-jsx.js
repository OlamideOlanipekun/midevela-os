const fs = require('fs');

let pageStr = fs.readFileSync('app/src/app/page.tsx', 'utf8');

// Convert HTML comments to JSX comments
pageStr = pageStr.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

// Convert <br> to <br />
pageStr = pageStr.replace(/<br>/g, '<br />');

// Convert & to &amp; in text (but not in entities that are already converted)
// Actually, it's safer to just replace any remaining unclosed tags if we find them.

fs.writeFileSync('app/src/app/page.tsx', pageStr);
console.log('Fixed JSX syntax in page.tsx');
