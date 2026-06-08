import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";

export async function prepareYoutubeCookiesFile(): Promise<string | null> {
  const cookiesBase64 = process.env.YOUTUBE_COOKIES_BASE64;

  if (!cookiesBase64) {
    return null;
  }

  const tmpDir = env.TMP_DIR || "/tmp";
  const cookiesPath = path.join(tmpDir, "youtube-cookies.txt");

  await fs.mkdir(tmpDir, { recursive: true });

  const cookiesContent = Buffer.from(cookiesBase64, "base64").toString("utf8");

  await fs.writeFile(cookiesPath, cookiesContent, {
    encoding: "utf8",
    mode: 0o600
  });

  return cookiesPath;
}