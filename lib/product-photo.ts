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

function wrapTitle(title: string, width = 18) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

type Motif =
  | "shoe"
  | "bag"
  | "bottle"
  | "tech"
  | "phone"
  | "clothes"
  | "food"
  | "jewel"
  | "toy"
  | "cabinet"
  | "beauty"
  | "baby"
  | "fit"
  | "watch"
  | "office"
  | "health"
  | "generic";

export function productMotif(title: string, category: string): Motif {
  const t = `${title} ${category}`.toLowerCase();
  if (/shoe|loafer|sneaker|boot|derby|sandal|heel/.test(t)) return "shoe";
  if (/watch|chrono|timepiece/.test(t)) return "watch";
  if (/bag|tote|backpack|duffel|clutch|wallet|pouch|briefcase|satchel|sling|pannier|folio|chest/.test(t)) return "bag";
  if (/bottle|tumbler|flask|drink|beverage|soda|coffee|tea|juice|tonic|kombucha|water|colander|jar/.test(t))
    return "bottle";
  if (/phone|earbud|magsafe|sim |selfie|lanyard|temple/.test(t) || /mobile accessories/.test(t)) return "phone";
  if (/mouse|keyboard|hub|monitor|laptop|ssd|webcam|charger|cable|usb|dock|kvm|fan|mic/.test(t) || /computer/.test(t))
    return "tech";
  if (/dress|shirt|jacket|pant|jean|hoodie|coat|sweater|sock|legging|tee|polo|onesie|tutu/.test(t) || /clothing/.test(t))
    return "clothes";
  if (/cookie|chocolate|snack|dessert|candy|nougat|cracker|gummy|blondie|macaroon/.test(t) || /snack/.test(t))
    return "food";
  if (/ring|necklace|earring|bracelet|pendant|gold|silver|pearl|jewel/.test(t) || /jewelry/.test(t)) return "jewel";
  if (/toy|puzzle|plush|kite|brick|easel|croquet|dino|marble/.test(t) || /toy/.test(t)) return "toy";
  if (/cabinet|shelf|hutch|hamper|organizer|duvet|board|crock|console/.test(t) || /cabinet/.test(t)) return "cabinet";
  if (/serum|cream|balm|spf|mask|toner|skincare|beauty|lipstick|oil/.test(t) || /beauty/.test(t)) return "beauty";
  if (/baby|onesie|pacifier|stroller|crib|nursing|teether|diaper/.test(t) || /mother/.test(t)) return "baby";
  if (/yoga|dumbbell|kettle|gym|rope|bench|bike|mat|band|rack|ball/.test(t) || /fitness/.test(t)) return "fit";
  if (/desk|pen|stapler|notebook|folder|shredder|planner|office/.test(t) || /office/.test(t)) return "office";
  if (/vitamin|capsule|powder|thermometer|oximeter|health/.test(t) || /health/.test(t)) return "health";
  if (/digital|ssd|camera|speaker|monitor|nas|doorbell/.test(t)) return "tech";
  if (/luxury|silk|cashmere|crystal|scarf/.test(t)) return "jewel";
  return "generic";
}

