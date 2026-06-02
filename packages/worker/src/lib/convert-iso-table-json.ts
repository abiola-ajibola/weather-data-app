import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { load } from "cheerio";

type IsoRow = [string, string, string, string, string];

type IsoByAlpha2 = Record<
  string,
  {
    english_short_name: string;
    french_short_name: string;
    alpha_3_code: string;
    numeric: number;
  }
>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultHtmlInput = path.join(__dirname, "ISO-codes-table.html");
const defaultJsonOutput = path.join(__dirname, "ISO-codes-table.json");

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultHtmlInput;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultJsonOutput;

  const html = await readFile(inputPath, "utf8");
  const $ = load(html);

  const rows: IsoRow[] = $("table tbody tr")
    .toArray()
    .map((row) =>
      $(row)
        .find("td")
        .toArray()
        .map((cell) => normalizeText($(cell).text())),
    )
    .filter((values): values is IsoRow => values.length === 5);

  const json: IsoByAlpha2 = {};

  for (const row of rows) {
    const [englishShortName, frenchShortName, alpha2CodeRaw, alpha3CodeRaw, numericRaw] = row;
    const alpha2Code = normalizeText(alpha2CodeRaw || "");
    const alpha3Code = normalizeText(alpha3CodeRaw || "");
    const numeric = Number.parseInt(numericRaw, 10);

    if (!alpha2Code) {
      throw new Error("Found a row with an empty Alpha-2 code.");
    }

    if (!alpha3Code) {
      throw new Error(`Found a row with an empty Alpha-3 code for ${alpha2Code}.`);
    }

    if (!Number.isFinite(numeric)) {
      throw new Error(`Invalid numeric code for Alpha-2 code ${alpha2Code}: ${numericRaw}`);
    }

    json[alpha2Code] = {
      english_short_name: normalizeText(englishShortName || ""),
      french_short_name: normalizeText(frenchShortName || ""),
      alpha_3_code: alpha3Code,
      numeric,
    };
  }

  await writeFile(outputPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`Wrote ${Object.keys(json).length} items to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
