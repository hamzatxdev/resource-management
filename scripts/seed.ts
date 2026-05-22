import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import mongoose from "mongoose";

config({ path: path.join(process.cwd(), ".env") });
import { parseExcelBuffer, excelRowToInput } from "../src/lib/excel";
import { enrichMember, enrichWithEmbedding } from "../src/lib/memberService";
import { TeamMemberModel } from "../src/models/TeamMember";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const xlsxPath = path.join(
    process.cwd(),
    "Resources Skill Sheet.xlsx"
  );
  const buffer = readFileSync(xlsxPath);
  const rows = parseExcelBuffer(buffer);

  let count = 0;
  for (const row of rows) {
    const input = excelRowToInput(row);
    const enriched = enrichMember(input);
    const existing = await TeamMemberModel.findOne({ id: input.id });

    let embedding: number[] | undefined;
    let embeddingText = "";

    if (process.env.OPENAI_API_KEY) {
      const emb = await enrichWithEmbedding(enriched);
      embedding = emb.embedding;
      embeddingText = emb.embeddingText;
    }

    if (existing) {
      existing.name = enriched.name;
      existing.role = enriched.role;
      existing.exp = enriched.exp;
      existing.expNum = enriched.expNum;
      existing.skills = enriched.skills;
      existing.email = enriched.email;
      existing.stackLabel = enriched.stackLabel;
      existing.specialization = enriched.specialization;
      existing.specializations = enriched.specializations;
      existing.stacks = enriched.stacks;
      existing.aiRatings = enriched.aiRatings;
      if (embedding) {
        existing.embedding = embedding;
        existing.embeddingText = embeddingText;
      }
      await existing.save();
    } else {
      await TeamMemberModel.create({ ...enriched, embedding, embeddingText });
    }
    count++;
    console.log(`  ${input.id} ${input.name}`);
  }

  console.log(`Seeded ${count} members from Excel`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
