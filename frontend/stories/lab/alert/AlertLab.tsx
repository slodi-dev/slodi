import React from "react";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import styles from "./AlertLab.module.css";

export type AlertVariant = "success" | "warning" | "error" | "info";
export type AlertStyle = "merki" | "midi" | "bordi" | "lina" | "stimpill";

export interface AlertLabProps {
  /** Which lab variation to render. */
  look: AlertStyle;
  variant?: AlertVariant;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

const ICON = { success: CircleCheck, warning: TriangleAlert, error: CircleX, info: Info };

/** Default label when a variation shows the status as a word and no title is given. */
const LABEL: Record<AlertVariant, string> = {
  success: "Tókst",
  warning: "Athugaðu",
  error: "Villa",
  info: "Til upplýsingar",
};

/**
 * Lab copy of `components/Alert`, same props plus `look`. Same roles as the real one:
 * errors announce assertively, the rest politely.
 */
export default function AlertLab({ look, variant = "info", title, children }: AlertLabProps) {
  const Icon = ICON[variant];
  const role = variant === "error" ? "alert" : "status";
  const cls = `${styles.alert} ${styles[look]} ${styles[variant]}`;

  if (look === "midi") {
    return (
      <div role={role} className={cls}>
        <p className={styles.label}>
          <span className={styles.dot} aria-hidden="true" />
          {title ?? LABEL[variant]}
        </p>
        <div className={styles.body}>{children}</div>
      </div>
    );
  }

  return (
    <div role={role} className={cls}>
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.content}>
        {title ? <p className={styles.title}>{title}</p> : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
