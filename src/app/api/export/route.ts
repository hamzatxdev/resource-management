import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { membersToExportSheet } from "@/lib/excel";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "xlsx";

    const docs = await TeamMemberModel.find().sort({ name: 1 }).lean();
    const members = docs.map((d) => docToPlain(d));

    if (format === "json") {
      return NextResponse.json({ members, exportedAt: new Date().toISOString() });
    }

    const buffer = membersToExportSheet(members);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="team-export-${Date.now()}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
