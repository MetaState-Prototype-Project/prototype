import type { NextConfig } from "next";
import path from "path";
import { readFileSync, existsSync } from "fs";

// Read NEXT_PUBLIC_CALENDAR_API_URL from monorepo root .env so client bundle gets it (Next loads project .env first, so process.env can be wrong)
function getRootEnv(name: string): string | undefined {
  const rootEnv = path.resolve(__dirname, "../../.env");
  if (!existsSync(rootEnv)) return undefined;
  const content = readFileSync(rootEnv, "utf-8");
  const match = new RegExp(`^${name}\\s*=\\s*(.+)$`, "m").exec(content);
  if (!match) return undefined;
  const raw = match[1].replace(/^["']|["']$/g, "").trim();
  const comment = raw.indexOf(" #");
  return comment >= 0 ? raw.slice(0, comment).trim() : raw;
}

const calendarApiUrl =
  getRootEnv("NEXT_PUBLIC_CALENDAR_API_URL") ??
  process.env.NEXT_PUBLIC_CALENDAR_API_URL ??
  "http://localhost:4001";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CALENDAR_API_URL: calendarApiUrl,
  },
};

export default nextConfig;
