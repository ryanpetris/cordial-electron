import { copyFileSync, writeFileSync } from "node:fs";
import { build, Platform } from "electron-builder";
import { version } from "./version.mjs";

const release = version();
copyFileSync("../THIRD_PARTY_NOTICES.txt", "out/main/THIRD_PARTY_NOTICES.txt");
writeFileSync("out/VERSION", `${release}\n`);
await build({
  targets: Platform.current().createTarget(process.argv.slice(2)),
  config: { extraMetadata: { version: release } },
  publish: "never",
});
