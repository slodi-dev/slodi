"use client";

import { useState } from "react";

interface ProgramFormData {
  name: string;
  description: string;
  workspaceId: string;
  image?: string;
  public: boolean;
  tags: string[];
}

interface ProgramFormProps {
  initialData?: Partial<ProgramFormData>;
  onSubmit: (data: ProgramFormData) => void;
  onCancel?: () => void;
}

export default function ProgramForm({ initialData, onSubmit, onCancel }: ProgramFormProps) {
  const [formData, setFormData] = useState<ProgramFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    workspaceId: initialData?.workspaceId || "",
    image: initialData?.image || "",
    public: initialData?.public || false,
    tags: initialData?.tags || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="program-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Program Title *</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor="workspace">Workspace *</label>
        <select
          id="workspace"
          value={formData.workspaceId}
          onChange={(e) => setFormData({ ...formData, workspaceId: e.target.value })}
          required
        >
          <option value="">Select workspace</option>
          {/* Workspace options will be populated */}
        </select>
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          maxLength={1000}
          rows={6}
        />
        <small>{formData.description.length} / 1000 characters</small>
      </div>

      <div>
        <label htmlFor="image">Image URL</label>
        <input
          id="image"
          type="url"
          value={formData.image}
          onChange={(e) => setFormData({ ...formData, image: e.target.value })}
          maxLength={255}
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.public}
            onChange={(e) => setFormData({ ...formData, public: e.target.checked })}
          />
          Make this program public
        </label>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit">Save Program</button>
      </div>
    </form>
  );
}
