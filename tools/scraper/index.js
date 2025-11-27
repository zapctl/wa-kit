import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_DEBUG = process.env.NODE_ENV === "development";
const OUT_DIR = process.env.OUT_DIR || "./out";

const VERSION_PATH = path.join(OUT_DIR, ".version");
const CHECKSUM_PATH = path.join(OUT_DIR, ".checksum");
const UTILS_SCRIPT_PATH = path.join(__dirname, "inject/utils.js");

const SCRAPERS = [
    { name: "version", type: "json", outputPath: "version.json" },
    { name: "main", type: "json", outputPath: "main.json" },
    { name: "binary", type: "json", outputPath: "binary.json" },
    { name: "jid", type: "json", outputPath: "jid.json" },
    { name: "message", type: "json", outputPath: "message.json" },
    { name: "protobuf", type: "multi-file", outputDir: "protobuf", extension: ".proto" },
    { name: "graphql", type: "multi-json", outputDir: "graphql", extension: ".json" },
];

const browser = await puppeteer.launch({
    headless: !IS_DEBUG,
    devtools: IS_DEBUG,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const [page] = await browser.pages();

await page.setUserAgent((await browser.userAgent())
    .replace("HeadlessChrome", "Chrome"));

await page.goto("https://web.whatsapp.com/", {
    waitUntil: "networkidle2",
});

const utilsScriptContent = await fs.readFile(UTILS_SCRIPT_PATH, "utf8");
await page.evaluate(utilsScriptContent);

const results = {};

for (const scraper of SCRAPERS) {
    const scriptPath = path.join(__dirname, "inject", `${scraper.name}.js`);
    const scriptContent = await fs.readFile(scriptPath, "utf8");
    const scriptFunction = new Function("scrap", scriptContent);

    results[scraper.name] = await page.evaluate(scriptFunction);
}

if (!IS_DEBUG) await browser.close();

await fs.rm(OUT_DIR, { recursive: true }).catch(() => { });
await fs.mkdir(OUT_DIR);

const globalHash = createHash("sha256");

for (const scraper of SCRAPERS) {
    const data = results[scraper.name];

    const outputPath = scraper.outputPath ? path.join(OUT_DIR, scraper.outputPath) : null;
    const outputDir = scraper.outputDir ? path.join(OUT_DIR, scraper.outputDir) : null;
    const targetDir = outputDir ?? path.dirname(outputPath);

    await fs.mkdir(targetDir, { recursive: true });

    if (scraper.type === "text") {
        await fs.writeFile(outputPath, data);
        globalHash.update(data);
    } else if (scraper.type === "json") {
        const content = JSON.stringify(data, null, 2);
        await fs.writeFile(outputPath, content);

        if (scraper.name === "version") {
            await fs.writeFile(VERSION_PATH, data.constants.VERSION);
            continue;
        }

        globalHash.update(content);
    } else if (scraper.type === "multi-file") {
        const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
        await Promise.all(entries.map(([name, content]) => {
            const filePath = path.join(outputDir, `${name}${scraper.extension}`);
            globalHash.update(content);
            return fs.writeFile(filePath, content);
        }));
    } else if (scraper.type === "multi-json") {
        const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
        await Promise.all(entries.map(([name, content]) => {
            const filePath = path.join(outputDir, `${name}${scraper.extension}`);
            const jsonContent = JSON.stringify(content, null, 2);
            globalHash.update(jsonContent);
            return fs.writeFile(filePath, jsonContent);
        }));
    }
}

const checksum = globalHash.digest("hex");
await fs.writeFile(CHECKSUM_PATH, checksum);