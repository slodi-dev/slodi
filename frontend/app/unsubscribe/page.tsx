"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./unsubscribe.module.css";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check if email is provided in URL parameters
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Vinsamlegast sláðu inn gilt netfang.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/emails/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("Netfangið þitt er ekki lengur á póstlistanum okkar.");
      } else {
        const data = await response.json();
        setStatus("error");
        setMessage(data.error || "Ekki tókst að afskrá þig. Reyndu aftur síðar.");
      }
    } catch {
      setStatus("error");
      setMessage("Ekki tókst að afskrá þig. Reyndu aftur síðar.");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Afskrá af póstlista</h1>

          {status === "success" ? (
            <div className={styles.successContent}>
              <div className={styles.successIcon} aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <p className={styles.successMessage}>{message}</p>

              <p className={styles.description}>
                Þú munt ekki lengur fá tölvupóst frá okkur. Ef þú skiptir um skoðun geturðu alltaf
                skráð þig aftur á póstlistann.
              </p>

              <div className={styles.actions}>
                <Link href="/" className={styles.primaryButton}>
                  Aftur á forsíðu
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.description}>
                Komið nóg af tölvupóstum? Sláðu inn netfangið þitt hér að neðan til að afskrá þig af
                póstlistanum okkar. Það var gaman að hafa þig með!
              </p>

              <form onSubmit={handleUnsubscribe} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email-input" className={styles.label}>
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
                    aria-describedby={message ? "unsubscribe-message" : undefined}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={status === "loading"}
                >
                  {status === "loading" ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true"></span>
                      Afskrái...
                    </>
                  ) : (
                    "Afskrá mig"
                  )}
                </button>

                {message && status === "error" && (
                  <div
                    id="unsubscribe-message"
                    className={styles.errorMessage}
                    role="alert"
                    aria-live="polite"
                  >
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
                    <span>{message}</span>
                  </div>
                )}
              </form>

              <div className={styles.footer}>
                <p className={styles.footerText}>
                  Ef þú átt í vandræðum með að afskrá þig, hafðu samband við okkur á{" "}
                  <a href="mailto:slodi@skatarnir.is" className={styles.mailtoLink}>
                    slodi@skatarnir.is
                  </a>
                  .
                </p>
                <Link href="/" className={styles.backLink}>
                  Aftur á forsíðu
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.card}>
              <div className={styles.loading}>Hleður...</div>
            </div>
          </div>
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
