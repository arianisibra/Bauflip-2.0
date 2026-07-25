import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * DOCX→PDF via LibreOffice (headless), `soffice --convert-to pdf`. Braucht den
 * `soffice`-Befehl im PATH — lokal via `brew install --cask libreoffice`, auf
 * dem VPS via `apt-get install libreoffice-writer --no-install-recommends`.
 */
export class PdfConversionError extends Error {}

const SOFFICE_BIN = process.env.SOFFICE_BIN?.trim() || "soffice";
const CONVERT_TIMEOUT_MS = 30_000;

function runSoffice(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(SOFFICE_BIN, args, { timeout: CONVERT_TIMEOUT_MS });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      reject(
        new PdfConversionError(
          err.message.includes("ENOENT")
            ? "LibreOffice (soffice) ist auf dem Server nicht installiert."
            : err.message,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new PdfConversionError(`soffice beendete mit Code ${code}: ${stderr.slice(0, 500)}`));
      }
    });
  });
}

export async function convertDocxToPdf(docxBytes: Uint8Array): Promise<Buffer> {
  const dir = await mkdtemp(path.join(/* turbopackIgnore: true */ tmpdir(), "bauflip-docx2pdf-"));
  try {
    const inputPath = path.join(dir, "input.docx");
    await writeFile(inputPath, docxBytes);
    await runSoffice(["--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, inputPath]);
    return await readFile(path.join(dir, "input.pdf"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
