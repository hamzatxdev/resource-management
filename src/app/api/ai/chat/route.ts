import OpenAI from "openai";
import { NextResponse } from "next/server";
import { memberContextLine } from "@/lib/aiContext";
import { TEAM_AI_SYSTEM } from "@/lib/aiPrompts";
import { embedText, rankByEmbedding } from "@/lib/embeddings";
import { connectDB } from "@/lib/mongodb";
import { parseMatcherInput, rankCandidates, toClientMember } from "@/lib/matcher";
import {
  applyNlFilter,
  interpretNaturalLanguageQuery,
} from "@/lib/nlQuery";
import {
  filterMembersByTagQuery,
  isStructuredTagQuery,
  parseTagQuery,
} from "@/lib/tagQueryFilter";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const FILTER_TOP_K = 20;
const MATCHER_TOP_K = 20;
const SEMANTIC_MIN_SCORE = 0.28;

function mergeFilterIds(
  semanticIds: string[],
  matcherIds: string[]
): string[] {
  if (semanticIds.length && matcherIds.length) {
    const matcherSet = new Set(matcherIds);
    const intersection = semanticIds.filter((id) => matcherSet.has(id));
    return intersection.length ? intersection : semanticIds;
  }
  if (matcherIds.length) return matcherIds;
  return semanticIds;
}

function intersectIds(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return a.filter((id) => set.has(id));
}

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set. Add it to .env to use AI features." },
        { status: 400 }
      );
    }

    const { message, matcherInput, filterOnly } = (await req.json()) as {
      message: string;
      matcherInput?: string;
      filterOnly?: boolean;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    await connectDB();
    const docs = await TeamMemberModel.find().lean();
    const plain = docs.map((d) => docToPlain(d));

    let matcherResults: ReturnType<typeof rankCandidates> = [];
    if (matcherInput?.trim()) {
      const clients = plain.map((d) => toClientMember(d));
      const reqs = parseMatcherInput(matcherInput);
      matcherResults = rankCandidates(clients, reqs).slice(0, MATCHER_TOP_K);
    }
    const matcherIds = matcherResults.map((r) => r.person.id);

    const tagQuery = parseTagQuery(message);
    const useTagFilter = filterOnly && isStructuredTagQuery(tagQuery);

    let memberIds: string[] = [];
    let filterMode: "tags" | "semantic" | "hybrid" = "semantic";
    let filterSummary: string | undefined;
    let ranked: Array<{ member: (typeof plain)[0]; score: number }> = [];
    let tagFilterResolved = false;

    if (filterOnly) {
      const nl =
        !useTagFilter
          ? await interpretNaturalLanguageQuery(message, plain, key)
          : null;

      if (nl) {
        tagFilterResolved = true;
        filterMode = "tags";
        filterSummary = nl.filter.summary ?? message.trim();
        const nlMatches = applyNlFilter(plain, nl.filter);
        memberIds = nlMatches.map((m) => m.id);
        if (matcherIds.length) {
          memberIds = intersectIds(memberIds, matcherIds);
          filterMode = "hybrid";
        }
        ranked = nlMatches.slice(0, FILTER_TOP_K).map((member) => ({
          member,
          score: 1,
        }));
      } else if (useTagFilter && tagQuery) {
        tagFilterResolved = true;
        filterMode = "tags";
        filterSummary = message.trim();
        const tagMatches = filterMembersByTagQuery(
          plain.map((m) => ({
            id: m.id,
            tags: m.tags,
            role: m.role,
            projects: m.projects,
          })),
          tagQuery
        );
        const matchIds = new Set(tagMatches.map((m) => m.id));
        const tagMatchesFull = plain.filter((m) => matchIds.has(m.id));
        memberIds = tagMatchesFull.map((m) => m.id);
        if (matcherIds.length) {
          memberIds = intersectIds(memberIds, matcherIds);
          filterMode = "hybrid";
        }
        ranked = tagMatchesFull.slice(0, FILTER_TOP_K).map((member) => ({
          member,
          score: 1,
        }));
      }
    }

    const matcherPayload = matcherResults.map((r) => ({
      id: r.person.id,
      name: r.person.name,
      score: r.normalizedScore,
      met: r.met,
      partial: r.partial,
      miss: r.miss,
    }));

    if (filterOnly && tagFilterResolved) {
      return NextResponse.json({
        filterOnly: true,
        filterMode,
        filterSummary,
        memberIds,
        count: memberIds.length,
        tagQuery: tagQuery ?? undefined,
        sources: ranked.map(({ member, score }) => ({
          id: member.id,
          name: member.name,
          score,
        })),
        matcherResults: matcherPayload,
      });
    }

    if (!filterOnly || ranked.length === 0) {
      const topK = filterOnly ? FILTER_TOP_K : 8;
      const minScore = filterOnly ? SEMANTIC_MIN_SCORE : 0;
      const queryEmbedding = await embedText(message);
      ranked = rankByEmbedding(
        queryEmbedding,
        plain.map((member) => ({ member })),
        topK,
        minScore
      );
      const semanticIds = ranked.map(({ member }) => member.id);
      memberIds = mergeFilterIds(semanticIds, matcherIds);
      if (matcherIds.length && semanticIds.length) filterMode = "hybrid";
    }

    const sources = ranked.map(({ member, score }) => ({
      id: member.id,
      name: member.name,
      score,
    }));

    if (filterOnly) {
      return NextResponse.json({
        filterOnly: true,
        filterMode,
        filterSummary,
        memberIds,
        count: memberIds.length,
        tagQuery: tagQuery ?? undefined,
        sources,
        matcherResults: matcherPayload,
      });
    }

    if (!ranked.length) {
      const queryEmbedding = await embedText(message);
      ranked = rankByEmbedding(
        queryEmbedding,
        plain.map((member) => ({ member })),
        8
      );
      memberIds = mergeFilterIds(
        ranked.map(({ member }) => member.id),
        matcherIds
      );
    }

    const contextBlocks = ranked.map(({ member, score }) =>
      memberContextLine(member, Math.round(score * 100))
    );

    const matcherBlock =
      matcherResults.length > 0
        ? "\n\nProject matcher results:\n" +
          matcherResults
            .map(
              (r, i) =>
                `${i + 1}. ${r.person.name} (${r.person.id}) — score ${r.normalizedScore.toFixed(1)}/5, ${r.met} met, ${r.partial} partial, ${r.miss} missing`
            )
            .join("\n")
        : "";

    const userContent = `Question: ${message}

Team context (${ranked.length} most relevant profiles):
${contextBlocks.join("\n")}
${matcherBlock}`;

    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: TEAM_AI_SYSTEM },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
    });

    const answer =
      completion.choices[0]?.message?.content ?? "No response generated.";

    return NextResponse.json({
      answer,
      filterMode,
      memberIds,
      sources,
      matcherResults: matcherPayload,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI chat failed" },
      { status: 500 }
    );
  }
}
