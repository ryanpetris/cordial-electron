import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { fromBinary } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";
import { fingerprint } from "../scripts/fingerprint.mjs";
import { buf } from "../scripts/buf.mjs";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

it("generates current and imported schemas and rejects mismatched upstream fingerprints", () => {
  const temporary = mkdtempSync(join(tmpdir(), "cordial-generation-"));
  const source = join(temporary, "source");
  const output = join(temporary, "output");
  const proto = join(source, "proto");
  function write(path: string, content: string) {
    const file = join(source, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const generate = () => execFileSync(process.execPath, [join(packageRoot, "scripts/generate.mjs"), source, output], {
    stdio: "pipe",
  });
  function recordDigest(version: number) {
    const descriptors = fromBinary(FileDescriptorSetSchema, buf([
      "build", proto, "--path", join(proto, `serial/v${version}/cordial.proto`),
      "--as-file-descriptor-set", "--config", join(source, "buf.yaml"), "-o", "-",
    ]));
    write(`proto/serial/v${version}/schema.sha256`, fingerprint(descriptors) + "\n");
  }
  try {
    symlinkSync(join(packageRoot, "../../node_modules"), join(temporary, "node_modules"), "junction");
    write("buf.yaml", "version: v2\nlint:\n  use: [MINIMAL]\n  except: [PACKAGE_DIRECTORY_MATCH, DIRECTORY_SAME_PACKAGE]\n");
    write("proto/serial/current", "2\n");
    write("proto/handshake.proto", 'syntax = "proto3"; package fixture.handshake; message Hello { optional string name = 1; }');
    write("proto/migration.proto", 'syntax = "proto3"; package fixture.migration; message Start { string adapter_id = 1; }');
    for (const version of [1, 2, 3]) {
      write(`proto/storage/v${version}/storage.proto`, `syntax = "proto3"; package fixture.storage.v${version}; message Sequence { uint64 next_device = 1; }`);
    }
    write("proto/serial/v1/cordial.proto", 'syntax = "proto3"; package fixture.serial.v1; message Request { uint32 id = 1; }');
    const imported = 'syntax = "proto3"; package fixture.shared; message Value { uint32 value = 1; }';
    write("proto/shared/common.proto", imported);
    write("proto/serial/v2/cordial.proto", 'syntax = "proto3"; package fixture.serial.v2; import "shared/common.proto"; message Request { fixture.shared.Value value = 1; }');
    recordDigest(1);
    recordDigest(2);
    generate();
    expect(readFileSync(join(output, "src/gen/serial/v2/cordial_pb.ts"), "utf8")).toContain('"../../shared/common_pb.ts"');
    expect(existsSync(join(output, "src/gen/serial/v1"))).toBe(false);
    for (const path of ["handshake_pb.ts", "migration_pb.ts", "shared/common_pb.ts", "storage/v1/storage_pb.ts", "storage/v2/storage_pb.ts", "storage/v3/storage_pb.ts"]) {
      expect(existsSync(join(output, "src/gen", path))).toBe(true);
    }
    expect(readFileSync(join(output, "src/gen/cordial_pb.ts"), "utf8")).toContain('"./serial/v2/cordial_pb.ts"');
    execFileSync(process.execPath, [join(packageRoot, "../../node_modules/typescript/bin/tsc"),
      "--noEmit", "--allowImportingTsExtensions", "--target", "ESNext", "--module", "ESNext",
      "--moduleResolution", "Bundler", "--skipLibCheck", join(output, "src/gen/cordial_pb.ts"),
      join(output, "src/gen/migration_pb.ts"), join(output, "src/gen/storage/v3/storage_pb.ts"),
    ], { cwd: temporary, stdio: "pipe" });

    const current = readFileSync(join(output, "src/current.ts"), "utf8");
    const historical = readFileSync(join(proto, "serial/v1/schema.sha256"), "utf8");
    write("proto/serial/v1/schema.sha256", "invalid\n");
    expect(() => generate()).toThrow(/fingerprint does not match/);
    expect(readFileSync(join(proto, "serial/v1/schema.sha256"), "utf8")).toBe("invalid\n");
    expect(readFileSync(join(output, "src/current.ts"), "utf8")).toBe(current);
    write("proto/serial/v1/schema.sha256", historical);
    write("proto/shared/common.proto", imported.replace("uint32 value", "string value"));
    expect(() => generate()).toThrow(/fingerprint does not match/);
    recordDigest(2);
    generate();
    expect(readFileSync(join(output, "src/current.ts"), "utf8")).not.toBe(current);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 20_000);
