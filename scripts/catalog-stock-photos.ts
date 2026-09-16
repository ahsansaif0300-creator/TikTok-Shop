/** Verified Unsplash stills tagged so catalog titles can pick a matching photo. */

export type StockPhoto = {
  url: string;
  tags: string[];
};

function unsplash(id: string, tags: string): StockPhoto {
  return {
    url: `https://images.unsplash.com/photo-${id}?auto=format&w=1400&q=85`,
    tags: tags.split(/\s+/).filter(Boolean),
  };
}

export const STOCK_PHOTOS: StockPhoto[] = [
  unsplash("1602143407151-7111542de6e8", "bottle water flask insulated tumbler stainless drink"),
  unsplash("1495474472287-4d71bcdd2085", "coffee latte brew espresso cafe drink beverage"),
  unsplash("1511920170033-f8396924c348", "coffee brew espresso cafe drink beverage"),
  unsplash("1509042239860-f550ce710b93", "coffee cup mug brew drink beverage"),
  unsplash("1514432324607-a09d9b4aefdd", "coffee cold brew drink beverage"),
  unsplash("1572442388796-11668a67e53d", "espresso coffee capsule machine drink"),
  unsplash("1551024506-0bccd828d307", "drink cocktail soda beverage sparkling lemon tonic"),
  unsplash("1527864550417-7fd91fc51a46", "mouse wireless computer accessory"),
  unsplash("1511467687858-23d96c32e4ae", "keyboard mechanical computer accessory"),
  unsplash("1517336714731-489689fd1ca8", "laptop computer notebook portable monitor"),
  unsplash("1496181133206-80ce9b88a853", "laptop computer notebook"),
  unsplash("1525547719571-a2d4ac8945e2", "laptop computer notebook"),
  unsplash("1531297484001-80022131f5a1", "laptop computer notebook"),
  unsplash("1498050108023-c5249f4df085", "imac desktop monitor computer office"),
  unsplash("1518770660439-4636190af475", "circuit electronics chip digital ssd nas"),
  unsplash("1550745165-9bc0b252726f", "console gaming controller digital"),
  unsplash("1518709268805-4e9042af9f23", "electronics chip digital circuit"),
  unsplash("1550751827-4bd374c3f58b", "electronics chip digital circuit"),
  unsplash("1505740420928-5e560c06d30e", "headphones earbuds audio speaker"),
  unsplash("1484704849700-f032a568e944", "headphones earbuds audio"),
  unsplash("1572569511254-d8f925fe2cbb", "earbuds earphones wireless audio"),
  unsplash("1590658268037-6bf12165a8df", "earbuds earphones wireless audio"),
  unsplash("1511707171634-5f897ff02aa9", "phone smartphone mobile case"),
  unsplash("1510557880182-3d4d3cba35a5", "phone smartphone mobile"),
  unsplash("1601784551446-20c9e07cdbdb", "phone smartphone mobile"),
  unsplash("1583743814966-8936f5b7be1a", "tshirt tee shirt clothing men"),
  unsplash("1521572163474-6864f9cf17ab", "tshirt tee shirt clothing"),
  unsplash("1503342217505-b0a15ec3261c", "tshirt tee shirt clothing"),
  unsplash("1591047139829-d91aecb6caea", "jacket coat fleece clothing men"),
  unsplash("1552374196-1ab2a1c593e8", "coat overcoat jacket clothing men"),
  unsplash("1434389677669-e08b4cac3105", "sweater knit pullover clothing"),
  unsplash("1576566588028-4147f3842f27", "hoodie sweatshirt clothing"),
  unsplash("1617137968427-85924c800a22", "suit blazer tuxedo jacket clothing"),
  unsplash("1483985988355-763728e1935b", "coat fashion clothing women"),
  unsplash("1542291026-7eec264c27ff", "shoe sneaker trainer footwear"),
  unsplash("1549298916-b41d501d3772", "shoe sneaker trainer footwear"),
  unsplash("1460353581641-37baddab0fa2", "shoe sneaker running footwear"),
  unsplash("1525966222134-fcfa99b8ae77", "shoe sneaker footwear"),
  unsplash("1548036328-c9fa89d128fa", "bag leather briefcase satchel"),
  unsplash("1553062407-98eeb64c6a62", "backpack bag pack daypack"),
  unsplash("1566150905458-1bf1fc113f0d", "bag handbag purse women"),
  unsplash("1584917865442-de89df76afd3", "bag handbag purse luxury women"),
  unsplash("1515562141207-7a88fb7ce338", "jewelry ring gold luxury"),
  unsplash("1573408301185-9146fe634ad0", "jewelry necklace pendant gold"),
  unsplash("1605100804763-247f67b3557e", "jewelry ring diamond luxury"),
  unsplash("1523275335684-37898b6baf30", "watch wristwatch timepiece"),
  unsplash("1524805444758-089113d48a6d", "watch wristwatch timepiece chronograph"),
  unsplash("1555041469-a586c61ea9bc", "sofa furniture cabinet home"),
  unsplash("1556912172-45b7abe8b7e1", "kitchen cabinet home pantry"),
  unsplash("1586023492125-27b2c045efd7", "furniture cabinet shelf home interior"),
  unsplash("1494438639946-1ebd1d20bf85", "lamp light desk clip office"),
  unsplash("1611591437281-460bfbe1220a", "bracelet jewelry tennis luxury gold"),
  unsplash("1571019614242-c5c5dee9f50b", "gym fitness workout"),
  unsplash("1576678927484-cc907957088c", "dumbbell gym fitness weight"),
  unsplash("1583454110551-21f2fa2afe61", "gym fitness workout bench"),
  unsplash("1541534741688-6078c6bfb5c5", "gym fitness workout"),
  unsplash("1499636136210-6f4ee915583e", "cookie snack dessert chocolate bakery"),
  unsplash("1504674900247-0877df9cc836", "food snack dessert meal"),
  unsplash("1556228720-195a672e8a03", "cream jar skincare beauty lotion"),
  unsplash("1571781926291-c477ebfd024b", "serum bottle skincare beauty cosmetics"),
  unsplash("1611930022073-b7a4ba5fcccd", "serum dropper bottle skincare beauty"),
  unsplash("1620916566398-39f1143ab7be", "skincare beauty cosmetics cream"),
  unsplash("1497032628192-86f99bcd76bc", "laptop computer notebook workstation"),
  unsplash("1586281380349-632531db7ed4", "notebook planner office pen paper"),
  unsplash("1566576912321-d58ddd7a6088", "toy blocks bricks children kids"),
];

