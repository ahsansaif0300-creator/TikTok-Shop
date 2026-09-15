import { renameSync, unlinkSync } from "node:fs";
import sharp from "sharp";

const pairs: [string, string][] = [
  ["09", "/opt/cursor/artifacts/assets/fitness-massage-gun.png"],
  ["12", "/opt/cursor/artifacts/assets/fitness-gym-rings.png"],
  ["14", "/opt/cursor/artifacts/assets/fitness-jump-rope.png"],
  ["17", "/opt/cursor/artifacts/assets/fitness-weight-bench.png"],
  ["19", "/opt/cursor/artifacts/assets/fitness-foam-roller.png"],
  ["20", "/opt/cursor/artifacts/assets/fitness-pullup-bar.png"],
  ["23", "/opt/cursor/artifacts/assets/fitness-treadmill.png"],
];

async function main() {
  for (const [n, src] of pairs) {
    const dest = `public/catalog/DC-fitness-equipment-${n}.jpg`;
    await sharp(src).resize(800, 800, { fit: "cover" }).jpeg({ quality: 84 }).toFile(`${dest}.tmp`);
    renameSync(`${dest}.tmp`, dest);
    console.log(dest);
  }
}

main();
