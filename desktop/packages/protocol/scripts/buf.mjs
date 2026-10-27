import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Run the package's Node entry point without relying on shell-specific npm shims.
export const buf = (args, options) => execFileSync(process.execPath, [
  fileURLToPath(import.meta.resolve("@bufbuild/buf/bin/buf")), ...args,
], options);
