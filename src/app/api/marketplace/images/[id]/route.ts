import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorToResponse, requireUser } from "@/lib/auth/rbac";

// GET /api/marketplace/images/[id] — serve raw image bytes
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const image = await prisma.marketProductImage.findUnique({ where: { id } });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    const body = new Uint8Array(image.data);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (e) {
    const r = errorToResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}

// DELETE /api/marketplace/images/[id] — remove an uploaded image
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const { id } = await params;
    const image = await prisma.marketProductImage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    await prisma.marketProductImage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = errorToResponse(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
