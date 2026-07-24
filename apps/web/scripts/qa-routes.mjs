import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:5179";
const routes = (process.env.QA_ROUTES || "/,/workspace,/workspace/chat,/workspace/projects,/workspace/apps,/workspace/media,/workspace/avatar,/workspace/business,/workspace/balance,/workspace/settings")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
const failures = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const httpErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !isExpectedConsoleError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !isExpectedHttpError(response)) {
        httpErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    for (const route of routes) {
      const url = new URL(route, baseUrl).toString();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
        await closeBlockingDialogs(page);
        await page.waitForTimeout(120);

        const result = await page.evaluate(() => {
          const doc = document.documentElement;
          const bodyText = document.body.innerText.trim();
          const horizontalOverflow = Math.max(0, doc.scrollWidth - doc.clientWidth);
          const unnamedButtons = Array.from(document.querySelectorAll("button"))
            .filter((button) => {
              const rect = button.getBoundingClientRect();
              const visible = rect.width > 0 && rect.height > 0;
              const name = button.textContent?.trim() || button.getAttribute("aria-label") || button.getAttribute("title");
              return visible && !name;
            })
            .length;
          const imagesWithoutAlt = Array.from(document.querySelectorAll("img"))
            .filter((image) => !image.hasAttribute("alt"))
            .length;
          const routeError = bodyText.includes("Ошибка маршрута") || bodyText.includes("Route error");
          return { bodyTextLength: bodyText.length, horizontalOverflow, unnamedButtons, imagesWithoutAlt, routeError };
        });

        if (result.bodyTextLength < 20) failures.push(`${viewport.name} ${route}: page rendered almost empty`);
        if (result.horizontalOverflow > 2) failures.push(`${viewport.name} ${route}: horizontal overflow ${result.horizontalOverflow}px`);
        if (result.unnamedButtons > 0) failures.push(`${viewport.name} ${route}: ${result.unnamedButtons} visible button(s) without accessible name`);
        if (result.imagesWithoutAlt > 0) failures.push(`${viewport.name} ${route}: ${result.imagesWithoutAlt} image(s) without alt`);
        if (result.routeError) failures.push(`${viewport.name} ${route}: route error boundary rendered`);
      } catch (error) {
        failures.push(`${viewport.name} ${route}: ${error.message}`);
      }
    }

    if (consoleErrors.length > 0) {
      failures.push(`${viewport.name}: console/page errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
    }
    if (httpErrors.length > 0) {
      failures.push(`${viewport.name}: HTTP errors: ${httpErrors.slice(0, 5).join(" | ")}`);
    }

    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error("Route QA failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Route QA passed for ${routes.length} routes on ${viewports.length} viewport(s).`);

async function closeBlockingDialogs(page) {
  const confirm = page.getByRole("button", { name: /Подтвердить|Confirm|Растау/ }).first();
  if (await confirm.count()) {
    await confirm.click({ timeout: 2_000 }).catch(() => undefined);
  }

  const acceptCookies = page.getByRole("button", { name: /Принять|Accept|Қабылдау/ }).first();
  if (await acceptCookies.count()) {
    await acceptCookies.click({ timeout: 2_000 }).catch(() => undefined);
  }
}

function isExpectedConsoleError(text) {
  return text.includes("Failed to load resource") && text.includes("401 (Unauthorized)");
}

function isExpectedHttpError(response) {
  if (response.status() !== 401) return false;
  try {
    const url = new URL(response.url());
    return url.pathname === "/auth/me";
  } catch {
    return false;
  }
}
