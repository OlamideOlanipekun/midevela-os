import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, DBProduct } from "@/lib/db";
import { cookies } from "next/headers";

async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get("midevela_mock_auth")?.value === "true";
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = readDb();
  return NextResponse.json({ products: db.products });
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { name, price, category, stockStatus, description } = body;

    if (!name || !price) {
      return NextResponse.json(
        { error: "Product name and price are required." },
        { status: 400 }
      );
    }

    const db = readDb();
    
    // Map stock status to style classes
    const stockClass =
      stockStatus === "In Stock"
        ? "status-dot-green"
        : stockStatus === "Low Stock"
        ? "status-dot-gold"
        : "status-dot-red";

    // Deduce icon based on categories
    const lowerCategory = category.toLowerCase();
    const icon = lowerCategory.includes("fashion") || lowerCategory.includes("apparel")
      ? "🛍️"
      : lowerCategory.includes("beauty") || lowerCategory.includes("cosmetic")
      ? "🧴"
      : lowerCategory.includes("electronics")
      ? "💻"
      : "📦";

    // Format price currency string
    const formattedPrice = `₦${Number(price).toLocaleString()}`;

    const newProduct: DBProduct = {
      id: `prod-${Date.now()}`,
      name,
      price: formattedPrice,
      category: category || "General",
      stockStatus: stockStatus || "In Stock",
      stockClass,
      aiCompleteness: description && description.length > 50 ? 90 : 50,
      icon,
      description: description || "",
    };

    db.products = [newProduct, ...db.products];
    writeDb(db);

    return NextResponse.json({ success: true, product: newProduct });
  } catch (err: any) {
    console.error("Add Product API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { id, name, price, category, stockStatus, description } = body;

    if (!id || !name || !price) {
      return NextResponse.json({ error: "Product id, name, and price are required." }, { status: 400 });
    }

    const db = readDb();
    const index = db.products.findIndex((p) => p.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Product not found." }, { status: 444 });
    }

    const stockClass =
      stockStatus === "In Stock"
        ? "status-dot-green"
        : stockStatus === "Low Stock"
        ? "status-dot-gold"
        : "status-dot-red";

    const formattedPrice = price.toString().startsWith("₦") ? price : `₦${Number(price).toLocaleString()}`;

    db.products[index] = {
      ...db.products[index],
      name,
      price: formattedPrice,
      category: category || db.products[index].category,
      stockStatus: stockStatus || db.products[index].stockStatus,
      stockClass,
      aiCompleteness: description && description.length > 50 ? 90 : 50,
      description: description || "",
    };

    writeDb(db);
    return NextResponse.json({ success: true, product: db.products[index] });
  } catch (err: any) {
    console.error("Update Product API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }

    const db = readDb();
    const initialCount = db.products.length;
    db.products = db.products.filter((p) => p.id !== id);

    if (db.products.length === initialCount) {
      return NextResponse.json({ error: "Product not found." }, { status: 444 });
    }

    writeDb(db);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete Product API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
