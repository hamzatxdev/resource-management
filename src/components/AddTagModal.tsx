"use client";

import { useEffect, useMemo, useState } from "react";
import { parseTag, parseTagsInput, TAG_EXAMPLES } from "@/lib/tags";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";

export function AddTagModal({
  open,
  onClose,
  memberName,
  existingTags,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  memberName: string;
  existingTags: string[];
  onSubmit: (tags: string[]) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parsed = useMemo(() => parseTagsInput(input), [input]);
  const previews = useMemo(() => parsed.map((t) => parseTag(t)), [parsed]);
  const existingSet = useMemo(() => new Set(existingTags), [existingTags]);
  const duplicates = useMemo(
    () => parsed.filter((t) => existingSet.has(t)),
    [parsed, existingSet]
  );
  const toAdd = useMemo(
    () => parsed.filter((t) => !existingSet.has(t)),
    [parsed, existingSet]
  );

  useEffect(() => {
    if (open) {
      setInput("");
      setError("");
    }
  }, [open]);

  const appendExample = (ex: string) => {
    setInput((prev) => {
      const parts = parseTagsInput(prev);
      if (parts.includes(ex)) return prev;
      const next = [...parts, ex].join("\n");
      return prev.trim() ? `${prev.trimEnd()}\n${ex}` : ex;
    });
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
      await onSubmit(toAdd);
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
        <ModalField label="Tags">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"project:acme\nmay:bench\nallocation:june:cis:4h"}
            rows={4}
            className={`${modalInputClass} font-mono resize-y min-h-[5rem]`}
            autoFocus
          />
        </ModalField>

        {previews.length > 0 && (
          <ul className="text-sm rounded border border-border bg-bg-elev divide-y divide-border max-h-40 overflow-y-auto">
            {previews.map((preview, i) => {
              const dup = existingSet.has(parsed[i]);
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