function motifDrawing(motif: Motif, accent: string, ink: string) {
  switch (motif) {
    case "shoe":
      return `<ellipse cx="400" cy="430" rx="210" ry="48" fill="${ink}" opacity="0.12"/>
        <path d="M190 390 C260 300 520 300 610 360 C640 380 640 420 580 430 L220 430 C180 420 170 410 190 390 Z" fill="${accent}"/>
        <path d="M250 360 L560 360" stroke="white" stroke-width="10" fill="none" opacity="0.5"/>`;
    case "bag":
      return `<rect x="250" y="250" width="300" height="240" rx="36" fill="${accent}"/>
        <path d="M310 250 C310 190 490 190 490 250" stroke="${ink}" stroke-width="18" fill="none"/>
        <circle cx="400" cy="360" r="18" fill="white"/>`;
    case "bottle":
      return `<rect x="355" y="200" width="90" height="70" rx="12" fill="${ink}"/>
        <path d="M320 270 L480 270 L500 500 L300 500 Z" fill="${accent}"/>
        <rect x="370" y="175" width="60" height="30" rx="8" fill="${accent}"/>`;
    case "tech":
      return `<rect x="230" y="240" width="340" height="220" rx="24" fill="${ink}"/>
        <rect x="250" y="258" width="300" height="170" rx="12" fill="${accent}"/>
        <rect x="360" y="460" width="80" height="16" rx="8" fill="${ink}"/>`;
    case "phone":
      return `<rect x="320" y="200" width="160" height="300" rx="28" fill="${ink}"/>
        <rect x="338" y="230" width="124" height="220" rx="12" fill="${accent}"/>
        <circle cx="400" cy="470" r="10" fill="white"/>`;
    case "clothes":
      return `<path d="M250 250 L340 230 L400 300 L460 230 L550 250 L520 500 L280 500 Z" fill="${accent}"/>
        <path d="M340 230 C370 280 430 280 460 230" fill="${ink}"/>`;
    case "food":
      return `<ellipse cx="400" cy="380" rx="170" ry="70" fill="${accent}"/>
        <ellipse cx="400" cy="340" rx="150" ry="90" fill="${ink}"/>
        <ellipse cx="400" cy="320" rx="110" ry="40" fill="${accent}"/>`;
    case "jewel":
      return `<polygon points="400,210 470,300 400,500 330,300" fill="${accent}"/>
        <polygon points="400,210 440,250 400,280 360,250" fill="white" opacity="0.5"/>`;
    case "toy":
      return `<circle cx="330" cy="340" r="70" fill="${accent}"/>
        <circle cx="470" cy="340" r="70" fill="${ink}"/>
        <rect x="300" y="420" width="200" height="50" rx="16" fill="${accent}"/>`;
    case "cabinet":
      return `<rect x="240" y="220" width="320" height="280" rx="16" fill="${accent}"/>
        <line x1="400" y1="220" x2="400" y2="500" stroke="${ink}" stroke-width="10"/>
        <circle cx="370" cy="360" r="10" fill="${ink}"/>
        <circle cx="430" cy="360" r="10" fill="${ink}"/>`;
    case "beauty":
      return `<rect x="355" y="210" width="90" height="40" rx="10" fill="${ink}"/>
        <path d="M340 250 L460 250 L480 500 L320 500 Z" fill="${accent}"/>`;
    case "baby":
      return `<circle cx="400" cy="300" r="70" fill="${accent}"/>
        <path d="M300 500 C300 380 500 380 500 500 Z" fill="${ink}"/>`;
    case "fit":
      return `<rect x="180" y="330" width="440" height="70" rx="35" fill="${ink}"/>
        <circle cx="230" cy="365" r="70" fill="${accent}"/>
        <circle cx="570" cy="365" r="70" fill="${accent}"/>`;
    case "watch":
      return `<rect x="370" y="180" width="60" height="90" rx="12" fill="${ink}"/>
        <circle cx="400" cy="360" r="110" fill="${accent}"/>
        <circle cx="400" cy="360" r="78" fill="white"/>
        <rect x="370" y="450" width="60" height="90" rx="12" fill="${ink}"/>`;
    case "office":
      return `<rect x="250" y="260" width="300" height="220" rx="12" fill="${accent}"/>
        <rect x="280" y="230" width="240" height="40" rx="8" fill="${ink}"/>`;
    case "health":
      return `<circle cx="400" cy="360" r="130" fill="${accent}"/>
        <rect x="370" y="280" width="60" height="160" rx="10" fill="white"/>
        <rect x="320" y="330" width="160" height="60" rx="10" fill="white"/>`;
    default:
      return `<rect x="260" y="240" width="280" height="240" rx="28" fill="${accent}"/>
        <circle cx="400" cy="360" r="54" fill="white"/>`;
  }
}

export function productPhotoSvg(title: string, category: string, sku: string) {
  const h = hashString(`${sku}:${title}`);
  const hue = h % 360;
  const motif = productMotif(title, category);
  const accent = `hsl(${(hue + 18) % 360} 62% 52%)`;
  const ink = `hsl(${hue} 32% 16%)`;
  const lines = wrapTitle(title);
  const lineStart = 620 - (lines.length - 1) * 22;
  const labels = lines
    .map(
      (line, index) =>
        `<text x="400" y="${lineStart + index * 28}" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="26" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="${escapeXml(title)}">
  <rect width="800" height="800" fill="hsl(${hue} 28% 94%)"/>
  <rect x="48" y="48" width="704" height="704" rx="48" fill="white"/>
  <text x="88" y="110" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="20" letter-spacing="2" fill="hsl(${hue} 20% 42%)">${escapeXml(category.toUpperCase())}</text>
  ${motifDrawing(motif, accent, ink)}
  ${labels}
</svg>`;
}
