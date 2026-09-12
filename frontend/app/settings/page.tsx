import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import styles from "./settings.module.css";
import Button from "@/components/Button/Button";
import EmailListDownloadButton from "./email-download-service";
import ThemeToggle from "./ThemeToggle";

export const dynamic = "force-dynamic";

const EMAIL_LIST = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter((email) => email.length > 0);

async function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

export default async function SettingsPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    const base = await getBaseUrl();
    const returnTo = encodeURIComponent(`${base}/settings`);
    redirect(`/auth/login?returnTo=${returnTo}`);
  }

  const user = session.user as {
    name?: string;
    email?: string;
    picture?: string;
    sub?: string;
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Stillingar</h1>

      <section className={styles.section} aria-label="Yfirlit aðgangs">
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Aðgangurinn þinn</h2>
          <div className={styles.accountRow}>
            <Avatar src={user.picture} alt={user.name ?? "Notandi"} />
            <div className={styles.accountInfo}>
              <p className={styles.accountName}>{user.name ?? "—"}</p>
              <p className={styles.accountEmail}>{user.email ?? "—"}</p>
            </div>
          </div>

          <div className={styles.auth0Badge}>
            <ShieldCheck className={styles.auth0Icon} aria-hidden="true" />
            <span>Auðkennt með Auth0</span>
          </div>

          <div className={styles.accountActions}>
            <Button as="a" href="/auth/logout" variant="danger" fullWidth>
              Skrá út
            </Button>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Útlit</h2>
          <ThemeToggle />
        </div>

        {EMAIL_LIST.includes(user.email ?? "") && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Stjórnun</h2>
            <div className={styles.actions}>
              <EmailListDownloadButton allowed={true} />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Avatar({ src, alt }: { src?: string; alt: string }) {
  const size = 56;
  if (!src) {
    return (
      <div
        className={styles.avatarFallback}
        style={{ width: size, height: size }}
        aria-label="Engin mynd"
      />
    );
  }
  return (
    <div className={styles.avatar} aria-label="Notendamynd">
      {/* Plain <img>, not next/image, and deliberately so.
          `user.picture` is whatever the identity provider hands us — Google
          serves it from lh3…lh6.googleusercontent.com, and there is also
          Gravatar, Facebook and Auth0's own default avatars. Putting that set
          in `remotePatterns` means either an unbounded allowlist or the
          wildcard that #135 removed on purpose, and the optimiser would be
          proxying and re-encoding an image the provider already delivered at
          the exact size we asked for (`=s96-c`) from its own CDN.
          `referrerPolicy` stays: the provider does not need to know which of
          our pages you are on. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={styles.avatarImg}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
