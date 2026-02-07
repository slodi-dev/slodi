"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./header.module.css";
import { useUser } from "@auth0/nextjs-auth0";

const GITHUB_URL = "https://github.com/halldorvalberg/slodi";

export default function Header() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const { user } = useUser();

  return (
    <header className={styles.headerRoot}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.brandLink}>
          Slóði
        </Link>

        {/* Desktop navigation */}
        <nav className={`${styles.primaryNav} ${styles.primaryNavDesktop}`}>
          <Link href="/" className={styles.primaryNavLink}>
            Heim
          </Link>
          <Link href="/about" className={styles.primaryNavLink}>
            Um Slóða
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primaryNavLink}
          >
            Github
          </a>

          {user ? (
            <Link
              href="/dashboard"
              className={styles.primaryNavLink}
            >
              Stjórnborð
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className={styles.primaryNavLink}
              prefetch={false}
            >
              Innskráning
            </Link>
          )
          }
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className={styles.menuToggleButton}
          onClick={openDrawer}
          aria-label="Opna valmynd"
          aria-haspopup="true"
          aria-expanded={isDrawerOpen}
          aria-controls="main-menu-drawer"
        >
          ☰
        </button>

        {/* Drawer overlay */}
        {isDrawerOpen && (
          <div
            className={styles.drawerOverlay}
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer */}
        <aside
          id="main-menu-drawer"
          className={`${styles.drawerPanel} ${isDrawerOpen ? styles.drawerPanelOpen : ""
            }`}
          aria-hidden={!isDrawerOpen}
        >
          <nav className={styles.drawerNav}>
            <Link href="/" className={styles.drawerNavLink} onClick={closeDrawer}>
              Heim
            </Link>
            <Link href="/about" className={styles.drawerNavLink} onClick={closeDrawer}>
              Um Slóða
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.drawerNavLink}
              onClick={closeDrawer}
            >
              Github
            </a>

            {user ? (
              <Link
                href="/dashboard"
                className={styles.drawerNavLink}
                onClick={closeDrawer}
              >
                Stjórnborð
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className={styles.drawerNavLink}
                onClick={closeDrawer}
              >
                Innskráning
              </Link>
            )
            }

          </nav>
        </aside>
      </div>
    </header>
  );
}
