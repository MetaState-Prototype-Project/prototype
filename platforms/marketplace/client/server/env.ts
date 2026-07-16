import path from "path";
import { config } from "dotenv";

// Load the repo-root .env so process.env is populated before any other module
// (e.g. ./aaas) reads it. Imported first in index.ts. At runtime this file is
// bundled into dist/index.js, so import.meta.dirname is client/dist; four levels
// up (dist → client → marketplace → platforms → repo root) is the shared .env.
// The same relative path holds in dev, where it runs from client/server.
config({ path: path.resolve(import.meta.dirname, "../../../../.env") });
