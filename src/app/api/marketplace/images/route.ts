import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorToResponse, requireUser } from "@/lib/auth/rbac";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB per image
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES_PER_PRODUCT = 8;

// POST /api/marketplace/images — multipart upload, field "files" (multiple allowed)
// and "productKey" identifying which marketplace product the images belong to.
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const form = await request.formData();
    const productKey = String(form.get("productKey") ?? "").trim();
    if (!productKey) {
      return NextResponse.json(
        { error: "productKey is required" },
        { status: 400 },
      );
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No image files received" },
        { status: 400 },
      );
    }

    const existing = await prisma.marketProductImage.count({ where: { productKey } });
    if (existing + files.length > MAX_IMAGES_PER_PRODUCT) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_PRODUCT} images per product` },
        { status: 400 },
      );
    }

    const created = [];
    let sortOrder = existing;
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Unsupported image type: ${file.type}. Use JPEG, PNG or WebP.` },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `${file.name} is larger than 4 MB` },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      created.push(
        await prisma.marketProductImage.create({
          data: {
            productKey,
            mimeType: file.type,
            data: buffer,
            sortOrder,
            uploadedBy: user.id,
          },
          select: { id: true, productKey: true, mimeType: true, sortOrder: true },
        }),
      );
      sortOrder += 1;
    }

    return NextResponse.json({ images: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json(errorToResponse(e).body, { status: errorToResponse(e).status });
  }
}

// GET /api/marketplace/images?productKey=... — list image metadata for a product
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productKey = url.searchParams.get("productKey")?.trim();
    if (!productKey) {
      return NextResponse.json(
        { error: "productKey is required" },
        { status: 400 },
      );
    }
    const images = await prisma.marketProductImage.findMany({
      where: { productKey },
      select: { id: true, productKey: true, mimeType: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ images });
  } catch (e) {
    return NextResponse.json(errorToResponse(e).body, { status: errorToResponse(e).status });
  }
}
