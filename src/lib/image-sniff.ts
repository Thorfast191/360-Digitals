export type SniffedImage = "png" | "jpg" | "gif" | "webp";

/**
 * Identify an image by its magic bytes rather than the client-declared MIME
 * type, which is trivially spoofed (audit F-13).
 */
export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith([0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(ascii("GIF87a")) || startsWith(ascii("GIF89a"))) return "gif";
  if (startsWith(ascii("RIFF")) && startsWith(ascii("WEBP"), 8)) return "webp";
  return null;
}
