"use client";

import { forwardRef, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/util";
import type { User } from "@/services/users.service";
import { SelfBadge } from "./UserDetail";
import { initials, PERMISSION_LABEL } from "./userRules";
import styles from "./UserManagement.module.css";

/** True once the split has collapsed to one column (phone width): the panel replaces the list. */
function isStacked(el: HTMLElement | null): boolean {
  if (!el) return false;
  return getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length < 2;
}

const ROW_KEYS: Record<string, (index: number, last: number) => number> = {
  ArrowDown: (i, last) => Math.min(i + 1, last),
  ArrowUp: (i) => Math.max(i - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

export interface UserSplitProps {
  /** The users on this page of the list. */
  visible: User[];
  selectedId: string | null;
  currentUserId: string | undefined;
  onSelect: (id: string | null) => void;
  /** The open user's panel. Gets `onBack` and `focusOnMount` from here. */
  renderDetail: (user: User, panel: { onBack: () => void; focusOnMount: boolean }) => ReactNode;
  /** The selected user, which may be on another page of the list. */
  selected: User | null;
}

/**
 * The list on the left, the chosen person on the right. On a phone the panel
 * replaces the list, with "Til baka í lista".
 *
 * The list is one Tab stop and ↑ ↓ Home End move inside it. Side by side, the
 * selection follows focus. Stacked, opening would hide the list, so the arrows
 * only move focus and Enter opens the panel.
 */
const UserSplit = forwardRef<HTMLUListElement, UserSplitProps>(function UserSplit(
  { visible, selectedId, currentUserId, onSelect, renderDetail, selected },
  listRef
) {
  const splitRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [focusDetail, setFocusDetail] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const ids = visible.map((u) => u.id);
  const tabStop = [focusedId, selectedId].find((x) => x && ids.includes(x)) ?? ids[0];

  const rowFor = (id: string) =>
    splitRef.current?.querySelector<HTMLElement>(`[data-user-id="${CSS.escape(id)}"]`);

  const open = (id: string) => {
    onSelect(id);
    setFocusedId(id);
    // Side by side, focus stays in the list. Stacked, it follows the panel.
    setFocusDetail(isStacked(splitRef.current));
  };

  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ROW_KEYS[e.key];
    if (!step) return;
    e.preventDefault();
    const id = ids[step(index, ids.length - 1)];
    setFocusedId(id);
    rowFor(id)?.focus();
    if (!isStacked(splitRef.current)) {
      onSelect(id);
      setFocusDetail(false);
    }
  };

  const back = () => {
    const id = selectedId;
    onSelect(null);
    if (id) requestAnimationFrame(() => rowFor(id)?.focus());
  };

  return (
    <div ref={splitRef} className={styles.split} data-has-selection={selected ? "true" : undefined}>
      <div className={styles.splitListBox}>
        <p id={hintId} className={styles.srOnly}>
          Örvalyklar upp og niður færa á milli notenda.
        </p>
        <ul
          ref={listRef}
          className={styles.splitList}
          aria-label="Notendalisti"
          aria-describedby={hintId}
        >
          {visible.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                data-user-id={u.id}
                tabIndex={u.id === tabStop ? 0 : -1}
                className={styles.splitItem}
                aria-current={u.id === selectedId ? "true" : undefined}
                onClick={() => open(u.id)}
                onKeyDown={(e) => onRowKey(e, i)}
                onFocus={() => setFocusedId(u.id)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {initials(u.name)}
                </span>
                <span className={styles.splitWho}>
                  <span className={styles.splitNameLine}>
                    <span className={cn(styles.name, styles.truncate)}>{u.name}</span>
                    {u.id === currentUserId && <SelfBadge />}
                  </span>
                  <span className={cn(styles.email, styles.truncate)}>{u.email}</span>
                  <span className={styles.splitRole}>{PERMISSION_LABEL[u.permissions]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.detail}>
        {selected ? (
          renderDetail(selected, { onBack: back, focusOnMount: focusDetail })
        ) : (
          <div className={styles.detailEmpty}>
            <UserRound className={styles.detailEmptyIcon} aria-hidden="true" />
            <p className={styles.detailEmptyTitle}>Veldu notanda</p>
            <p className={styles.sectionText}>
              Veldu notanda úr listanum til að sjá og breyta réttindum og aðgangi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export default UserSplit;
