/**
 * One-time cleanup: canonicalize and dedupe tags on every team member in MongoDB.
 *
 *   npm run normalize-tags
 *
 * Merges variants like allocated:cis:core team / Core-team into allocated:cis:core-team,
 * and onbench / Onbench / onBench into onbench.
 */
import { config } from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { dedupeTags, normalizeTagInput } from "../src/lib/tags";
import { TeamMemberModel } from "../src/models/TeamMember";

config({ path: path.join(process.cwd(), ".env") });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const docs = await TeamMemberModel.find();
  let updated = 0;
  let tagsRemoved = 0;

  for (const doc of docs) {
    const before = (doc.tags as string[]) ?? [];
    const after = dedupeTags(before.map((t) => normalizeTagInput(t)));
    if (before.length !== after.length || before.some((t, i) => t !== after[i])) {
      doc.tags = after;
      doc.markModified("tags");
      await doc.save();
      updated++;
      tagsRemoved += before.length - after.length;
      if (before.length !== after.length) {
        console.log(
          `${doc.id}: ${before.length} → ${after.length} tags`,
          after.join(", ") || "(none)"
        );
      }
    }
  }

  console.log(
    `Done. Updated ${updated}/${docs.length} members; removed ${tagsRemoved} duplicate/variant tags.`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
