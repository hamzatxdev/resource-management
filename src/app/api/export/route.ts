import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { membersToExportSheet } from "@/lib/excel";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";

function parseIdsParam(raw: string | null): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? ids : undefined;
}

async function loadMembersForExport(ids?: string[]) {
  await connectDB();
  const query = ids?.length ? { id: { $in: ids } } : {};
  const docs = await TeamMemberModel.find(query).lean();
  const members = docs.map((d) => docToPlain(d));
  if (ids?.length) {
    const order = new Map(ids.map((id, i) => [id, i]));
    members.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  } else {
    members.sort((a, b) => a.name.localeCompare(b.name));
  }
  return members;
}

async function exportResponse(
  members: Awaited<ReturnType<typeof loadMembersForExport>>,
  format: string
) {
  if (format === "json") {
    return NextResponse.json({
      members,
      count: members.length,
      exportedAt: new Date().toISOString(),
    });
  }

  const buffer = membersToExportSheet(members);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="team-export-${members.length}-rows-${Date.now()}.xlsx"`,
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "xlsx";
    const ids = parseIdsParam(searchParams.get("ids"));
    const members = await loadMembersForExport(ids);
    return exportResponse(members, format);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      format?: string;
      ids?: string[];
    };
    const format = body.format ?? "xlsx";
    const ids = Array.isArray(body.ids)
      ? body.ids.map((s) => String(s).trim()).filter(Boolean)
      : undefined;
    const members = await loadMembersForExport(ids);
    return exportResponse(members, format);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
