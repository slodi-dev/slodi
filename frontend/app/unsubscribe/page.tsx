"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./unsubscribe.module.css";

type Status = "checking" | "confirm" | "loading" | "success" | "invalid" | "error";

const GENERIC_ERROR = "Ekki tókst að afskrá þig. Reyndu aftur síðar.";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "checking" : "invalid");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Opening the link only checks the token. Unsubscribing waits for the
    // button, because mail scanners and link previewers open links too.
    if (!token) {
      setStatus("invalid");
      setMessage("");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    fetch(`/api/emails/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus("confirm");
          setMessage("");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setStatus(res.status === 400 || res.status === 404 ? "invalid" : "error");
        setMessage(data.error || GENERIC_ERROR);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setMessage(GENERIC_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/emails/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("Netfangið þitt er ekki lengur á póstlistanum okkar.");
      } else {
        const data = await response.json().catch(() => ({}));
        setStatus(response.status === 404 ? "invalid" : "error");
        setMessage(data.error || GENERIC_ERROR);
      }
    } catch {
      setStatus("error");
      setMessage(GENERIC_ERROR);
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
              {status === "checking" ? (
                <div className={styles.loading}>Hleður...</div>
              ) : status === "invalid" ? (
                <p className={styles.description}>
                  Til að afskrá þig skaltu nota hlekkinn neðst í tölvupósti frá okkur. Hver hlekkur
                  virkar aðeins fyrir það netfang sem pósturinn var sendur á.
                </p>
              ) : (
                <>
                  <p className={styles.description}>
                    Komið nóg af tölvupóstum? Smelltu á hnappinn hér að neðan til að afskrá
                    netfangið þitt af póstlistanum okkar. Það var gaman að hafa þig með!
                  </p>

                  <form onSubmit={handleUnsubscribe} className={styles.form}>
                    <button
                      type="submit"
                      className={styles.submitButton}
                      disabled={status === "loading"}
                      aria-describedby={message ? "unsubscribe-message" : undefined}
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
                  </form>
                </>
              )}

              {message && (status === "error" || status === "invalid") && (
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

              <div className={styles.footer}>
                <p className={styles.footerText}>
                  Ef þú átt í vandræðum með að afskrá þig, hafðu samband við okkur á{" "}
                  <a href="mailto:slodi@slodi.is" className={styles.mailtoLink}>
                    slodi@slodi.is
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
