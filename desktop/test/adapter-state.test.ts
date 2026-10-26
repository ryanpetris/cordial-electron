import { ErrorCode, ErrorOutcome, ErrorReason } from "@cordial/protocol";
import { describe, expect, it } from "vitest";
import { FakeAdapter, device } from "../src/fake/adapter.ts";
import { isAction } from "../src/core/actions.ts";
import type { Action } from "../src/shared/state.ts";
import { codeText } from "../src/shared/text.ts";
import { controller, until } from "./helpers.ts";

const commands = (fake: FakeAdapter) => fake.received.map((r) => r.command.case);

describe("adapter readiness", () => {
  it.each([
    { storageFormat: null, targetStorageFormat: null },
    { storageFormat: 1, targetStorageFormat: 2 },
    { storageFormat: 7, targetStorageFormat: 9 },
  ])("configures a ready adapter with storage telemetry $storageFormat/$targetStorageFormat", async (information) => {
    const fake = new FakeAdapter({ devices: [device(1)] });
    Object.assign(fake, information);
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.state().devices[0]?.settingsAvailable === true);
      expect(c.state().adapters[0]).toMatchObject({ readiness: "ready", status: { information } });
      expect(commands(fake)).toEqual(["getStatus", "listDevices", "listProfiles", "listSettings"]);
      expect(await c.act({ type: "adapter.name", adapterId: fake.id, name: "Desk" })).toEqual({ ok: true });
      expect(fake.name).toBe("Desk");
    } finally {
      await c.stop();
    }
  });

  it.each([
    { code: ErrorCode.STORAGE_MIGRATION_REQUIRED, reason: ErrorReason.STORAGE, outcome: ErrorOutcome.NO_EFFECT },
    { code: ErrorCode.STORAGE_FAILED, reason: ErrorReason.STORAGE, outcome: ErrorOutcome.UNKNOWN },
    { code: ErrorCode.NOT_READY, reason: ErrorReason.RADIO, outcome: ErrorOutcome.NO_EFFECT },
  ])("keeps an unready adapter's error $code available without listing saved data", async (fault) => {
    const fake = new FakeAdapter({ ready: false });
    fake.faults = [fault];
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.state().adapters.length === 1);
      const error = c.state().adapters[0]!.status!.errors[0]!;
      expect(error).toMatchObject({ reason: fault.reason === ErrorReason.STORAGE ? "storage" : "radio" });
      expect(error.code).toBe(ErrorCode[fault.code]!.toLowerCase());
      expect(c.state().adapters[0]).toMatchObject({ connection: "connected", readiness: "waiting", attention: [] });
      expect(commands(fake)).toEqual(["getStatus"]);
      expect(c.state().devices).toEqual([]);
      expect(await c.act({ type: "adapter.settings", adapterId: fake.id, platform: "windows" })).toEqual({ ok: false, message: codeText("not_ready") });
      expect(commands(fake)).toEqual(["getStatus"]);
      fake.faults = [];
      fake.changeAdapter({ ready: true });
      await until(() => c.state().devices.every((d) => d.settingsAvailable) && c.state().adapters[0]?.readiness === "ready");
      expect(commands(fake)).toContain("listDevices");
    } finally {
      await c.stop();
    }
  });

  it("blocks configuration reads and writes after readiness is lost", async () => {
    const fake = new FakeAdapter({ devices: [device(1)] });
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.state().devices[0]?.settingsAvailable === true);
      fake.faults = [{ code: ErrorCode.STORAGE_FAILED, reason: ErrorReason.STORAGE }];
      fake.changeAdapter({ ready: false });
      await until(() => c.state().adapters[0]?.status?.ready === false);
      const sent = fake.received.length;
      const actions: Action[] = [
        { type: "adapter.name", adapterId: fake.id, name: "Desk" },
        { type: "adapter.settings", adapterId: fake.id, platform: "windows" },
        { type: "adapter.reload", adapterId: fake.id },
        { type: "devices.reload", adapterId: fake.id },
        { type: "profiles.page", adapterId: fake.id, page: "first" },
        { type: "profile.create", adapterId: fake.id, name: "Work" },
        { type: "device.reload", key: `${fake.id}/1` },
        { type: "scan.start", adapterId: fake.id },
        { type: "pair.start", adapterId: fake.id, candidateId: 1 },
      ];
      for (const action of actions) expect(await c.act(action)).toEqual({ ok: false, message: codeText("not_ready") });
      expect(fake.received.length).toBe(sent);
    } finally {
      await c.stop();
    }
  });
});

describe("adapter restart", () => {
  it.each([true, false])("reconnects after restarting an adapter with ready=$0", async (ready) => {
    const fake = new FakeAdapter({ ready, devices: [device(1)] });
    const { c, ports } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.state().adapters.length === 1 && (!ready || c.state().devices[0]?.settingsAvailable === true));
      const entry = c.manager.connected.get(fake.id)!;
      const action = { type: "adapter.restart", adapterId: fake.id } as const;
      expect(isAction(action)).toBe(true);
      expect(await c.act(action)).toEqual({ ok: true });
      await until(() => fake.restarts === 1 && ports.opened === 2 && !entry.session.closed);
      expect(c.manager.connected.get(fake.id)).toBe(entry);
      if (ready) await until(() => entry.session.available);
      expect(c.state().adapters[0]).toMatchObject({ connection: "connected", readiness: ready ? "ready" : "waiting" });
      expect(commands(fake)).toContain("getStatus");
      if (!ready) expect(commands(fake)).toEqual(["getStatus"]);
    } finally {
      await c.stop();
    }
  });
});

describe("adapter shutdown", () => {
  it("waits for a stalled handshake's stream to close", async () => {
    const fake = new FakeAdapter();
    const { c, ports } = controller({ "/a": fake });
    const release = fake.hold();
    const closed = Promise.withResolvers<void>();
    let closing = false;
    ports.open = async () => {
      const stream = fake.open();
      return {
        onData: (listener) => stream.onData(listener),
        onClose: (listener) => stream.onClose(listener),
        write: (bytes) => stream.write(bytes),
        close: async () => {
          closing = true;
          await closed.promise;
          await stream.close();
        },
      };
    };
    let stopped = false;
    try {
      await c.manager.rescan();
      await until(() => fake.hellos === 1);
      const stopping = c.stop().then(() => { stopped = true; });
      await until(() => closing);
      expect(stopped).toBe(false);
      closed.resolve();
      await stopping;
      release();
      expect(c.manager.connected.size).toBe(0);
      expect(fake.received).toEqual([]);
    } finally {
      closed.resolve();
      release();
      await c.stop();
    }
  });
});
