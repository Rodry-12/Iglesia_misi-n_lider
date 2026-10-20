import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReferenceServer } from "./preview-original.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("@playwright/test");
const server = createReferenceServer();
await new Promise((resolve) => server.listen(4301, "127.0.0.1", resolve));
const output = path.join(root, "frontend/artifacts/public-review");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      return /^http:\/\/(localhost:4200|127\.0\.0\.1:4301)/.test(url)
        ? route.continue()
        : route.abort();
    });
    await context.addInitScript(() => {
      const timeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) =>
        delay === 3000 ? 0 : timeout(callback, delay, ...args);
    });
    for (const [label, url] of [
      ["original", "http://127.0.0.1:4301/"],
      ["angular", "http://localhost:4200/"],
      ["donations", "http://localhost:4200/donar"],
      ["design", "http://localhost:4200/diseno"],
      ["access", "http://localhost:4200/acceso"],
      ["not-found", "http://localhost:4200/pagina-inexistente"],
      ["original-404", "http://127.0.0.1:4301/404.html"],
    ]) {
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(60000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const interaction = {};
      if (label === "angular") {
        const gallery = page.locator("p-galleria");
        await gallery.waitFor({ state: "attached" });
        interaction.gallery = await gallery.count();
        interaction.slides = [await gallery.locator("img").getAttribute("src")];
        await gallery
          .getByRole("button", { name: "Imagen siguiente", exact: true })
          .click();
        await page.waitForTimeout(100);
        interaction.slides.push(
          await gallery.locator("img").getAttribute("src"),
        );
        await page
          .getByRole("button", { name: "Mostrar imagen 3", exact: true })
          .click();
        await page.waitForTimeout(100);
        interaction.slides.push(
          await gallery.locator("img").getAttribute("src"),
        );
        await gallery
          .getByRole("button", { name: "Imagen anterior", exact: true })
          .click();
        await page.waitForTimeout(100);
        interaction.previous = await gallery.locator("img").getAttribute("src");
        await page
          .getByRole("button", { name: "Mostrar imagen 1", exact: true })
          .click();
        await page.waitForTimeout(100);
        if (name === "desktop") {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          await page
            .getByRole("button", { name: "Reanudar", exact: true })
            .click();
          await page.locator("main").focus();
          await page.mouse.move(1, 950);
          await page.waitForTimeout(3300);
          interaction.autoplay = await gallery
            .locator("img")
            .getAttribute("src");
          await page
            .getByRole("button", { name: "Mostrar imagen 1", exact: true })
            .focus();
          const before = await gallery.locator("img").getAttribute("src");
          await page.waitForTimeout(3300);
          interaction.focusPause = {
            before,
            after: await gallery.locator("img").getAttribute("src"),
          };
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page
            .getByRole("button", { name: "Mostrar imagen 1", exact: true })
            .click();
          await page.waitForTimeout(100);
        }
      }
      if (label === "design") {
        const input = page.locator("#site-name");
        interaction.light = await input.evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el).color,
        }));
        await page
          .getByRole("button", { name: "Tema oscuro", exact: true })
          .click();
        await page.waitForTimeout(100);
        interaction.dark = await input.evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el).color,
          theme: document.documentElement.dataset.theme,
        }));
        await page.screenshot({
          path: path.join(output, `${name}-design-dark.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page
          .getByRole("button", { name: "Tema claro", exact: true })
          .click();
        await page.waitForTimeout(100);
        interaction.table = await page.locator("p-table table").count();
      }
      await page.evaluate(async () => {
        for (const image of document.images) image.loading = "eager";
        await Promise.race([
          Promise.all(
            [...document.images].map((image) => image.decode().catch(() => {})),
          ),
          new Promise((resolve) => setTimeout(resolve, 10000)),
        ]);
        scrollTo(0, 0);
      });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(output, `${name}-${label}.png`),
        fullPage: true,
        animations: "disabled",
      });
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headings: [...document.querySelectorAll("h1,h2")].map((n) =>
          n.textContent.trim(),
        ),
        brokenImages: [...document.images]
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.src),
        footer: [
          ...(document
            .querySelector("footer")
            ?.querySelectorAll(".footer-logo,.redes-sociales,.info") ?? []),
        ].map((n) => ({
          x: Math.round(n.getBoundingClientRect().x),
          y: Math.round(n.getBoundingClientRect().y),
          width: Math.round(n.getBoundingClientRect().width),
        })),
      }));
      const layout = await page.evaluate(() =>
        [
          ".nav-main",
          "div.logo",
          ".nav-bar",
          ".ministerio-card",
          ".card .front",
          ".community h1",
        ].map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return { selector };
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            selector,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            position: style.position,
            transform: style.transform,
            fontWeight: style.fontWeight,
            display: style.display,
          };
        }),
      );
      results.push({
        viewport: name,
        page: label,
        ...metrics,
        layout,
        interaction,
        errors,
      });
      await page.close();
    }
    await context.close();
  }
  writeFileSync(
    path.join(output, "review.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify(
      results.map(
        ({
          viewport,
          page,
          width,
          scrollWidth,
          brokenImages,
          interaction,
          errors,
        }) => ({
          viewport,
          page,
          width,
          scrollWidth,
          brokenImages,
          interaction,
          errors,
        }),
      ),
    ),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
