"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { ArrowRight, ExternalLink, Menu, X } from "lucide-react";
import { useDrawerFocus } from "@/hooks/useDrawerFocus";
import greenLogo from "@/app/icon.svg";
import styles from "./HeaderLab.module.css";

export type HeaderLook =
  | "wordmark"
  | "wordmarkLogo"
  | "band"
  | "bandLogo"
  | "trail"
  | "overlay"
  | "split";

/** The logo looks are variations: they keep every rule of the look they extend. */
const BASE_LOOK: Partial<Record<HeaderLook, HeaderLook>> = {
  wordmarkLogo: "wordmark",
  bandLogo: "band",
};

/** White mark from `public/`. The green one is `app/icon.svg`: `public/logo/slodi-simple-vector.svg` is black. */
const WHITE_LOGO_URL = "/logo/slodi-simple-vector-white.svg";
/** Storybook's Next image plugin hands an image import over as `{ src }`; a plain bundler, as a string. */
const GREEN_LOGO_URL = typeof greenLogo === "string" ? greenLogo : greenLogo.src;

export interface HeaderLabProps {
  /** Which lab variation to render. */
  look: HeaderLook;
  /** Force the auth state. Left out, it follows the Auth0 session like the real header. */
  signedIn?: boolean;
  /** Id of the page's main element. Given, the header starts with a skip link to it. */
  skipTo?: string;
  /** Accessible name of the navigation. Only needs changing when several headers share a page. */
  navLabel?: string;
}

const GITHUB_URL = "https://github.com/halldorvalberg/slodi";

/** The same pages, in the same order, as `components/Header`. */
const PAGES = [
  { href: "/", label: "Heim" },
  { href: "/about", label: "Um Slóða" },
  { href: "/leikir", label: "Leikir" },
] as const;

/** The account action: the dashboard when signed in, login otherwise. */
function accountLink(signedIn: boolean, look: HeaderLook) {
  if (signedIn) return { href: "/dashboard", label: "Stjórnborð" };
  // The split look leads with a verb, because there it is a button.
  return { href: "/auth/login", label: look === "split" ? "Skrá inn" : "Innskráning" };
}

/** A winding dashed trail over faint contour lines, drawn along the bottom of the trail look. */
function TrailMotif() {
  return (
    <svg
      className={styles.motif}
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.contour} d="M0 30 C 200 18, 380 38, 600 26 S 1000 14, 1200 28" />
      <path className={styles.contour} d="M0 38 C 240 28, 420 44, 640 34 S 1020 24, 1200 36" />
      <path
        className={styles.trailPath}
        d="M0 34 C 160 34, 220 20, 380 22 S 640 36, 820 28 S 1080 16, 1200 22"
      />
    </svg>
  );
}

/** Two peaks, the mark in front of the wordmark in the trail look. */
function PeaksMark() {
  return (
    <svg className={styles.peaks} viewBox="0 0 28 18" aria-hidden="true" focusable="false">
      <path d="M1 17 L10 4 L15 11 L19 6 L27 17 Z" />
    </svg>
  );
}

/**
 * The Slóði mark next to the wordmark. `alt=""` because the "Slóði" text beside it already names
 * the link. On the light bar both files are rendered and the theme hides one (CSS); on the band
 * the white mark works in both themes, because the band stays deep green.
 */
/* eslint-disable @next/next/no-img-element -- a small static SVG: next/image does not optimise SVG. */
function BrandLogo({ look }: { look: HeaderLook }) {
  if (look === "bandLogo") {
    return <img className={styles.logo} src={WHITE_LOGO_URL} alt="" width={35} height={32} />;
  }
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

/**
 * Lab copy of `components/Header` with a `look` prop. Same links and the same auth switch;
 * the drawer keeps the real one's keyboard contract (inert when closed, focus held while open).
 */
export default function HeaderLab({
  look,
  signedIn,
  skipTo,
  navLabel = "Aðalvalmynd",
}: HeaderLabProps) {
  const { user } = useUser();
  const isSignedIn = signedIn ?? Boolean(user);
  const pathname = usePathname();
  const account = accountLink(isSignedIn, look);
  const baseLook = BASE_LOOK[look] ?? look;
  const variantClass = baseLook === look ? "" : ` ${styles[look]}`;

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

  const githubLink = (className: string, onClick?: () => void) => (
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

  return (
    <header className={`${styles.header} ${styles[baseLook]}${variantClass}`}>
      {skipTo ? (
        <a className={styles.skipLink} href={`#${skipTo}`}>
          Fara beint í efni
        </a>
      ) : null}
      {look === "trail" ? <TrailMotif /> : null}

      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          {look === "trail" ? <PeaksMark /> : null}
          {baseLook === look ? null : <BrandLogo look={look} />}
          <span className={styles.brandName}>Slóði</span>
          {baseLook === "band" ? <span className={styles.tagline}>Dagskrárvefur skáta</span> : null}
        </Link>

        <nav className={styles.nav} aria-label={navLabel}>
          <ul className={styles.links}>
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className={styles.link} aria-current={current(page.href)}>
                  {page.label}
                </Link>
              </li>
            ))}
            <li>{githubLink(styles.link)}</li>
          </ul>
          <Link
            href={account.href}
            className={styles.account}
            prefetch={isSignedIn ? undefined : false}
          >
            {account.label}
            <ArrowRight className={styles.accountIcon} aria-hidden="true" />
          </Link>
        </nav>

        <div className={styles.phoneBar}>
          {look === "split" ? (
            <Link
              href={account.href}
              className={`${styles.account} ${styles.phoneAccount}`}
              prefetch={isSignedIn ? undefined : false}
            >
              {account.label}
            </Link>
          ) : null}
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
        <nav className={styles.drawerNav} aria-label={navLabel}>
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
            <li>{githubLink(styles.drawerLink, closeDrawer)}</li>
          </ul>
          <Link
            href={account.href}
            className={styles.drawerAccount}
            prefetch={isSignedIn ? undefined : false}
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