const STOP = new Set([
  "and",
  "the",
  "with",
  "for",
  "from",
  "pack",
  "set",
  "pair",
  "trio",
  "mini",
  "pro",
  "slim",
  "classic",
  "compact",
  "portable",
  "everyday",
  "carry",
  "small",
  "large",
  "wide",
  "long",
  "short",
  "fold",
  "flat",
]);

const GENERIC_HEADS = new Set([
  "bag",
  "bar",
  "board",
  "box",
  "cable",
  "case",
  "clip",
  "cream",
  "cube",
  "cup",
  "gel",
  "kit",
  "lamp",
  "light",
  "mat",
  "mount",
  "oil",
  "pad",
  "pen",
  "rack",
  "ring",
  "stand",
  "stick",
  "top",
]);

const HEAD_SYNONYMS: Record<string, string[]> = {
  tumbler: ["tumbler"],
  bottle: ["bottle", "flask"],
  tote: ["tote", "shopper", "bag"],
  tripod: ["tripod", "monopod"],
  cable: ["cable", "cord"],
  light: ["lamp", "light"],
  cube: ["cube"],
  tray: ["tray"],
  mouse: ["mouse"],
  keyboard: ["keyboard"],
  charger: ["charger"],
  headphone: ["headphone", "headset"],
  earbud: ["earbud", "earphone"],
  watch: ["watch", "timepiece", "wristwatch"],
  necklace: ["necklace", "pendant"],
  earring: ["earring", "hoop"],
  bracelet: ["bracelet", "bangle", "cuff"],
  ring: ["ring"],
  backpack: ["backpack", "daypack", "rucksack"],
  duffel: ["duffel", "duffle", "holdall"],
  jacket: ["jacket", "coat", "shell"],
  coat: ["coat", "overcoat", "jacket"],
  vest: ["vest", "gilet", "waistcoat"],
  dress: ["dress", "gown"],
  shirt: ["shirt", "blouse", "overshirt"],
  overshirt: ["overshirt", "flannel"],
  tee: ["tee", "tshirt", "shirt"],
  tshirt: ["tshirt", "tee", "shirt"],
  sock: ["sock"],
  crew: ["crew", "sweater", "pullover"],
  pajama: ["pajama", "pyjama", "sleepwear"],
  onesie: ["onesie", "bodysuit", "romper"],
  legging: ["legging", "tights"],
  shoe: ["shoe", "sneaker", "trainer", "loafer", "boot"],
  sneaker: ["sneaker", "shoe", "trainer"],
  bag: ["bag", "handbag", "purse", "tote"],
  sling: ["sling", "crossbody"],
  multivitamin: ["multivitamin", "vitamin", "supplement", "tablet"],
  vitamin: ["vitamin", "supplement", "tablet", "multivitamin"],
  softgel: ["softgel", "capsule", "supplement"],
  capsule: ["capsule", "softgel", "supplement", "tablet"],
  probiotic: ["probiotic", "supplement", "capsule"],
  collagen: ["collagen", "powder", "supplement"],
  lozenge: ["lozenge", "supplement"],
  gummy: ["gummy", "gummies", "supplement"],
  serum: ["serum", "dropper"],
  cream: ["cream", "moisturizer", "moisturiser", "lotion"],
  spf: ["spf", "sunscreen", "sunblock"],
  sunscreen: ["sunscreen", "spf", "sunblock"],
  kettlebell: ["kettlebell"],
  dumbbell: ["dumbbell"],
  mat: ["mat"],
  cookie: ["cookie", "biscuit"],
  chocolate: ["chocolate"],
  soda: ["soda", "can", "sparkling"],
  tea: ["tea"],
  coffee: ["coffee", "espresso"],
  lamp: ["lamp", "light"],
  stapler: ["stapler"],
  notebook: ["notebook", "journal"],
  puzzle: ["puzzle"],
  plush: ["plush", "stuffed"],
  colander: ["colander", "strainer", "sieve"],
  oximeter: ["oximeter"],
  cufflink: ["cufflink"],
  dongle: ["dongle", "dac", "adapter"],
  dac: ["dac", "dongle", "adapter"],
  crock: ["crock", "jar", "holder", "utensil"],
  wallet: ["wallet", "cardholder"],
  enclosure: ["enclosure", "ssd", "nvme"],
  logger: ["logger", "gps", "tracker"],
  keychain: ["keychain", "logger", "gps"],
};

