"use client";

import styles from "./page.module.css";
import HeroSection from "./(landing)/components/HeroSection";
import EmailSignupForm from "./(landing)/components/EmailSignupForm";
import { useApiHealth } from "@/hooks/useApiHealth";
import { scrollToElement } from "@/utils/scroll";
import { ApiHealthIndicator } from "@/components/ApiHealthIndicator/ApiHealthIndicator";

/**
 * Home page - Landing page for Slóði
 * Includes hero section, feature overview, and email signup
 */
export default function Home() {
  // Check API health on mount (logs to console)
  useApiHealth();

  const scrollToEmailSignup = () => {
    scrollToElement("#email-signup");
  };

  return (
    <div className={styles.page}>
      {/* Only shown in development */}
      <ApiHealthIndicator />

      <HeroSection onEmailSignupClick={scrollToEmailSignup} />
      <EmailSignupForm />
    </div>
  );
}
