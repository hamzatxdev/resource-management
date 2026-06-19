"use client";

import { useEffect, useMemo, useState } from "react";
import {
  currentTagTypingFragment,
  mergeTags,
  parseTag,
  parseTagsInput,
  replaceCurrentTagToken,
  tagCanonicalKey,
  TAG_EXAMPLES,
} from "@/lib/tags";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";
import { TagsList } from "./TagChip";

function tagSuggestionScore(tag: string, fragment: string): number {
  const f = fragment.toLowerCase();
  const raw = tag.toLowerCase();
  const label = parseTag(tag).label.toLowerCase();
  if (raw.startsWith(f)) return 0;
  if (label.startsWith(f)) return 1;
  if (raw.includes(f)) return 2;
  if (label.includes(f)) return 3;
  return 4;
}

export function AddTagModal({
  open,
  onClose,
  memberName,
  existingTags,
  teamTags = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  memberName: string;
  existingTags: string[];
  /** All tags used across the team — powers autocomplete */
  teamTags?: string[];
  onSubmit: (tags: string[]) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parsed = useMemo(() => parseTagsInput(input), [input]);
  const previews = useMemo(() => parsed.map((t) => parseTag(t)), [parsed]);
  const existingKeys = useMemo(
    () => new Set(existingTags.map(tagCanonicalKey)),
    [existingTags]
  );
  const duplicates = useMemo(
    () => parsed.filter((t) => existingKeys.has(tagCanonicalKey(t))),
    [parsed, existingKeys]
  );
  const toAdd = useMemo(
    () => parsed.filter((t) => !existingKeys.has(tagCanonicalKey(t))),
    [parsed, existingKeys]
  );

  const typingFragment = useMemo(() => currentTagTypingFragment(input), [input]);

  const suggestions = useMemo(() => {
    const fragment = typingFragment.trim().toLowerCase();
    if (!fragment) return [];

    const alreadyChosen = new Set([
      ...existingTags.map(tagCanonicalKey),
      ...parsed.map(tagCanonicalKey),
    ]);

    return teamTags
      .filter((tag) => {
        const key = tagCanonicalKey(tag);
        if (alreadyChosen.has(key)) return false;
        const preview = parseTag(tag);
        const hay = `${tag} ${preview.label}`.toLowerCase();
        return hay.includes(fragment);
      })
      .sort(
        (a, b) =>
          tagSuggestionScore(a, fragment) - tagSuggestionScore(b, fragment)
      )
      .slice(0, 8);
  }, [typingFragment, teamTags, existingTags, parsed]);

  useEffect(() => {
    if (open) {
      setInput("");
      setError("");
    }
  }, [open]);

  const appendExample = (ex: string) => {
    setInput((prev) => replaceCurrentTagToken(prev, ex));
  };

  const applySuggestion = (tag: string) => {
    setInput((prev) => replaceCurrentTagToken(prev, tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.length) {
      setError("Enter at least one tag");
      return;
    }
    if (!toAdd.length) {
      setError("All tags already exist on this person");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(mergeTags([], toAdd));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tags");
    } finally {
      setSaving(false);
    }
  };

  const addLabel =
    toAdd.length > 1
      ? `Add ${toAdd.length} tags`
      : toAdd.length === 1
        ? "Add tag"
        : "Add tags";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add tags"
      description={`Tags for ${memberName || "this person"}. One per line, or separated by commas. To change a tag, remove it with × on the row (or in the +N list) then add the new one here.`}
      size="md"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            type="submit"
            form="add-tag-form"
            disabled={saving || !toAdd.length}
          >
            {saving ? "Saving…" : addLabel}
          </ModalButton>
        </>
      }
    >
      <form id="add-tag-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint mb-1.5">
            Current tags on profile
            {existingTags.length > 0 ? ` (${existingTags.length})` : ""}
          </p>
          {existingTags.length > 0 ? (
            <div className="rounded border border-border bg-bg-elev p-2 max-h-36 overflow-y-auto">
              <TagsList tags={existingTags} />
            </div>
          ) : (
            <p className="text-text-dim text-xs rounded border border-dashed border-border px-3 py-2">
              No tags yet — add below.
            </p>
          )}
        </div>

        <ModalField label="Add new tags">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"project:acme\nmay:bench\nallocation:june:cis:4h"}
            rows={4}
            className={`${modalInputClass} font-mono resize-y min-h-[5rem]`}
          />
        </ModalField>

        {suggestions.length > 0 && (
          <div>
            <p className="font-mono text-[10px] text-text-faint mb-1">
              Existing tags matching “{typingFragment.trim()}”
            </p>
            <ul className="rounded border border-border bg-bg-elev divide-y divide-border max-h-36 overflow-y-auto">
              {suggestions.map((tag) => {
                const preview = parseTag(tag);
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      onClick={() => applySuggestion(tag)}
                      className="w-full text-left px-2 py-1.5 hover:bg-accent/10 transition-colors"
                    >
                      <span className="text-accent font-medium text-sm">
                        {preview.label}
                      </span>
                      <span className="block font-mono text-[10px] text-text-faint">
                        {preview.raw}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {previews.length > 0 && (
          <ul className="text-sm rounded border border-border bg-bg-elev divide-y divide-border max-h-40 overflow-y-auto">
            {previews.map((preview, i) => {
              const dup = existingKeys.has(tagCanonicalKey(parsed[i]));
              return (
                <li key={parsed[i]} className="px-2 py-1.5">
                  <span className="text-accent font-medium">{preview.label}</span>
                  <span className="block font-mono text-[10px] text-text-faint">
                    {preview.raw}
                    {dup && (
                      <span className="text-warn ml-1">· already on profile</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {duplicates.length > 0 && toAdd.length > 0 && (
          <p className="text-warn text-xs">
            Skipping {duplicates.length} duplicate
            {duplicates.length === 1 ? "" : "s"}; adding {toAdd.length} new tag
            {toAdd.length === 1 ? "" : "s"}.
          </p>
        )}

        <div>
          <p className="font-mono text-[10px] text-text-faint mb-1">Quick add</p>
          <div className="flex flex-wrap gap-1">
            {TAG_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => appendExample(ex)}
                className="font-mono text-[9px] rounded border border-border px-1.5 py-0.5 hover:border-accent"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-bad text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