export function titleTokens(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/s$/, ""))
    .filter((word) => word.length > 2 && !STOP.has(word) && !/^\d+$/.test(word) && !/^\d+[a-z]+$/.test(word));
}

const HEAD_SKIP = new Set([
  "lid",
  "cover",
  "cap",
  "pack",
  "kit",
  "hook",
  "strap",
  "clip",
  "seamless",
  "dotted",
  "cubic",
  "linear",
  "relaxed",
  "packable",
  "brushed",
  "pair",
  "mini",
  "small",
  "compact",
  "classic",
]);

export function headNoun(title: string) {
  const primary = title.split(/\bwith\b|\bfor\b/i)[0] ?? title;
  const tokens = titleTokens(primary);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (!HEAD_SKIP.has(token) && !HEAD_SKIP.has(`${token}s`)) return token;
  }
  return titleTokens(title).at(-1) ?? "";
}

export function headSynonyms(title: string) {
  const head = headNoun(title);
  return HEAD_SYNONYMS[head] ?? (head ? [head] : []);
}

export function synonymsFor(token: string) {
  return HEAD_SYNONYMS[token] ?? [token];
}

export function isGenericHead(title: string) {
  return GENERIC_HEADS.has(headNoun(title));
}

export function hayHasHead(title: string, haystack: string) {
  const hay = haystack.toLowerCase();
  return headSynonyms(title).some((word) => new RegExp(`\\b${word}s?\\b`, "i").test(hay));
}

function tokenHit(token: string, haystack: string) {
  return new RegExp(`\\b${token}s?\\b`, "i").test(haystack);
}

export function stockScore(title: string, photo: StockPhoto) {
  const tokens = titleTokens(title);
  if (!tokens.length) return 0;
  const hay = photo.tags.join(" ");
  if (!hayHasHead(title, hay)) return 0;
  let score = 2;
  for (const token of tokens) {
    if (photo.tags.some((tag) => tag === token || tag.startsWith(token) || token.startsWith(tag))) {
      score += token.length > 6 ? 2 : 1;
    }
  }
  if (GENERIC_HEADS.has(headNoun(title)) && score < 4) return 0;
  return score;
}

export function rankedStock(title: string) {
  return STOCK_PHOTOS.map((photo) => ({ photo, score: stockScore(title, photo) }))
    .filter((row) => row.score >= 2)
    .sort((a, b) => b.score - a.score);
}

