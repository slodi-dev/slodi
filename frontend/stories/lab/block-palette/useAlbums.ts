import { useCallback, useEffect, useRef, useState } from "react";
import type { LabAlbum, LabSource } from "./blockPaletteLabData";

/** What the cards below show: one built-in source, or one album. */
export type Selection = { type: "source"; id: LabSource["id"] } | { type: "album"; id: string };

/** Mirrors the length limit the album API would enforce (see the About page). */
export const ALBUM_NAME_MAX = 60;

/** How long "Afturkalla" stays after a delete: rule 5 asks for at least 8 seconds. */
const UNDO_MS = 10_000;

/** One line for the rail's live region, with "Afturkalla" when it can be undone. */
export interface AlbumMessage {
  text: string;
  canUndo: boolean;
  seq: number;
}

/**
 * Why a name can't be used, or null. Names are compared trimmed and case-insensitively, so
 * "Rigningardagar" and "rigningardagar " are the same album.
 */
export function albumNameError(name: string, albums: LabAlbum[], exceptId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Gefðu albúminu heiti.";
  if (trimmed.length > ALBUM_NAME_MAX) return `Heitið má vera mest ${ALBUM_NAME_MAX} stafir.`;
  const same = albums.find(
    (album) =>
      album.id !== exceptId &&
      album.name.trim().toLocaleLowerCase("is") === trimmed.toLocaleLowerCase("is")
  );
  return same ? `Þú átt þegar albúm sem heitir „${same.name}“.` : null;
}

let nextAlbumId = 1;

/**
 * The albums and the current selection, in memory. The real thing would sit on the album API
 * proposed on the About page; every action here maps onto one call there.
 */
export function useAlbums(initial: LabAlbum[], initialSelection: Selection) {
  const [albums, setAlbums] = useState(initial);
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [message, setMessage] = useState<AlbumMessage | null>(null);
  const deleted = useRef<{ album: LabAlbum; index: number } | null>(null);
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

  /** Create an album. Returns the error to show, or null and the new album's id. */
  const create = (
    name: string,
    options: { select?: boolean; withBlock?: string } = {}
  ): { error: string | null; id?: string } => {
    const error = albumNameError(name, albums);
    if (error) return { error };
    const album: LabAlbum = {
      id: `al-new-${nextAlbumId++}`,
      name: name.trim(),
      icon: "BookMarked",
      shared: false,
      blockIds: options.withBlock ? [options.withBlock] : [],
    };
    setAlbums((prev) => [...prev, album]);
    if (options.select ?? true) setSelection({ type: "album", id: album.id });
    say(`Albúm búið til: ${album.name}.`);
    return { error: null, id: album.id };
  };

  const rename = (id: string, name: string): string | null => {
    const error = albumNameError(name, albums, id);
    if (error) return error;
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, name: name.trim() } : a)));
    say(`Albúmið heitir nú ${name.trim()}.`);
    return null;
  };

  /** Reversible, so no confirmation: it goes at once and "Afturkalla" brings it back (rule 5). */
  const remove = (id: string) => {
    const index = albums.findIndex((a) => a.id === id);
    if (index < 0) return;
    deleted.current = { album: albums[index], index };
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    if (selection.type === "album" && selection.id === id) {
      setSelection({ type: "source", id: "allt" });
    }
    say(`Albúmi eytt: ${albums[index].name}.`, true);
  };

  const undoRemove = () => {
    const last = deleted.current;
    if (!last) return;
    deleted.current = null;
    setAlbums((prev) => [...prev.slice(0, last.index), last.album, ...prev.slice(last.index)]);
    say(`Albúmið ${last.album.name} er komið aftur.`);
  };

  const toggleBlock = (albumId: string, blockId: string, blockName: string) => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    const isIn = album.blockIds.includes(blockId);
    setAlbums((prev) =>
      prev.map((a) =>
        a.id !== albumId
          ? a
          : {
              ...a,
              blockIds: isIn ? a.blockIds.filter((b) => b !== blockId) : [...a.blockIds, blockId],
            }
      )
    );
    say(isIn ? `${blockName} tekið úr ${album.name}.` : `${blockName} sett í ${album.name}.`);
  };

  /** Move an album to a new position; the keyboard path and the drag both end here. */
  const move = (id: string, toIndex: number) => {
    const from = albums.findIndex((a) => a.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(albums.length - 1, toIndex));
    if (from === to) return;
    const next = [...albums];
    const [album] = next.splice(from, 1);
    next.splice(to, 0, album);
    setAlbums(next);
    say(`${album.name} fært í sæti ${to + 1} af ${albums.length}.`);
  };

  return {
    albums,
    selection,
    select: setSelection,
    create,
    rename,
    remove,
    undoRemove,
    toggleBlock,
    move,
    message,
  };
}

export type AlbumsApi = ReturnType<typeof useAlbums>;
