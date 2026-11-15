import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { sniffImageType } from "@/lib/image-sniff";

const MAX_SIZE = 5 * 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reject oversized bodies before buffering them (multipart overhead allowance).
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not file.type (F-13). Extension comes from the sniff too.
  const extension = sniffImageType(buffer);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${extension}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return NextResponse.json({ path: `/uploads/${filename}` });
}
