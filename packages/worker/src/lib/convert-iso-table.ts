import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { load } from "cheerio";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultInput = path.join(__dirname, "ISO-codes-table.html");
const defaultOutput = path.join(__dirname, "ISO-codes-table.csv");

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const csvEscape = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const toCsvLine = (values: string[]): string => values.map(csvEscape).join(",");

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutput;

  const html = await readFile(inputPath, "utf8");
  const $ = load(html);

  const headers = $("table thead th")
    .toArray()
    .map((cell) => normalizeText($(cell).text()));

  if (!headers.length) {
    throw new Error("No table headers found in HTML input.");
  }

  const rows = $("table tbody tr")
    .toArray()
    .map((row) =>
      $(row)
        .find("td")
        .toArray()
        .map((cell) => normalizeText($(cell).text())),
    )
    .filter((row) => row.length === headers.length);

  const csv = [toCsvLine(headers), ...rows.map((row) => toCsvLine(row))].join("\n") + "\n";

  // Parse once to verify the CSV is well-formed and column counts are consistent.
  parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: false });

  await writeFile(outputPath, csv, "utf8");

  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
