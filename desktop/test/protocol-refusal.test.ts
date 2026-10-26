import { CURRENT_PROTOCOL_VERSION } from "@cordial/protocol";
import { describe, expect, it, vi } from "vitest";
import { FakeAdapter } from "../src/fake/adapter.ts";
import { REFUSALS } from "../src/shared/text.ts";
import { controller, until } from "./helpers.ts";

// Model a host on revision 2 so revision 1 remains a valid older handshake.
vi.mock("@cordial/protocol", async (original) => ({
  ...await original<typeof import("@cordial/protocol")>(),
  CURRENT_PROTOCOL_VERSION: 2,
}));

describe.each([
  { revision: "older", version: CURRENT_PROTOCOL_VERSION - 1, message: REFUSALS.unsupported },
  { revision: "newer", version: CURRENT_PROTOCOL_VERSION + 1, message: REFUSALS.newer },
])("an adapter on a $revision protocol", ({ version, message }) => {
  it("is listed as refused with what its hello reported, and receives no requests", async () => {
    const fake = new FakeAdapter({ adapterId: "AAAA0001" });
    fake.protocolVersion = version;
    const { c, deps } = controller({ "/a": fake });
    const close = vi.spyOn(fake, "close");
    try {
      await c.manager.rescan();
      await until(() => c.manager.refused.size === 1);
      expect(fake.hellos).toBe(1);
      expect(fake.received).toEqual([]);
      expect(close).toHaveBeenCalledOnce();
      expect(c.manager.connected.size).toBe(0);
      expect(c.state().adapters).toMatchObject([{
        id: "port:/a",
        name: fake.name,
        connection: "disconnected",
        connectError: message,
        status: null,
        refused: { firmwareVersion: "0.0.0-dev", serialNumber: fake.id },
      }]);
      expect(deps.log).toHaveBeenCalledWith(`/a: ${message}`);
    } finally {
      await c.stop();
    }
  });

  it("stays listed without a name, firmware version or serial number", async () => {
    const fake = new FakeAdapter();
    fake.protocolVersion = version;
    fake.helloMetadata = false;
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.manager.refused.size === 1);
      expect(c.state().adapters).toMatchObject([{ id: "port:/a", name: "Adapter", connectError: message, refused: { firmwareVersion: null, serialNumber: null } }]);
    } finally {
      await c.stop();
    }
  });

  it.each([
    { firmware: "1.2\u2066.3", serial: "SER\u202eIAL\u0000", expected: { firmwareVersion: "1.2.3", serialNumber: "SERIAL" } },
    { firmware: "\u202e\u0000", serial: "\u2066\n", expected: { firmwareVersion: null, serialNumber: null } },
  ])("cleans refused metadata for display without changing identity: $serial", async ({ firmware, serial, expected }) => {
    const fake = new FakeAdapter();
    fake.protocolVersion = version;
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.manager.refused.size === 1);
      const hello = c.manager.refused.get("/a")!.hello;
      hello.firmwareVersion = firmware;
      hello.serialNumber = serial;
      expect(c.state().adapters[0]!.refused).toEqual(expected);
      expect(hello.serialNumber).toBe(serial);
    } finally {
      await c.stop();
    }
  });

  it("shows only what the adapter now on its port reports", async () => {
    const first = new FakeAdapter({ adapterId: "AAAA0001" });
    first.protocolVersion = version;
    const second = new FakeAdapter({ adapterId: "BBBB0002" });
    second.protocolVersion = version;
    second.helloMetadata = false;
    const { c, deps } = controller({ "/a": first });
    try {
      await c.manager.rescan();
      await until(() => c.manager.refused.size === 1);
      deps.ports["/a"] = second;
      expect(await c.manager.connect("port:/a")).toBe(message);
      expect(c.state().adapters).toMatchObject([{ id: "port:/a", name: "Adapter", refused: { firmwareVersion: null, serialNumber: null } }]);

      // An adapter on the current protocol is known by its own status.
      deps.ports["/a"] = first;
      first.protocolVersion = CURRENT_PROTOCOL_VERSION;
      expect(await c.manager.connect("port:/a")).toBeNull();
      await until(() => c.manager.connected.get(first.id)?.session.available === true);
      expect(c.state().adapters.map((a) => a.id)).toEqual([first.id]);
    } finally {
      await c.stop();
    }
  });

  it("isn't opened again until a refresh or Connect, and leaves the list when unplugged", async () => {
    const fake = new FakeAdapter();
    fake.protocolVersion = version;
    const { c, deps, ports } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.manager.refused.size === 1);
      for (let i = 0; i < 5; i++) await c.manager.rescan();
      expect(ports.opened).toBe(1);

      // A refresh or a hotplug event opens it once, however many rescans follow.
      vi.useFakeTimers();
      c.manager.burst();
      await vi.advanceTimersByTimeAsync(3100);
      vi.useRealTimers();
      await until(() => c.manager.refused.get("/a")?.retry === false && ports.opened === 2);
      await c.manager.rescan();
      expect(ports.opened).toBe(2);
      expect(c.state().adapters).toHaveLength(1);

      expect(await c.manager.connect("port:/a")).toBe(message);
      expect(ports.opened).toBe(3);

      fake.protocolVersion = CURRENT_PROTOCOL_VERSION;
      expect(await c.manager.connect("port:/a")).toBeNull();
      await until(() => c.manager.connected.get(fake.id)?.session.available === true);
      expect(c.manager.refused.size).toBe(0);
      expect(c.state().adapters.map((a) => [a.id, a.connection, a.connectError])).toEqual([[fake.id, "connected", null]]);

      fake.unplug();
      fake.protocolVersion = version;
      await until(() => c.manager.refused.size === 1);
      delete deps.ports["/a"];
      await c.manager.rescan();
      expect(c.state().adapters).toEqual([]);
    } finally {
      vi.useRealTimers();
      await c.stop();
    }
  });

  it("ends the recovery of a returning adapter that is now refused", async () => {
    const fake = new FakeAdapter();
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.manager.connected.get(fake.id)?.session.available === true);
      fake.protocolVersion = version;
      fake.unplug();
      await until(() => c.manager.refused.size === 1);
      expect(c.manager.connected.size).toBe(0);
      expect(c.state().adapters.map((a) => a.id)).toEqual(["port:/a"]);
    } finally {
      await c.stop();
    }
  });

  it.each(["disconnect", "expiry"])("keeps the correct listing when its recovery handshake closes after %s", async (end) => {
    const fake = new FakeAdapter();
    const returning = new FakeAdapter({ adapterId: fake.id });
    returning.protocolVersion = version;
    const { c, deps, ports } = controller({ "/a": fake });
    const closing = Promise.withResolvers<void>();
    const close = returning.close.bind(returning);
    const delayedClose = vi.spyOn(returning, "close").mockImplementation(async () => {
      await closing.promise;
      await close();
    });
    try {
      await c.manager.rescan();
      await until(() => c.manager.connected.get(fake.id)?.session.available === true);
      vi.useFakeTimers();
      fake.unplug();
      deps.ports["/a"] = returning;
      await vi.advanceTimersByTimeAsync(0);
      await c.manager.rescan();
      await vi.advanceTimersByTimeAsync(0);
      expect(delayedClose).toHaveBeenCalledOnce();
      expect(returning.hellos).toBe(1);
      expect(c.state().adapters[0]!.connection).toBe("reconnecting");

      if (end === "disconnect") await c.manager.disconnect(fake.id);
      else {
        await vi.advanceTimersByTimeAsync(15001);
        expect(c.state().adapters).toEqual([]);
      }
      closing.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(c.manager.connected.size).toBe(0);
      if (end === "disconnect") {
        expect(c.manager.refused.size).toBe(0);
        expect(c.state().adapters).toMatchObject([{ id: fake.id, connection: "disconnected", connectError: null }]);
      } else {
        expect(c.manager.refused.size).toBe(1);
        expect(c.state().adapters).toMatchObject([{ id: "port:/a", connection: "disconnected", connectError: message }]);
      }
      expect(c.state().adapters).toHaveLength(1);
      expect(delayedClose).toHaveBeenCalledOnce();
      expect(returning.received).toEqual([]);
      expect(ports.opened).toBe(2);
    } finally {
      closing.resolve();
      await c.stop();
      expect(vi.getTimerCount()).toBe(0);
      vi.useRealTimers();
    }
  });

  it("explains why a disconnected adapter can't connect again", async () => {
    const fake = new FakeAdapter();
    const { c } = controller({ "/a": fake });
    try {
      await c.manager.rescan();
      await until(() => c.manager.connected.get(fake.id)?.session.available === true);
      await c.manager.disconnect(fake.id);
      fake.protocolVersion = version;
      expect(await c.manager.connect(fake.id)).toBe(message);
      expect(c.state().adapters).toMatchObject([{ id: fake.id, connection: "disconnected", connectError: message }]);
      expect(fake.received).toEqual([]);
    } finally {
      await c.stop();
    }
  });

});
