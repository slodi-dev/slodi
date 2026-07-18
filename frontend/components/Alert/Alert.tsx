import React from "react";
import styles from "./Alert.module.css";

type AlertVariant = "success" | "warning" | "error" | "info";

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  /** Optional bold heading rendered above the message. */
  title?: React.ReactNode;
}

/**
 * Notification banner in four states — success, warning, error, info.
 * Mirrors the Alerts design-system spec; colours resolve through the
 * --sl-alert-* token tier. Errors announce assertively (role="alert"),
 * the rest politely (role="status").
 */
export default function Alert({
  variant = "info",
  title,
  role,
  className,
  children,
  ...rest
}: AlertProps) {
  const classes = [styles.alert, styles[`alert--${variant}`], className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={classes}
      {...rest}
    >
      {title ? <p className={styles.alertTitle}>{title}</p> : null}
      {children}
    </div>
  );
}
