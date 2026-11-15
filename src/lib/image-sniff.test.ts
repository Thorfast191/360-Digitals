import { describe, expect, it } from "vitest";
import { sniffImageType } from "./image-sniff";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniffImageType (F-13)", () => {
  it("recognises the four allowed formats", () => {
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImageType(bytes("GIF89a", [1, 0]))).toBe("gif");
    expect(sniffImageType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("webp");
  });

  it("rejects HTML or SVG renamed and labelled as an image", () => {
    expect(sniffImageType(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it("rejects truncated input", () => {
    expect(sniffImageType(bytes([0x89, 0x50]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
