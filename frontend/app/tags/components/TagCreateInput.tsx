"use client";

import { useState } from "react";
import { createTag, type Tag } from "@/services/tags.service";
import { useAuth } from "@/contexts/AuthContext";
import { tagErrorMessage, validateTagName } from "../tagRules";
import TagNameField from "./TagNameField";

interface TagCreateInputProps {
  /** Every tag, so a name that exists is refused before it is sent. */
  tags?: Tag[];
  /** The text in the field, when the page also searches with it. */
  value?: string;
  onValueChange?: (value: string) => void;
  onCreated: (tag: Tag) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Lets the empty state's "Búa til" button submit this field. */
  formId?: string;
}

/**
 * The page's one field: typing searches the list, Enter creates the name if
 * no tag has it yet. A name that exists is refused inline, without a request.
 */
export default function TagCreateInput({
  tags = [],
  value,
  onValueChange,
  onCreated,
  inputRef,
  formId,
}: TagCreateInputProps) {
  const { getToken } = useAuth();
  // Holds the text when the page doesn't (the component on its own).
  const [ownValue, setOwnValue] = useState("");

  const create = async (name: string): Promise<string | null> => {
    try {
      const tag = await createTag({ name: name.trim() }, getToken);
      onCreated(tag);
      return null;
    } catch (err) {
      return tagErrorMessage(err, "create");
    }
  };

  return (
    <TagNameField
      label="Leita eða búa til merkimiða"
      type="search"
      hint="Skrifaðu til að leita. Enter býr til merkimiðann ef enginn heitir þetta."
      submitLabel="Búa til"
      busyLabel="Bý til…"
      value={value ?? ownValue}
      onValueChange={onValueChange ?? setOwnValue}
      clearOnSuccess
      inputRef={inputRef}
      formId={formId}
      validate={(name) => validateTagName(name, tags)}
      onSubmit={create}
    />
  );
}
