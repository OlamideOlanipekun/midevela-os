import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, DBFAQ, DBPolicy } from "@/lib/db";
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
  return NextResponse.json({
    faqs: db.faqs,
    policies: db.policies,
    documents: db.documents,
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type, question, answer, category, name, content } = body;

    const db = readDb();

    if (type === "policy") {
      if (!name || !content) {
        return NextResponse.json(
          { error: "Policy name and content are required." },
          { status: 400 }
        );
      }

      // Update existing policy or add new one
      const existingIdx = db.policies.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      const updatedPolicy: DBPolicy = {
        name,
        content,
        updatedAt: "Just now",
      };

      if (existingIdx > -1) {
        db.policies[existingIdx] = updatedPolicy;
      } else {
        db.policies = [updatedPolicy, ...db.policies];
      }

      writeDb(db);
      return NextResponse.json({ success: true, policy: updatedPolicy });
    } else {
      // Default: add FAQ
      if (!question || !answer) {
        return NextResponse.json(
          { error: "Question and answer are required." },
          { status: 400 }
        );
      }

      const newFaq: DBFAQ = {
        question,
        answer,
        category: category || "General",
        usageCount: 0,
      };

      db.faqs = [newFaq, ...db.faqs];
      writeDb(db);

      return NextResponse.json({ success: true, faq: newFaq });
    }
  } catch (err: any) {
    console.error("Knowledge API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const question = searchParams.get("question");

    if (!question) {
      return NextResponse.json({ error: "FAQ question is required." }, { status: 400 });
    }

    const db = readDb();
    const initialCount = db.faqs.length;
    db.faqs = db.faqs.filter((faq) => faq.question !== question);

    if (db.faqs.length === initialCount) {
      return NextResponse.json({ error: "FAQ not found." }, { status: 444 });
    }

    writeDb(db);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete FAQ API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
