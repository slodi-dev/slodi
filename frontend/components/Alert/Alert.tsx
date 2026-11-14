import React from "react";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import styles from "./Alert.module.css";

type AlertVariant = "success" | "warning" | "error" | "info";

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  /** Optional heading rendered above the message. */
  title?: React.ReactNode;
}

const ICON = { success: CircleCheck, warning: TriangleAlert, error: CircleX, info: Info };

/**
 * Notification banner in four states — success, warning, error, info — drawn as a dashed
 * "stamp" with a status icon (picked in Lab/Alert, 2026-10-19). Colours resolve through the
 * --sl-alert-* token tier. Errors announce assertively (role="alert"), the rest politely
 * (role="status").
 */
export default function Alert({
  variant = "info",
  title,
  role,
  className,
  children,
  ...rest
}: AlertProps) {
  const Icon = ICON[variant];
  const classes = [styles.alert, styles[`alert--${variant}`], className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div role={role ?? (variant === "error" ? "alert" : "status")} className={classes} {...rest}>
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.content}>
        {title ? <p className={styles.alertTitle}>{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
