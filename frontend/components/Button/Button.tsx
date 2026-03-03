"use client";

import React from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "muted" | "danger" | "ghost" | "info";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  as?: "button" | "a";
  href?: string;
}

/**
 * Unified system Button
 * Uses global palette tokens for consistent design.
 */
export default function Button({
  variant = "primary",
  fullWidth = false,
  as = "button",
  href,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[`btn--${variant}`],
    fullWidth ? styles["btn--full"] : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return as === "a" ? (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)} className={classes}>
      {children}
    </a>
  ) : (
    <button
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      type={rest.type ?? "button"}
      className={classes}
    >
      {children}
    </button>
  );
}

/* 
import Button from "./components/Button";

export default function Demo() {
  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="muted">Muted</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="ghost">Ghost</Button>

      <Button as="a" href="/dashboard" variant="primary">
        Link as Button
      </Button>

      <Button variant="primary" disabled>
        Disabled
      </Button>
    </div>
  );
}
*/
