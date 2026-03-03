"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./EmailSignupForm.module.css";

function isValidEmail(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length < 3 || value.length > 320) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export default function EmailSignupForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setStatus("error");
      return setMessage("Vinsamlegast sláðu inn gilt netfang.");
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Takk fyrir að skrá þig á póstlistann!");
        setEmail("");
      } else if (response.status === 409) {
        setStatus("error");
        setMessage("Þetta netfang er þegar á póstlistanum.");
      } else {
        setStatus("error");
        setMessage(data.message || "Ekki tókst að skrá þig á póstlistann. Reyndu aftur síðar.");
      }
    } catch {
      setStatus("error");
      setMessage("Ekki tókst að tengjast. Reyndu aftur síðar.");
    }
  };

  return (
    <section id="email-signup" className={styles.emailSignup} aria-labelledby="signup-heading">
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 id="signup-heading" className={styles.heading}>
            Fylgstu með framvindunni
          </h2>

          <p className={styles.description}>
            Skráðu þig á póstlistann okkar og fáðu uppfærslur um:
          </p>

          <ul className={styles.benefitsList}>
            <li>Nýja eiginleika og útgáfur</li>
            <li>Tækifæri til að taka þátt í þróuninni</li>
            <li>Ábendingar og leiðbeiningar</li>
            <li>Viðburði og námskeið</li>
          </ul>

          <form onSubmit={handleSubmit} className={styles.form} aria-label="Skráning á póstlista">
            <div className={styles.inputGroup}>
              <label htmlFor="email-input" className={styles.visuallyHidden}>
                Netfang
              </label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="netfang@example.is"
                className={styles.input}
                required
                disabled={status === "loading"}
                aria-describedby={message ? "signup-message" : undefined}
              />

              <button
                type="submit"
                className={styles.submitButton}
                disabled={status === "loading"}
                aria-label="Skrá mig á póstlista"
              >
                {status === "loading" ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true"></span>
                    Skrái...
                  </>
                ) : (
                  "Skrá mig"
                )}
              </button>
            </div>

            {message && (
              <div
                id="signup-message"
                className={`${styles.message} ${
                  status === "success" ? styles.messageSuccess : ""
                } ${status === "error" ? styles.messageError : ""}`}
                role="alert"
                aria-live="polite"
              >
                {status === "success" && (
                  <svg
                    className={styles.messageIcon}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {status === "error" && (
                  <svg
                    className={styles.messageIcon}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                <span>{message}</span>
              </div>
            )}
          </form>

          <p className={styles.privacyNote}>
            Við virðum persónuverndina þína. Þú getur alltaf{" "}
            <Link href="/unsubscribe" className={styles.unsubscribeLink}>
              afskráð þig af listanum
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