export function wikiQueries(title: string, _category: string) {
  const cleaned = title
    .replace(/\b\d+(\.\d+)?\s*(oz|mm|inch|in|w|gb|tb|lb|ft|l|ml|-pack|pack)?\b/gi, " ")
    .replace(/\b(set|pair|trio|mini|pro|slim|classic|compact|portable|everyday|carry|fold-flat|fold)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  const last = words.slice(-2).join(" ");
  const syn = headSynonyms(title)[0] ?? headNoun(title);
  return [...new Set([cleaned, last, `${syn} photograph`, `${syn} product`, syn])].filter(
    (query) => query.length > 2,
  );
}

function wikiFile(name: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1200`;
}

/** Title-matched Commons stills for SKUs that search routinely misses. */
export const CURATED_SKU_PHOTOS: Record<string, string[]> = {
  "DC-hot-selling-items-06": [wikiFile("A 3M Desk Lamp.jpg")],
  "DC-hot-selling-items-09": [
    wikiFile("Steelie Vent Mount.jpg"),
    wikiFile("Car universal holder for smartphones and phablets, Oude Pekela (2018) 01.jpg"),
  ],
  "DC-hot-selling-items-10": [wikiFile("String bag.jpg"), wikiFile("Mandarin oranges in mesh bag.jpg")],
  "DC-hot-selling-items-14": [wikiFile("Blue colander.jpg")],
  "DC-computer-accessori-09": [
    wikiFile("Dual SSD SATA adapter with Samsung 860 EVO SSD and 2.5-inch enclosure.jpg"),
    wikiFile("Samsung 980 PRO PCIe 4.0 NVMe SSD 1TB-top PNr°0915.jpg"),
  ],
  "DC-computer-accessori-23": [wikiFile("Kensington Laptop Lock 1 2019-05-06.jpg")],
  "DC-home-cabinets-15": [wikiFile("KitchenUtensils.jpg")],
  "DC-health-products-08": [wikiFile("B vitamin supplement tablets.jpg")],
  "DC-health-products-16": [wikiFile("Pulse Oximeter Blue Colour.jpg")],
  "DC-mens-clothing-02": [wikiFile("Hand-knitted Himachali socks,2.jpg")],
  "DC-mens-clothing-07": [
    "https://cdn.dummyjson.com/product-images/mens-shirts/man-plaid-shirt/1.webp",
    "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/1.webp",
  ],
  "DC-mens-clothing-09": [wikiFile("Adidas Helionic Down vest.jpg")],
  "DC-mens-clothing-23": [wikiFile("FILA-Daunenjacke.JPG")],
  "DC-womens-clothing-05": [wikiFile("Denim jacket details.jpg")],
  "DC-womens-clothing-13": [wikiFile("Cashmere Sweater.jpg")],
  "DC-mobile-accessories-02": [wikiFile("Red leather credit card holder.jpg")],
  "DC-mobile-accessories-05": [wikiFile("MagSafe and USB-C Cable Charger for iPhone.jpg")],
  "DC-mobile-accessories-10": [wikiFile("Clip on lens white.jpg")],
  "DC-mobile-accessories-19": [wikiFile("IPhone SIM Removal Tool.jpg")],
  "DC-beverages-13": [wikiFile("Evian Bottle.jpg")],
  "DC-office-supplies-02": [wikiFile("Moleskine notebook - 2019.jpg")],
  "DC-digital-products-14": [
    wikiFile("Osma USB Type-C to 3.5mm stereo mini jack ADCS-04BK.jpg"),
    wikiFile("KORG DS-DAC-10 - 1-bit USB-DAC (photozou 208854840).jpg"),
  ],
  "DC-digital-products-16": [wikiFile("GPS-Logger i-Blue 747A+ 01.jpg")],
  "DC-beauty-and-skincar-02": [wikiFile("LRP sunscreen bottle.jpg")],
  "DC-mother-and-baby-pr-06": [wikiFile("Nuggikette Elefant.jpg")],
  "DC-jewelry-and-watche-07": [wikiFile("18K Yellow Gold Tennis Bracelet.jpg")],
  "DC-jewelry-and-watche-15": [wikiFile("Cufflinks-awi hg.jpg")],
  "DC-luxury-goods-09": [wikiFile("Red leather credit card holder.jpg")],
  "DC-childrens-clothing-01": [wikiFile("Menzis bodysuit for newborns (2019) 01.jpg"), wikiFile("A romper suit.jpg")],
  "DC-childrens-clothing-13": [wikiFile("Christmas Present Leggings.png")],
  "DC-childrens-clothing-25": [
    "https://live.staticflickr.com/65535/53445873744_8ea02b19de_b.jpg",
    "https://live.staticflickr.com/65535/53445964400_716a64bdf9_b.jpg",
  ],
  "DC-mens-bags-05": [wikiFile("Tumi mens shoulder bag valentine.jpg")],
  "DC-mens-bags-22": [wikiFile("Ammo bag (14438983967).jpg")],
  "DC-womens-bags-09": [wikiFile("Camera bag (7410221808).jpg")],
  "DC-womens-bags-12": [
    "https://cdn.dummyjson.com/product-images/womens-bags/heshe-women's-leather-bag/1.webp",
    "https://cdn.dummyjson.com/product-images/womens-bags/blue-women's-handbag/1.webp",
  ],
  "DC-womens-bags-13": [wikiFile("MZW MetroTote.png")],
  "DC-womens-bags-17": [wikiFile("Duffel bag on the floor next to a chair (9XiN0r2NWSM).jpg")],
  "DC-womens-bags-25": [wikiFile("Gladstone bag made of ox leather.jpg")],
  "DC-fitness-equipment-01": [wikiFile("Cast Iron Russian kettlebell.jpg")],
};

