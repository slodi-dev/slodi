"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { cn } from "@/lib/util";
import type { User, UserPermissions } from "@/services/users.service";
import type { WorkspaceRole } from "@/services/workspaces.service";
import {
  BANK_ROLE_DESCRIPTION,
  BANK_ROLE_LABEL,
  GRANTABLE_BANK_ROLES,
  GRANTABLE_PERMISSIONS,
  initials,
  PERMISSION_DESCRIPTION,
  PERMISSION_LABEL,
  userErrorMessage,
  type UserAction,
} from "./userRules";
import styles from "./UserManagement.module.css";

export interface UserDetailProps {
  user: User;
  isSelf: boolean;
  /** Self and platform admins: their permission can't be changed here. */
  locked: boolean;
  /** Role in the shared programme bank. `undefined`: no bank is set up; `null`: no role yet. */
  bankRole: WorkspaceRole | null | undefined;
  /** Shown on a phone, where the panel replaces the list. */
  onBack?: () => void;
  /** Move focus to the name when the panel opens (on a phone it replaces the list). */
  focusOnMount: boolean;
  /**
   * Resolves true once saved, false if the confirm step was cancelled; throws on failure.
   * Calls `saving` when the panel itself saves (not while a confirm dialog does).
   */
  onSavePermission: (user: User, to: UserPermissions, saving: () => void) => Promise<boolean>;
  onSaveBankRole: (user: User, to: WorkspaceRole, saving: () => void) => Promise<boolean>;
  onDelete: (user: User) => void;
}

/**
 * One person: who they are, their platform permission, their role in the bank,
 * and delete. Every change is saved on purpose, with its own button.
 *
 * TODO(sc-640): status and freeze, join and last-seen dates, and the change
 * history belong in this panel once the API has them. They are left out rather
 * than faked.
 */
export default function UserDetail({
  user,
  isSelf,
  locked,
  bankRole,
  onBack,
  focusOnMount,
  onSavePermission,
  onSaveBankRole,
  onDelete,
}: UserDetailProps) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // On a phone the panel replaces the list, so focus follows it there.
  useEffect(() => {
    if (focusOnMount && backRef.current?.offsetParent) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <article className={styles.detailCard} aria-labelledby={`${id}-h`}>
      {onBack && (
        <button
          ref={backRef}
          type="button"
          className={cn(styles.button, styles.buttonGhost, styles.backButton)}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" className={styles.buttonIcon} />
          Til baka í lista
        </button>
      )}
      <header className={styles.detailHead}>
        <span className={styles.avatarLg} aria-hidden="true">
          {initials(user.name)}
        </span>
        <div className={styles.detailWho}>
          <h2 id={`${id}-h`} ref={headingRef} tabIndex={-1} className={styles.detailName}>
            {user.name}
            {isSelf && <SelfBadge />}
          </h2>
          <p className={styles.email}>{user.email}</p>
          <p className={styles.detailBadges}>
            <span
              className={cn(
                styles.permBadge,
                user.permissions === "admin" && styles.permBadgeAdmin
              )}
            >
              {PERMISSION_LABEL[user.permissions]}
            </span>
          </p>
        </div>
      </header>

      <Section title="Réttindi" headingId={`${id}-h`}>
        {locked ? (
          <LockedNote>
            <strong>{PERMISSION_LABEL[user.permissions]}.</strong>{" "}
            {isSelf
              ? "Þú getur ekki breytt eigin réttindum. Annar stjórnandi þarf að gera það."
              : "Stjórnendur eru skilgreindir í stillingum kerfisins og þeim er ekki breytt hér."}
          </LockedNote>
        ) : (
          <RoleForm
            key={user.permissions}
            name={user.name}
            legend="Réttindi"
            current={user.permissions}
            options={GRANTABLE_PERMISSIONS}
            label={PERMISSION_LABEL}
            description={PERMISSION_DESCRIPTION}
            submitLabel="Vista réttindi"
            action="permission"
            onSave={(to, saving) => onSavePermission(user, to, saving)}
          />
        )}
      </Section>

      {bankRole !== undefined && (
        <Section title="Aðgangur að dagskrárbanka" headingId={`${id}-h`}>
          {bankRole === "owner" ? (
            <LockedNote>
              <strong>{BANK_ROLE_LABEL.owner}.</strong> Eignarhaldi á bankanum er ekki breytt hér.
            </LockedNote>
          ) : (
            <>
              {bankRole === null && (
                <p className={styles.sectionText}>Ekki með aðgang að bankanum enn.</p>
              )}
              <RoleForm
                key={bankRole ?? "none"}
                name={user.name}
                legend="Aðgangur að dagskrárbanka"
                current={bankRole}
                options={GRANTABLE_BANK_ROLES}
                label={BANK_ROLE_LABEL}
                description={BANK_ROLE_DESCRIPTION}
                submitLabel="Vista aðgang"
                action="bankRole"
                onSave={(to, saving) => onSaveBankRole(user, to, saving)}
              />
            </>
          )}
        </Section>
      )}

      <Section title="Eyða notanda" headingId={`${id}-h`}>
        {isSelf ? (
          <LockedNote>Þú getur ekki eytt eigin aðgangi.</LockedNote>
        ) : (
          <>
            <p className={styles.sectionText}>
              Notandanum er eytt úr Slóða. Ekki er hægt að afturkalla það.
            </p>
            <button
              type="button"
              className={cn(styles.button, styles.buttonDangerQuiet)}
              onClick={() => onDelete(user)}
            >
              Eyða notanda…
            </button>
          </>
        )}
      </Section>
    </article>
  );
}

