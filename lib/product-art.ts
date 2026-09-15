function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function productArtSvg(sku: string) {
  const safe = sku.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64) || "product";
  const h = hashString(safe);
  const hue = h % 360;
  const hue2 = (hue + 28 + (h % 70)) % 360;
  const hue3 = (hue + 180 + (h % 40)) % 360;
  const variant = h % 6;
  const label = safe.replace(/^DC-|^EX-\d+-/, "").replace(/-/g, " ").slice(0, 22);
  const shapes = [
    `<circle cx="92" cy="78" r="42" fill="hsl(${hue2} 58% 62%)" opacity="0.95"/>
     <rect x="48" y="118" width="88" height="28" rx="8" fill="hsl(${hue3} 40% 28%)"/>`,
    `<polygon points="92,36 138,118 46,118" fill="hsl(${hue2} 62% 58%)"/>
     <circle cx="92" cy="128" r="22" fill="hsl(${hue3} 35% 26%)"/>`,
    `<rect x="44" y="48" width="96" height="96" rx="22" fill="hsl(${hue2} 55% 60%)"/>
     <rect x="64" y="68" width="56" height="56" rx="12" fill="hsl(${hue} 30% 96%)"/>`,
    `<ellipse cx="92" cy="96" rx="54" ry="38" fill="hsl(${hue2} 50% 58%)"/>
     <rect x="70" y="54" width="44" height="84" rx="10" fill="hsl(${hue3} 42% 32%)"/>`,
    `<path d="M92 40 L132 72 L116 128 L68 128 L52 72 Z" fill="hsl(${hue2} 60% 57%)"/>
     <circle cx="92" cy="96" r="18" fill="hsl(${hue} 28% 97%)"/>`,
    `<rect x="38" y="70" width="108" height="64" rx="16" fill="hsl(${hue2} 48% 60%)"/>
     <circle cx="64" cy="102" r="16" fill="hsl(${hue3} 40% 30%)"/>
     <circle cx="120" cy="102" r="16" fill="hsl(${hue3} 40% 30%)"/>`,
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 184 184" width="184" height="184" role="img" aria-label="${escapeXml(safe)}">
  <defs>
    <linearGradient id="g${h.toString(16)}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 42% 22%)"/>
      <stop offset="1" stop-color="hsl(${hue3} 38% 16%)"/>
    </linearGradient>
  </defs>
  <rect width="184" height="184" rx="28" fill="url(#g${h.toString(16)})"/>
  <g transform="translate(0 4)">${shapes[variant]}</g>
  <text x="92" y="168" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="rgba(255,255,255,0.88)">${escapeXml(label)}</text>
</svg>`;
}
