"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE_URL = "https://www.vmix.com/help29/ShortcutFunctionReference.html";
const OUTPUT_PATH = path.join(__dirname, "..", "public", "vmix-shortcuts.json");

function decodeHtml(input) {
  if (!input) return "";
  return String(input)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (match, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    });
}

function stripHtml(input) {
  return decodeHtml(
    String(input || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[\t\r]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ ]{2,}/g, " "),
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseParamKeys(parametersText) {
  const raw = String(parametersText || "").trim();
  if (!raw || /^none$/i.test(raw)) return [];

  const keys = [];
  const pieces = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const piece of pieces) {
    const token = piece.match(/[A-Za-z][A-Za-z0-9]*/)?.[0];
    if (!token) continue;
    if (!keys.includes(token)) keys.push(token);
  }
  return keys;
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const table = html.match(/<table[^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) {
    throw new Error("Could not find shortcut function table in source page");
  }

  const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  let currentCategory = "General";
  const functions = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => m[1],
    );
    if (cells.length < 3) continue;

    const name = stripHtml(cells[0]);
    const description = stripHtml(cells[1]);
    const parameters = stripHtml(cells[2]);
    if (!name) continue;
    if (/^name$/i.test(name) && /^description$/i.test(description)) continue;

    const isCategory = /background-color\s*:\s*#ccffcc/i.test(row);
    if (isCategory) {
      currentCategory = name;
      continue;
    }

    functions.push({
      name,
      category: currentCategory,
      description,
      parameters,
      paramKeys: parseParamKeys(parameters),
    });
  }

  const categories = [];
  for (const fn of functions) {
    const current = categories.find((item) => item.name === fn.category);
    if (current) {
      current.count += 1;
    } else {
      categories.push({ name: fn.category, count: 1 });
    }
  }

  const output = {
    source: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    versionHint: "vMix help29",
    transitionsNote:
      "Transitions such as Fade, Zoom and Cut can also be used as Function values as documented by vMix.",
    totalFunctions: functions.length,
    categories,
    functions,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Functions: ${functions.length}`);
  console.log(`Categories: ${categories.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