export function SelfBadge() {
  return <span className={styles.selfBadge}>þú</span>;
}

function Section({
  title,
  headingId,
  children,
}: {
  title: string;
  /** The person's name, so a screen reader hears "Réttindi, Anna Jónsdóttir". */
  headingId: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.detailSection} aria-labelledby={`${id} ${headingId}`}>
      <h3 id={id} className={styles.sectionTitle}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function LockedNote({ children }: { children: ReactNode }) {
  return (
    <div className={styles.lockedNote}>
      <Lock className={styles.lockedIcon} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

/**
 * Radios with a description each, saved with a button: only when something
 * changed (UX rule 6, the button stays enabled and says so otherwise), and
 * with "Hætta við" to drop the change. The parent keys it by the saved value,
 * so a save or an undo starts it fresh.
 */
function RoleForm<Role extends string>({
  name,
  legend,
  current,
  options,
  label,
  description,
  submitLabel,
  action,
  onSave,
}: {
  name: string;
  legend: string;
  current: Role | null;
  options: Role[];
  label: Record<Role, string>;
  description: Record<Role, string>;
  submitLabel: string;
  action: UserAction;
  onSave: (to: Role, saving: () => void) => Promise<boolean>;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const value = draft ?? current;
  const changed = value !== null && value !== current;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!changed || value === null) {
      setNote("Engin breyting til að vista.");
      return;
    }
    setNote(null);
    try {
      if (await onSave(value, () => setBusy(true))) setDraft(null);
    } catch (err) {
      setError(userErrorMessage(err, action));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={styles.roleForm}>
      <fieldset className={styles.radios}>
        <legend className={styles.srOnly}>
          {legend} {name}
        </legend>
        {options.map((option) => (
          <label key={option} className={cn(styles.radio, value === option && styles.radioChecked)}>
            <input
              type="radio"
              name={`${id}-role`}
              value={option}
              checked={value === option}
              onChange={() => {
                setDraft(option);
                setNote(null);
              }}
            />
            <span>
              <span className={styles.radioLabel}>
                {label[option]}
                {option === current && <span className={styles.radioNow}> · núna</span>}
              </span>
              <span className={styles.radioHint}>{description[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <button type="submit" className={cn(styles.button, styles.buttonPrimary)} disabled={busy}>
          {busy ? "Vista…" : submitLabel}
        </button>
        {changed && !busy && (
          <button
            type="button"
            className={cn(styles.button, styles.buttonGhost)}
            onClick={() => setDraft(null)}
          >
            Hætta við
          </button>
        )}
        <p className={styles.formHint} aria-live="polite">
          {changed && current !== null && value !== null
            ? `${label[current]} → ${label[value]}, óvistað`
            : changed && value !== null
              ? `${label[value]}, óvistað`
              : (note ?? "")}
        </p>
      </div>
    </form>
  );
}
