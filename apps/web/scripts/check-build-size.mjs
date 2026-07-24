import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const assetsDir = new URL("../dist/assets", import.meta.url).pathname;
const maxAnyJsBytes = 600 * 1024;
const warnAnyJsBytes = 500 * 1024;
const maxRouteChunkBytes = 180 * 1024;
const routeChunkPattern = /^(Home|WorkspaceHome|Chat|Apps|Media|AvatarStudio|Projects|History|BusinessCabinet|Balance|Settings)-.*\.js$/;

if (!existsSync(assetsDir)) {
  console.error("Bundle audit failed: apps/web/dist/assets does not exist. Run npm --prefix apps/web run build first.");
  process.exit(1);
}

const failures = [];
const warnings = [];
const jsAssets = readdirSync(assetsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => {
    const bytes = statSync(join(assetsDir, file)).size;
    return { file, bytes };
  })
  .sort((a, b) => b.bytes - a.bytes);

for (const asset of jsAssets) {
  if (asset.bytes > maxAnyJsBytes) {
    failures.push(`${asset.file}: ${formatBytes(asset.bytes)} exceeds ${formatBytes(maxAnyJsBytes)}`);
  } else if (asset.bytes > warnAnyJsBytes) {
    warnings.push(`${asset.file}: ${formatBytes(asset.bytes)} exceeds ${formatBytes(warnAnyJsBytes)}`);
  }

  if (routeChunkPattern.test(asset.file) && asset.bytes > maxRouteChunkBytes) {
    failures.push(`${asset.file}: route chunk ${formatBytes(asset.bytes)} exceeds ${formatBytes(maxRouteChunkBytes)}`);
  }
}

if (warnings.length > 0) {
  console.warn("Bundle audit warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length > 0) {
  console.error("Bundle audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const top = jsAssets.slice(0, 8).map((asset) => `${asset.file} ${formatBytes(asset.bytes)}`).join(", ");
console.log(`Bundle audit passed. Largest JS assets: ${top}`);

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}
