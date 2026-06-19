import * as XLSX from "xlsx";
import type { AiFlag, ProbationFlag, TeamMemberInput, WorkflowEntry } from "./types";

export interface ExcelRow {
  id: string;
  name: string;
  role: string;
  stackLabel: string;
  tags: string[];
  exp: string;
  skills: string[];
  email: string;
  projects: string[];
}

function parseList(value: unknown): string[] {
  if (!value) return [];
  const str = String(value)
    .replace(/\r\n/g, "\n")
    .trim();
  if (!str) return [];
  return str
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseExpNum(exp: string): number {
  const m = exp.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

export function parseExcelBuffer(buffer: Buffer): ExcelRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows
    .map((row) => {
      const id = String(
        row["Employee Code"] ?? row["id"] ?? row["ID"] ?? ""
      ).trim();
      if (!id) return null;

      const exp = String(row["Years of Experience"] ?? row["exp"] ?? "").trim();
      return {
        id,
        name: String(row["Employee Name"] ?? row["name"] ?? "").trim(),
        role: String(row["Current Role"] ?? row["role"] ?? "").trim(),
        stackLabel: String(row["Stack"] ?? row["stack"] ?? "").trim(),
        tags: parseList(row["Tags"] ?? row["tags"]),
        exp,
        skills: parseList(row["Skills"] ?? row["skills"]),
        email: String(row["Techverx Email"] ?? row["email"] ?? "").trim(),
        projects: parseList(row["Projects"] ?? row["projects"]),
      } satisfies ExcelRow;
    })
    .filter((r): r is ExcelRow => r != null);
}

export function excelRowToInput(row: ExcelRow): TeamMemberInput {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    exp: row.exp,
    expNum: parseExpNum(row.exp),
    skills: row.skills,
    email: row.email,
    stackLabel: row.stackLabel,
    tags: row.tags,
    projects: row.projects,
  };
}

export type ExportMemberRow = {
  id: string;
  name: string;
  role: string;
  stackLabel: string;
  tags: string[];
  exp: string;
  skills: string[];
  email: string;
  projects: string[];
  notes?: string;
  specialization: string;
  specializations: string[];
  aiRatings: Record<string, number>;
  ratingOverrides: Record<string, number>;
  nextSteps?: string;
  escalations?: WorkflowEntry[];
  aiFlags?: AiFlag;
  probation?: ProbationFlag;
};

export function membersToExportSheet(members: ExportMemberRow[]): Buffer {
  const data = members.map((m) => ({
    "Employee Code": m.id,
    "Employee Name": m.name,
    "Current Role": m.role,
    Stack: m.stackLabel,
    Tags: m.tags.join(", "),
    "Years of Experience": m.exp,
    Skills: m.skills.join(", "),
    "Techverx Email": m.email,
    Projects: m.projects.join(", "),
    Notes: m.notes ?? "",
    Specialization: m.specialization,
    Specializations: (m.specializations ?? [m.specialization]).join(", "),
    "AI Ratings": JSON.stringify(m.aiRatings),
    "Rating Overrides": JSON.stringify(m.ratingOverrides),
    "Next Steps": m.nextSteps ?? "",
    Escalations: (m.escalations ?? []).map((e) => e.text).join(" | "),
    "AI Flag": m.aiFlags?.flagged ? m.aiFlags.severity : "",
    "Flag Summary": m.aiFlags?.summary ?? "",
    Probation: m.probation?.active ? "yes" : "",
    "Probation Summary": m.probation?.summary ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Team");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
