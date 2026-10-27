import { writeFileSync } from "node:fs";
import { Arch, build, Platform } from "electron-builder";
import { version } from "./version.mjs";

const release = version();
writeFileSync("out/VERSION", `${release}\n`);
await build({
  targets: Platform.current().createTarget(process.argv.slice(2), ...(process.platform === "darwin" ? [Arch.arm64] : [])),
  config: { extraMetadata: { version: release } },
  publish: "never",
});
