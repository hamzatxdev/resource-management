import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { enrichMember, enrichWithEmbedding, parseExpNum } from "@/lib/memberService";
import { primarySpecialization } from "@/lib/specializations";
import { applyBulkOverrides, mergeOverrides } from "@/lib/inferRatings";
import { aiFlagForDb } from "@/lib/persistFlag";
import {
  appendWorkflowEntry,
  latestWorkflowText,
  normalizeWorkflowEntries,
} from "@/lib/workflow";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";
import { toClientMember } from "@/lib/matcher";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await TeamMemberModel.findOne({ id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ member: toClientMember(docToPlain(doc)) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const doc = await TeamMemberModel.findOne({ id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let currentOverrides = {
      ...(doc.ratingOverrides ?? {}),
    } as Record<string, number>;

    const getAi = () =>
      ({ ...(doc.aiRatings ?? {}) }) as Record<string, number>;

    if (body.skillRating) {
      const { skill, value } = body.skillRating as {
        skill: string;
        value: number | null;
      };
      currentOverrides = mergeOverrides(
        getAi(),
        currentOverrides,
        skill,
        value
      );
    } else if (body.bulkSkillRatings) {
      const updates = body.bulkSkillRatings as Record<string, number | null>;
      currentOverrides = applyBulkOverrides(
        getAi(),
        currentOverrides,
        updates
      );
    } else if (body.setAllSkillRating !== undefined) {
      const value = body.setAllSkillRating as number | null;
      const updates: Record<string, number | null> = {};
      for (const s of doc.skills) updates[s] = value;
      currentOverrides = applyBulkOverrides(
        getAi(),
        currentOverrides,
        updates
      );
    } else if (body.addSkill) {
      const skill = String(body.addSkill).trim();
      if (skill && !doc.skills.includes(skill)) {
        doc.skills = [...doc.skills, skill];
      }
    } else if (body.nextSteps != null) {
      const text = String(body.nextSteps).trim();
      doc.nextSteps = text;
      if (text) {
        doc.set("nextStepsLog", appendWorkflowEntry(doc.nextStepsLog, text));
      }
    } else if (body.addNextStep) {
      const text = String(body.addNextStep.text ?? body.addNextStep).trim();
      if (text) {
        doc.nextSteps = text;
        doc.set("nextStepsLog", appendWorkflowEntry(doc.nextStepsLog, text));
      }
    } else if (body.removeNextStep) {
      const entryId = String(body.removeNextStep);
      doc.nextStepsLog = (doc.nextStepsLog ?? []).filter(
        (e: { id: string }) => e.id !== entryId
      );
      doc.nextSteps = latestWorkflowText(
        normalizeWorkflowEntries(doc.nextStepsLog)
      );
      doc.markModified("nextStepsLog");
    } else if (body.aiFlags != null) {
      doc.set("aiFlags", aiFlagForDb(body.aiFlags));
      doc.markModified("aiFlags");
    } else if (body.addEscalation) {
      const text = String(body.addEscalation.text ?? body.addEscalation).trim();
      if (text) {
        doc.set("escalations", appendWorkflowEntry(doc.escalations, text));
      }
    } else if (body.removeEscalation) {
      const entryId = String(body.removeEscalation);
      doc.escalations = (doc.escalations ?? []).filter(
        (e: { id: string }) => e.id !== entryId
      );
      doc.markModified("escalations");
    } else if (body.removeSkill) {
      const skill = String(body.removeSkill);
      doc.skills = doc.skills.filter((s: string) => s !== skill);
      const ai = { ...(doc.aiRatings ?? {}) } as Record<string, number>;
      delete ai[skill];
      delete currentOverrides[skill];
      doc.aiRatings = ai;
      doc.ratingOverrides = currentOverrides;
    } else {
      if (body.name != null) doc.name = body.name;
      if (body.role != null) doc.role = body.role;
      if (body.exp != null) {
        doc.exp = body.exp;
        doc.expNum = parseExpNum(body.exp);
      }
      if (body.expNum != null) doc.expNum = body.expNum;
      if (body.email != null) doc.email = body.email;
      if (body.stackLabel != null) doc.stackLabel = body.stackLabel;
      if (body.tags != null) doc.tags = body.tags;
      if (body.projects != null) doc.projects = body.projects;
      if (body.notes != null) doc.notes = body.notes;
      if (body.skills != null) doc.skills = body.skills;
    }

    const onlyWorkflow =
      body.nextSteps != null ||
      body.aiFlags != null ||
      body.addEscalation != null ||
      body.removeEscalation != null ||
      body.addNextStep != null ||
      body.removeNextStep != null;

    const input = {
      id: doc.id,
      name: doc.name,
      role: doc.role,
      exp: doc.exp,
      expNum: doc.expNum,
      skills: doc.skills,
      email: doc.email,
      stackLabel: doc.stackLabel,
      tags: doc.tags,
      projects: doc.projects,
      notes: doc.notes,
      specializations: (doc.specializations as string[]) ?? [],
    };

    if (onlyWorkflow) {
      await doc.save();
      return NextResponse.json({ member: toClientMember(docToPlain(doc)) });
    }

    const enriched = enrichMember(input);
    if (body.specializations != null) {
      enriched.specializations = body.specializations as string[];
      enriched.specialization = primarySpecialization(
        body.specializations as string[]
      );
    }
    doc.specialization = enriched.specialization;
    doc.specializations = enriched.specializations;
    doc.stacks = enriched.stacks;
    doc.aiRatings = enriched.aiRatings;

    doc.ratingOverrides = Object.fromEntries(
      Object.entries(currentOverrides).filter(([s]) => doc.skills.includes(s))
    );

    if (process.env.OPENAI_API_KEY) {
      try {
        const emb = await enrichWithEmbedding({
          ...input,
          specialization: doc.specialization,
          specializations: doc.specializations,
          stacks: doc.stacks as string[],
          aiRatings: { ...(doc.aiRatings ?? {}) } as Record<string, number>,
        });
        doc.embedding = emb.embedding;
        doc.embeddingText = emb.embeddingText;
      } catch {
        /* skip */
      }
    }

    await doc.save();
    return NextResponse.json({ member: toClientMember(docToPlain(doc)) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    await TeamMemberModel.deleteOne({ id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
