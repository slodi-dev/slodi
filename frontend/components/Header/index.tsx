"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState, type MouseEvent } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { ArrowRight, ExternalLink, Menu, X } from "lucide-react";
import { useDrawerFocus } from "@/hooks/useDrawerFocus";
import greenLogo from "@/app/icon.svg";
import styles from "./header.module.css";

/** Id of the page's `<main>`, the target of the header's skip link (ConditionalLayout). */
export const MAIN_CONTENT_ID = "efni";

const GITHUB_URL = "https://github.com/halldorvalberg/slodi";

/** The green mark is the favicon, `app/icon.svg`; `public/logo/slodi-simple-vector.svg` is black. */
const GREEN_LOGO_URL: string = typeof greenLogo === "string" ? greenLogo : greenLogo.src;
const WHITE_LOGO_URL = "/logo/slodi-simple-vector-white.svg";

const PAGES = [
  { href: "/", label: "Heim" },
  { href: "/about", label: "Um Slóða" },
  { href: "/leikir", label: "Leikir" },
] as const;

/** The account action: the dashboard when signed in, login otherwise. */
function accountLink(signedIn: boolean) {
  return signedIn
    ? { href: "/dashboard", label: "Stjórnborð", prefetch: undefined }
    : { href: "/auth/login", label: "Innskráning", prefetch: false };
}

/**
 * The Slóði mark in front of the wordmark: green in light mode, white in dark. Both are
 * rendered and the theme hides one (CSS). `alt=""` because the "Slóði" text beside it already
 * names the link.
 */
/* eslint-disable @next/next/no-img-element -- a small static SVG: next/image does not optimise SVG. */
function BrandLogo() {
  return (
    <>
      <img
        className={`${styles.logo} ${styles.logoForLight}`}
        src={GREEN_LOGO_URL}
        alt=""
        width={35}
        height={32}
      />
      <img
        className={`${styles.logo} ${styles.logoForDark}`}
        src={WHITE_LOGO_URL}
        alt=""
        width={35}
        height={32}
      />
    </>
  );
}
/* eslint-enable @next/next/no-img-element */

function GithubLink({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={onClick}
    >
      Github
      <ExternalLink className={styles.externalIcon} aria-hidden="true" />
      <span className={styles.srOnly}> (opnast í nýjum flipa)</span>
    </a>
  );
}

/**
 * Moves focus to the page's `<main>` instead of following the `#efni` link. Following it
 * scrolls, but not every browser moves keyboard focus to the target (older Safari doesn't),
 * and a `<base>` element would turn it into a page load. Without JavaScript the plain link
 * still works.
 */
function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
  const main = document.getElementById(MAIN_CONTENT_ID);
  if (!main) return;
  event.preventDefault();
  main.focus();
}

/**
 * Top bar for the public pages (landing, Um Slóða, Leikir). Starts with a skip link to the
 * page's main content. On a phone the links move into a drawer: closed it is `inert`, open it
 * is a modal dialog that holds focus until Escape, the close button, the scrim or a link
 * closes it (useDrawerFocus).
 */
export default function Header() {
  const { user } = useUser();
  const pathname = usePathname();
  const account = accountLink(Boolean(user));

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();
  useDrawerFocus({
    open: isDrawerOpen,
    containerRef: drawerRef,
    triggerRef: toggleRef,
    onClose: closeDrawer,
  });

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className={styles.header}>
      <a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`} onClick={skipToMain}>
        Fara beint í efni
      </a>

      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <BrandLogo />
          <span className={styles.brandName}>Slóði</span>
        </Link>

        {/* Desktop navigation. Hidden on a phone, where the drawer's nav takes over, so the
            two navs are never exposed at the same time and can share a name. */}
        <nav className={styles.nav} aria-label="Aðalvalmynd">
          <ul className={styles.links}>
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className={styles.link} aria-current={current(page.href)}>
                  {page.label}
                </Link>
              </li>
            ))}
            <li>
              <GithubLink className={styles.link} />
            </li>
          </ul>
          <Link
            href={account.href}
            className={styles.account}
            prefetch={account.prefetch}
            aria-current={current(account.href)}
          >
            {account.label}
            <ArrowRight className={styles.accountIcon} aria-hidden="true" />
          </Link>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className={styles.menuButton}
          onClick={() => setIsDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isDrawerOpen}
          aria-controls={drawerId}
        >
          <Menu className={styles.menuIcon} aria-hidden="true" />
          <span>Valmynd</span>
        </button>
      </div>

      {isDrawerOpen ? (
        <div className={styles.scrim} onClick={closeDrawer} aria-hidden="true" />
      ) : null}

      <div
        ref={drawerRef}
        id={drawerId}
        className={`${styles.drawer} ${isDrawerOpen ? styles.drawerOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Valmynd"
        inert={!isDrawerOpen}
      >
        <div className={styles.drawerTop}>
          <span className={styles.drawerTitle} aria-hidden="true">
            Slóði
          </span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeDrawer}
            aria-label="Loka valmynd"
          >
            <X className={styles.menuIcon} aria-hidden="true" />
          </button>
        </div>
        <nav className={styles.drawerNav} aria-label="Aðalvalmynd">
          <ul className={styles.drawerLinks}>
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className={styles.drawerLink}
                  aria-current={current(page.href)}
                  onClick={closeDrawer}
                >
                  {page.label}
                </Link>
              </li>
            ))}
            <li>
              <GithubLink className={styles.drawerLink} onClick={closeDrawer} />
            </li>
          </ul>
          <Link
            href={account.href}
            className={styles.drawerAccount}
            prefetch={account.prefetch}
            aria-current={current(account.href)}
            onClick={closeDrawer}
          >
            {account.label}
            <ArrowRight className={styles.accountIcon} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
