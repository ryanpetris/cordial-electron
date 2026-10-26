import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { expect, it } from "vitest";
import { storageV1, storageV2 } from "../src/index.ts";

it("generates both storage schemas and preserves the v1 sequence header collision", () => {
  const root = toBinary(storageV1.FormatSchema, create(storageV1.FormatSchema, { format: 1, initialized: true }));
  const sequence = toBinary(storageV1.SequenceSchema, create(storageV1.SequenceSchema, { nextDevice: 2n, nextProfile: 1n }));
  expect([...root]).toEqual([8, 1, 16, 1]);
  expect([...sequence]).toEqual([8, 2, 16, 1]);
  expect(fromBinary(storageV1.SequenceSchema, sequence).nextDevice).toBe(2n);
  expect([...toBinary(storageV2.SequenceSchema, create(storageV2.SequenceSchema, { format: 2, nextDevice: 2n, nextProfile: 1n }))]).toEqual([8, 2, 16, 2, 24, 1]);
});

it("preserves the completed v2 sequence collision with a loose v1 decode", () => {
  const bytes = new Uint8Array([0x08, 0x02, 0x10, 0x05, 0x18, 0x07]);
  const completed = fromBinary(storageV2.SequenceSchema, bytes);
  expect(completed.format).toBe(2);
  expect(completed.nextDevice).toBe(5n);
  expect(completed.nextProfile).toBe(7n);
  const loose = fromBinary(storageV1.SequenceSchema, bytes);
  expect(loose.nextDevice).toBe(2n);
  expect(loose.nextProfile).toBe(5n);
  // Ignoring unknown outer tag 3 changes the IDs, so decode success cannot classify a file.
  expect(toBinary(storageV1.SequenceSchema, loose, { writeUnknownFields: false })).not.toEqual(bytes);
});
