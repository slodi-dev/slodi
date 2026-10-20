"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMockMode } from "@/lib/mock/mock-mode";
import { LIBRARY_FOLDERS, type LibraryFolder } from "@/lib/mock/folders.mock";
import type { LibrarySourceId } from "@/lib/mock/library.mock";

/** What the rail's cards show: one built-in source, or one mappa. */
export type BankSelection =
  | { type: "source"; id: LibrarySourceId }
  | { type: "folder"; id: string };

/** The length limit the folder API is proposed to enforce (sc-620). */
export const FOLDER_NAME_MAX = 60;

/** How long "Afturkalla" stays after a delete: rule 5 asks for at least 8 seconds. */
const UNDO_MS = 10_000;

/** One line for the rail's live region, with "Afturkalla" when it can be undone. */
export interface FolderMessage {
  text: string;
  canUndo: boolean;
  seq: number;
}

/** No möppur: what a real leader sees until sc-620 gives them a backend. */
const NO_FOLDERS: LibraryFolder[] = [];

/**
 * Why a name can't be used, or null. Names are compared trimmed and case-insensitively, so
 * "Rigningardagar" and "rigningardagar " are the same mappa.
 */
export function folderNameError(
  name: string,
  folders: LibraryFolder[],
  exceptId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Gefðu möppunni heiti.";
  if (trimmed.length > FOLDER_NAME_MAX) return `Heitið má vera mest ${FOLDER_NAME_MAX} stafir.`;
  const same = folders.find(
    (folder) =>
      folder.id !== exceptId &&
      folder.name.trim().toLocaleLowerCase("is") === trimmed.toLocaleLowerCase("is")
  );
  return same ? `Þú átt þegar möppu sem heitir „${same.name}“.` : null;
}

let nextFolderId = 1;

export interface UseFoldersOptions {
  /** Start from these möppur instead of the fixtures (stories). */
  initial?: LibraryFolder[];
  /** What is selected on load. */
  initialSelection?: BankSelection;
}

/**
 * The leader's möppur and the rail's current selection.
 *
 * In memory only. In mock mode it starts from the fixtures (lib/mock/folders.mock.ts), gated the
 * same way as useBlockLibrary, so a real leader never sees made-up möppur; with mock mode off it
 * starts empty, and anything made is gone on reload.
 */
export function useFolders({
  initial,
  initialSelection = { type: "source", id: "allt" },
}: UseFoldersOptions = {}) {
  const { mode, settled } = useMockMode();
  // TODO(sc-620): replace the seed and every setFolders below with the folder API — a query
  // for GET /folders, and one mutation per action (create, rename, remove/restore, toggleBlock).
  const seed = initial ?? (settled && mode !== "off" ? LIBRARY_FOLDERS : NO_FOLDERS);

  const [folders, setFolders] = useState(seed);
  const [selection, setSelection] = useState<BankSelection>(initialSelection);
  const [message, setMessage] = useState<FolderMessage | null>(null);
  const deleted = useRef<{ folder: LibraryFolder; index: number } | null>(null);
  const seq = useRef(0);

  // Mock mode settles after the first render. Take the new seed until the leader has changed
  // something, never after.
  const [seededFrom, setSeededFrom] = useState(seed);
  const touched = useRef(false);
  if (seed !== seededFrom && !touched.current) {
    setSeededFrom(seed);
    setFolders(seed);
  }
  const change = (update: (prev: LibraryFolder[]) => LibraryFolder[]) => {
    touched.current = true;
    setFolders(update);
  };

  const say = useCallback((text: string, canUndo = false) => {
    seq.current += 1;
    setMessage({ text, canUndo, seq: seq.current });
  }, []);

  // "Afturkalla" goes away after UNDO_MS; a plain message stays until the next one.
  useEffect(() => {
    if (!message?.canUndo) return;
    const timer = setTimeout(() => {
      deleted.current = null;
      setMessage((m) => (m?.seq === message.seq ? null : m));
    }, UNDO_MS);
    return () => clearTimeout(timer);
  }, [message]);

  /** Create a mappa. Returns the error to show, or null and the new mappa's id. */
  const create = (
    name: string,
    options: { select?: boolean; withBlock?: string } = {}
  ): { error: string | null; id?: string } => {
    const error = folderNameError(name, folders);
    if (error) return { error };
    const folder: LibraryFolder = {
      id: `mappa-new-${nextFolderId++}`,
      name: name.trim(),
      icon: "BookMarked",
      shared: false,
      blockIds: options.withBlock ? [options.withBlock] : [],
    };
    change((prev) => [...prev, folder]);
    if (options.select ?? true) setSelection({ type: "folder", id: folder.id });
    say(`Mappa búin til: ${folder.name}.`);
    return { error: null, id: folder.id };
  };

  const rename = (id: string, name: string): string | null => {
    const error = folderNameError(name, folders, id);
    if (error) return error;
    change((prev) => prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)));
    say(`Mappan heitir nú ${name.trim()}.`);
    return null;
  };

  /** Reversible, so no confirmation: it goes at once and "Afturkalla" brings it back (rule 5). */
  const remove = (id: string) => {
    const index = folders.findIndex((f) => f.id === id);
    if (index < 0) return;
    deleted.current = { folder: folders[index], index };
    change((prev) => prev.filter((f) => f.id !== id));
    if (selection.type === "folder" && selection.id === id) {
      setSelection({ type: "source", id: "allt" });
    }
    say(`Möppu eytt: ${folders[index].name}.`, true);
  };

  const undoRemove = () => {
    const last = deleted.current;
    if (!last) return;
    deleted.current = null;
    change((prev) => [...prev.slice(0, last.index), last.folder, ...prev.slice(last.index)]);
    say(`Mappan ${last.folder.name} er komin aftur.`);
  };

  const toggleBlock = (folderId: string, blockId: string, blockName: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const isIn = folder.blockIds.includes(blockId);
    change((prev) =>
      prev.map((f) =>
        f.id !== folderId
          ? f
          : {
              ...f,
              blockIds: isIn ? f.blockIds.filter((b) => b !== blockId) : [...f.blockIds, blockId],
            }
      )
    );
    say(isIn ? `${blockName} tekið úr ${folder.name}.` : `${blockName} sett í ${folder.name}.`);
  };

  return {
    folders,
    selection,
    select: setSelection,
    create,
    rename,
    remove,
    undoRemove,
    toggleBlock,
    message,
  };
}

export type FoldersApi = ReturnType<typeof useFolders>;
