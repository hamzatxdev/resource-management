"use client";

import { useState } from "react";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";

export function AddPersonModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    id: string;
    name: string;
    role: string;
    exp: string;
    email: string;
  }) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [exp, setExp] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setId("");
    setName("");
    setRole("");
    setExp("");
    setEmail("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      setError("Employee code is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        id: id.trim(),
        name: name.trim(),
        role: role.trim(),
        exp: exp.trim(),
        email: email.trim(),
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add team member"
      description="Creates a new profile in MongoDB. Skills and tags can be added after."
      size="lg"
      footer={
        <>
          <ModalButton onClick={handleClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            type="submit"
            form="add-person-form"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add person"}
          </ModalButton>
        </>
      }
    >
      <form id="add-person-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Employee code *">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="TV-00999"
              className={`${modalInputClass} font-mono`}
              autoFocus
            />
          </ModalField>
          <ModalField label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={modalInputClass}
            />
          </ModalField>
        </div>
        <ModalField label="Role">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Software Engineer"
            className={modalInputClass}
          />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Experience">
            <input
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              placeholder="3+"
              className={modalInputClass}
            />
          </ModalField>
          <ModalField label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@techverx.com"
              type="email"
              className={modalInputClass}
            />
          </ModalField>
        </div>
        {error && <p className="text-bad text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
