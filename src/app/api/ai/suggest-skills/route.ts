import OpenAI from "openai";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { toClientMember } from "@/lib/matcher";
import {
  applySuggestedSkillsToDoc,
  filterNewSkills,
  suggestSkillsForProfile,
} from "@/lib/suggestSkills";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      id: string;
      save?: boolean;
      skills?: string[];
      ratingUpdates?: Record<string, number>;
      maxSkills?: number;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await connectDB();
    const doc = await TeamMemberModel.findOne({ id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const member = toClientMember(docToPlain(doc));
    const openai = new OpenAI({ apiKey: key });

    if (body.save) {
      const requested = (body.skills ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean);
      let skills: string[];
      let ratingUpdates: Record<string, number> = {
        ...(body.ratingUpdates ?? {}),
      };

      if (requested.length) {
        skills = filterNewSkills(member.skills, requested);
      } else {
        const suggestion = await suggestSkillsForProfile(openai, member, {
          maxSkills: body.maxSkills,
        });
        skills = suggestion.skills;
        ratingUpdates = suggestion.ratingUpdates;
      }

      if (!skills.length) {
        return NextResponse.json({
          member,
          added: [],
          message: "No new skills to add — profile may already be complete.",
        });
      }

      const added = await applySuggestedSkillsToDoc(doc, skills, ratingUpdates);
      const fresh = await TeamMemberModel.findOne({ id }).lean();
      return NextResponse.json({
        member: toClientMember(docToPlain(fresh)),
        added,
        skills: added,
        ratingUpdates: Object.fromEntries(
          added.map((s) => [s, (doc.aiRatings as Record<string, number>)[s]])
        ),
      });
    }

    const suggestion = await suggestSkillsForProfile(openai, member, {
      maxSkills: body.maxSkills,
    });

    if (!suggestion.skills.length) {
      return NextResponse.json({
        skills: [],
        ratingUpdates: {},
        summary:
          suggestion.summary ||
          "AI found no additional skills to suggest for this profile.",
      });
    }

    return NextResponse.json(suggestion);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Skill suggestion failed" },
      { status: 500 }
    );
  }
}
