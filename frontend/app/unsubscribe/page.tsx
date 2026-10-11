"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./unsubscribe.module.css";

type Status =
  | "checking"
  | "confirm"
  | "loading"
  | "unsubscribed"
  | "already"
  | "resubscribed"
  | "sample"
  | "invalid"
  | "error";

type SubscriptionStatus = { subscribed: boolean; changed: boolean };

const GENERIC_ERROR = "Ekki tókst að afskrá þig. Reyndu aftur síðar.";
const RESUBSCRIBE_ERROR = "Ekki tókst að skrá netfangið aftur. Reyndu aftur síðar.";

/**
 * Test sends to an address that is not on the list link here with this token
 * (backend: SAMPLE_UNSUBSCRIBE_TOKEN), so the footer can be seen working
 * without a subscription behind it.
 */
const SAMPLE_TOKEN = "00000000-0000-0000-0000-000000000000";

const DONE_MESSAGE: Partial<Record<Status, string>> = {
  unsubscribed: "Netfangið þitt er ekki lengur á póstlistanum okkar.",
  already: "Netfangið er þegar afskráð.",
  resubscribed: "Netfangið er aftur komið á póstlistann.",
};

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "checking" : "invalid");
  const [message, setMessage] = useState("");
  const [resubscribing, setResubscribing] = useState(false);

  useEffect(() => {
    // Opening the link only checks the token. Unsubscribing waits for the
    // button, because mail scanners and link previewers open links too.
    if (!token) {
      setStatus("invalid");
      setMessage("");
      return;
    }
    if (token === SAMPLE_TOKEN) {
      setStatus("sample");
      setMessage("");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    fetch(`/api/emails/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setStatus((data as SubscriptionStatus).subscribed ? "confirm" : "already");
          setMessage("");
          return;
        }
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

  const post = async (action: "unsubscribe" | "resubscribe") => {
    const response = await fetch("/api/emails/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "unsubscribe" ? { token } : { token, action }),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setStatus("loading");
    setMessage("");

    try {
      const { response, data } = await post("unsubscribe");
      if (response.ok) {
        // Idempotent: a second click, or the mail app's own one-click button
        // having got there first, is not an error.
        setStatus((data as SubscriptionStatus).changed ? "unsubscribed" : "already");
      } else {
        setStatus(response.status === 404 ? "invalid" : "error");
        setMessage(data.error || GENERIC_ERROR);
      }
    } catch {
      setStatus("error");
      setMessage(GENERIC_ERROR);
    }
  };

  const handleResubscribe = async () => {
    if (!token) return;
    setResubscribing(true);
    setMessage("");

    try {
      const { response, data } = await post("resubscribe");
      if (response.ok) {
        setStatus("resubscribed");
      } else {
        setMessage(data.error || RESUBSCRIBE_ERROR);
      }
    } catch {
      setMessage(RESUBSCRIBE_ERROR);
    } finally {
      setResubscribing(false);
    }
  };

  const isDone = status === "unsubscribed" || status === "already" || status === "resubscribed";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Afskrá af póstlista</h1>

          {isDone ? (
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

              <p className={styles.successMessage} role="status">
                {DONE_MESSAGE[status]}
              </p>

              {status === "resubscribed" ? (
                <p className={styles.description}>
                  Þú færð aftur tölvupóst frá okkur. Hlekkurinn neðst í hverjum pósti afskráir þig
                  hvenær sem er.
                </p>
              ) : (
                <p className={styles.description}>
                  Þú munt ekki lengur fá tölvupóst frá okkur. Ef þetta var óvart geturðu skráð þig
                  aftur hér.
                </p>
              )}

              {message && (
                <div className={styles.errorMessage} role="alert">
                  <span>{message}</span>
                </div>
              )}

              <div className={styles.actions}>
                {status !== "resubscribed" && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => void handleResubscribe()}
                    disabled={resubscribing}
                  >
                    {resubscribing ? "Skrái..." : "Skrá mig aftur"}
                  </button>
                )}
                <Link href="/" className={styles.primaryButton}>
                  Aftur á forsíðu
                </Link>
              </div>
            </div>
          ) : (
            <>
              {status === "checking" ? (
                <div className={styles.loading}>Hleður...</div>
              ) : status === "sample" ? (
                <p className={styles.description}>
                  Þetta er sýnishorn af afskráningarhlekk úr prufupósti. Netfangið er ekki á
                  póstlistanum, svo engu var breytt.
                </p>
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
