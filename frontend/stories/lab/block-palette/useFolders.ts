import { useCallback, useEffect, useRef, useState } from "react";
import type { LabFolder, LabSource } from "./blockPaletteLabData";

/** What the cards below show: one built-in source, or one folder. */
export type Selection = { type: "source"; id: LabSource["id"] } | { type: "folder"; id: string };

/** Mirrors the length limit the folder API would enforce (see the About page). */
export const FOLDER_NAME_MAX = 60;

/** How long "Afturkalla" stays after a delete: rule 5 asks for at least 8 seconds. */
const UNDO_MS = 10_000;

/** One line for the rail's live region, with "Afturkalla" when it can be undone. */
export interface FolderMessage {
  text: string;
  canUndo: boolean;
  seq: number;
}

/**
 * Why a name can't be used, or null. Names are compared trimmed and case-insensitively, so
 * "Rigningardagar" and "rigningardagar " are the same folder.
 */
export function folderNameError(
  name: string,
  folders: LabFolder[],
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

/**
 * The folders and the current selection, in memory. The real thing would sit on the folder API
 * proposed on the About page; every action here maps onto one call there.
 */
export function useFolders(initial: LabFolder[], initialSelection: Selection) {
  const [folders, setFolders] = useState(initial);
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [message, setMessage] = useState<FolderMessage | null>(null);
  const deleted = useRef<{ folder: LabFolder; index: number } | null>(null);
  const seq = useRef(0);

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

  /** Create a folder. Returns the error to show, or null and the new folder's id. */
  const create = (
    name: string,
    options: { select?: boolean; withBlock?: string } = {}
  ): { error: string | null; id?: string } => {
    const error = folderNameError(name, folders);
    if (error) return { error };
    const folder: LabFolder = {
      id: `al-new-${nextFolderId++}`,
      name: name.trim(),
      icon: "BookMarked",
      shared: false,
      blockIds: options.withBlock ? [options.withBlock] : [],
    };
    setFolders((prev) => [...prev, folder]);
    if (options.select ?? true) setSelection({ type: "folder", id: folder.id });
    say(`Mappa búin til: ${folder.name}.`);
    return { error: null, id: folder.id };
  };

  const rename = (id: string, name: string): string | null => {
    const error = folderNameError(name, folders, id);
    if (error) return error;
    setFolders((prev) => prev.map((a) => (a.id === id ? { ...a, name: name.trim() } : a)));
    say(`Mappan heitir nú ${name.trim()}.`);
    return null;
  };

  /** Reversible, so no confirmation: it goes at once and "Afturkalla" brings it back (rule 5). */
  const remove = (id: string) => {
    const index = folders.findIndex((a) => a.id === id);
    if (index < 0) return;
    deleted.current = { folder: folders[index], index };
    setFolders((prev) => prev.filter((a) => a.id !== id));
    if (selection.type === "folder" && selection.id === id) {
      setSelection({ type: "source", id: "allt" });
    }
    say(`Möppu eytt: ${folders[index].name}.`, true);
  };

  const undoRemove = () => {
    const last = deleted.current;
    if (!last) return;
    deleted.current = null;
    setFolders((prev) => [...prev.slice(0, last.index), last.folder, ...prev.slice(last.index)]);
    say(`Mappan ${last.folder.name} er komin aftur.`);
  };

  const toggleBlock = (folderId: string, blockId: string, blockName: string) => {
    const folder = folders.find((a) => a.id === folderId);
    if (!folder) return;
    const isIn = folder.blockIds.includes(blockId);
    setFolders((prev) =>
      prev.map((a) =>
        a.id !== folderId
          ? a
          : {
              ...a,
              blockIds: isIn ? a.blockIds.filter((b) => b !== blockId) : [...a.blockIds, blockId],
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
