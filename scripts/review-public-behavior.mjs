import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("@playwright/test");
const output = path.join(root, "frontend/artifacts/final-public-review");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const layoutOnly = process.argv.includes("--layout-only");
  for (const width of layoutOnly ? [320, 1440] : [320, 390, 768, 930, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 720 : 900 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) =>
      route.request().url().startsWith("http://localhost:4200/")
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:4200/", {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.locator("p-galleria img").waitFor();
    await page.evaluate(async () => {
      for (const image of document.images) image.loading = "eager";
      await Promise.all(
        [...document.images].map((image) => image.decode().catch(() => {})),
      );
    });
    const item = {
      width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      header: [],
    };
    if (width === 320)
      item.overflowElements = await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
          .filter(
            (el) =>
              !el.closest(".ministerios-container-list") &&
              el.getBoundingClientRect().right > innerWidth + 1,
          )
          .map((el) => ({
            tag: el.tagName,
            class: el.className,
            left: el.getBoundingClientRect().left,
            right: el.getBoundingClientRect().right,
            width: el.getBoundingClientRect().width,
          }))
          .slice(0, 10),
      );
    for (const y of [0, 80, 81, 0]) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(150);
      item.header.push(
        await page.evaluate(() => {
          const nav = document.querySelector(".nav-main");
          return {
            y: scrollY,
            color: getComputedStyle(nav).backgroundColor,
            scrolled: nav.classList.contains("scroll"),
            logoWidth: document
              .querySelector(".nav-main .icon")
              .getBoundingClientRect().width,
          };
        }),
      );
    }
    if (width < 930) await page.locator("#menu-btn").click();
    await page.getByRole("link", { name: "Contacto", exact: true }).click();
    await page.waitForTimeout(250);
    item.anchor = await page.evaluate(() => ({
      headerBottom: document.querySelector(".nav-main").getBoundingClientRect()
        .bottom,
      titleTop: document
        .querySelector("#contact-heading")
        .getBoundingClientRect().top,
    }));
    const card = page.locator(".horarios .card").first();
    const toggle = card.locator("button");
    await toggle.click();
    await toggle.click();
    await page.waitForTimeout(100);
    item.closedCard = await card.evaluate((el) => ({
      expanded: el.querySelector("button").getAttribute("aria-expanded"),
      front: getComputedStyle(el.querySelector(".front")).transform,
      backHidden: el.querySelector(".back").getAttribute("aria-hidden"),
    }));
    await page.goto("http://localhost:4200/contacto", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.waitForTimeout(100);
    item.invalidFocus = await page.evaluate(() => document.activeElement?.id);
    if (width === 1440 && !layoutOnly) {
      let blocked;
      await page.route("https://api.emailjs.com/**", (route) => {
        blocked = route;
      });
      await page
        .getByLabel("Nombre", { exact: true })
        .fill("Persona de prueba");
      await page
        .getByLabel("Correo", { exact: true })
        .fill("prueba@example.org");
      await page
        .getByLabel("Asunto", { exact: true })
        .fill("Solicitud simulada");
      await page
        .getByLabel("Contenido", { exact: true })
        .fill("Revision local sin correo real.");
      await page.getByRole("button", { name: "Enviar", exact: true }).click();
      await page.waitForTimeout(16000);
      item.timeout = {
        blocked: !!blocked,
        status: await page.getByRole("status").innerText(),
        enabled: await page.getByLabel("Nombre", { exact: true }).isEnabled(),
        retained: await page.getByLabel("Nombre", { exact: true }).inputValue(),
      };
      await blocked?.abort().catch(() => {});
    }
    await page.goto("http://localhost:4200/ruta-inexistente", {
      waitUntil: "networkidle",
    });
    item.notFound = {
      title: await page.locator("main h1").innerText(),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      headerColor: await page
        .locator(".nav-main")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    };
    await page.screenshot({
      path: path.join(output, `${width}-404.png`),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Volver al inicio", exact: true })
      .click();
    await page.waitForTimeout(100);
    item.returnUrl = page.url();
    item.errors = errors;
    results.push(item);
    await context.close();
  }
  writeFileSync(
    path.join(output, "behavior.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
