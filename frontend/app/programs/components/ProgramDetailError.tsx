import React from "react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import styles from "./ProgramDetailError.module.css";

interface ProgramDetailErrorProps {
    error: Error;
}

/**
 * Error display component for program detail page
 * Shows a friendly, scout-themed error message with navigation options
 */
export function ProgramDetailError({ error }: ProgramDetailErrorProps) {
    // Check if it's a "not found" type error
    const isNotFound = error.message.includes("not found") ||
        error.message.includes("404") ||
        error.message.includes("Invalid program ID");

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {isNotFound ? (
                    <>
                        <h1 className={styles.title}>404</h1>
                        <h2 className={styles.subtitle}>Úps! Fórstu út fyrir slóðann?</h2>
                        <p className={styles.message}>
                            Þessi dagskrá er víst týnd í skóginum eða hefur verið fjarlægð.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className={styles.title}>Úps!</h1>
                        <h2 className={styles.subtitle}>Eitthvað fór úrskeiðis</h2>
                        <p className={styles.message}>
                            Þetta tjald hefur greinilega fokið í burtu?! Við erum að laga málið.
                        </p>
                        <p className={styles.errorDetail}>{error.message}</p>
                    </>
                )}

                <div className={styles.actions}>
                    <Link href={ROUTES.PROGRAMS} className={styles.primaryButton}>
                        Aftur í dagskrárbankann
                    </Link>
                    <Link href={ROUTES.HOME} className={styles.secondaryButton}>
                        Heim á svæðið
                    </Link>
                </div>
            </div>
        </div>
    );
}