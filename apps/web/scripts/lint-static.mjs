import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const extensions = new Set([".ts", ".tsx", ".css", ".mjs"]);
const checks = [
  { pattern: /<<<<<<<|=======|>>>>>>>/, message: "merge conflict marker" },
  { pattern: /\bdebugger\b/, message: "debugger statement" },
  { pattern: /DO NOT SUBMIT/i, message: "DO NOT SUBMIT marker" },
  { pattern: /\bconsole\.log\s*\(/, message: "console.log statement" },
];
const redesignedPaths = [
  "app/components/shell/",
  "app/components/workspace/",
  "app/pages/Home.tsx",
  "app/pages/WorkspaceHome.tsx",
  "app/pages/Chat.tsx",
  "app/pages/Projects.tsx",
  "app/pages/History.tsx",
  "app/pages/Apps.tsx",
  "app/pages/Media.tsx",
  "app/pages/AvatarStudio.tsx",
  "app/pages/BusinessCabinet.tsx",
  "app/pages/Balance.tsx",
  "app/pages/Settings.tsx",
  "styles/landing.css",
  "styles/motion.css",
  "styles/tokens.css",
  "styles/typography.css",
  "styles/workspace.css",
];

const failures = [];
const warnings = [];

for (const file of walk(root)) {
  if (!extensions.has(file.slice(file.lastIndexOf(".")))) continue;
  const source = readFileSync(file, "utf8");
  const name = relative(root, file).split(sep).join("/");
  const redesigned = redesignedPaths.some((path) => name === path || name.startsWith(path));

  for (const check of checks) {
    if (check.pattern.test(source)) {
      failures.push(`${name}: ${check.message}`);
    }
  }

  if (file.endsWith(".tsx")) {
    checkTsxAccessibility(name, source, redesigned);
  }

  if (redesigned && /#[0-9a-fA-F]{3,8}\b/.test(source)) {
    warnings.push(`${name}: hardcoded hex color in redesigned UI scope`);
  }
}

if (failures.length > 0) {
  console.error("Static lint failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("Static lint warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log("Static lint passed.");

function checkTsxAccessibility(name, source, redesigned) {
  for (const match of source.matchAll(/<img\b([^>]*)>/g)) {
    const attrs = match[1] ?? "";
    if (!/\balt=/.test(attrs)) {
      const message = `${name}: <img> without alt`;
      if (redesigned) failures.push(message);
      else warnings.push(message);
    }
  }

  for (const match of source.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = match[1] ?? "";
    if (!/\btype=/.test(attrs) && redesigned) {
      warnings.push(`${name}: button without explicit type`);
    }
  }

  for (const match of source.matchAll(/<div\b([^>]*)\bonClick=/g)) {
    const attrs = match[1] ?? "";
    if (!/\brole=/.test(attrs) || !/\btabIndex=/.test(attrs)) {
      const message = `${name}: clickable <div> should expose role and keyboard focus`;
      if (redesigned) failures.push(message);
      else warnings.push(message);
    }
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "dist" || entry === "node_modules") continue;
      yield* walk(full);
      continue;
    }
    yield full;
  }
}
