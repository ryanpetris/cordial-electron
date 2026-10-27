// The Cordial serial API: protobuf messages generated from
// Cordial release schemas and the frame encoding used on the USB serial port.
export * from "./gen/cordial_pb.ts";
export * as storageV1 from "./gen/storage/v1/storage_pb.ts";
export * as storageV2 from "./gen/storage/v2/storage_pb.ts";
export * from "./framing.ts";
export * from "./handshake.ts";
export * from "./current.ts";
export * from "./limits.ts";

/** USB vendor ID of every Dongle (pid.codes). */
export const USB_VENDOR_ID = 0x1209;
/** USB product ID of every Dongle. */
export const USB_PRODUCT_ID = 0xc0d1;
