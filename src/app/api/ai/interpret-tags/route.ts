import { NextResponse } from "next/server";
import { parseTags } from "@/lib/tags";

export async function POST(req: Request) {
  try {
    const { tags } = (await req.json()) as { tags?: string[] };
    const list = Array.isArray(tags) ? tags : [];
    const interpreted = parseTags(list);
    const summary = interpreted.map((t) => t.label).join(" · ");

    return NextResponse.json({ interpreted, summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
