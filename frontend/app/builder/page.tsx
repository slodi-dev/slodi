"use client";

import React, { useMemo, useState } from "react";
import ProgramCard from "@/app/programs/components/ProgramCard";
import styles from "./builder.module.css";
import usePrograms, { Program as ProgramType } from "@/hooks/usePrograms";

export default function BuilderPage() {
    const [query, setQuery] = useState("");
    const [tagFilter, setTagFilter] = useState("all");

    // Use the hook that will fetch from the backend. The hook uses
    // either an array response or `{ programs: Program[] }`.
    const workspaceId = "defaultWorkspace"; // Replace with the actual workspace ID
    const { programs, tags, loading, error } = usePrograms(workspaceId);

    const filtered = useMemo(() => {
        if (!programs) return [] as ProgramType[];
        return (programs as ProgramType[]).filter((p: ProgramType) => {
            if (tagFilter !== "all" && !(p.tags || []).some(tag => tag.name === tagFilter)) return false;
            if (!query) return true;
            const q = query.trim().toLowerCase();
            return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
        });
    }, [programs, query, tagFilter]);

    return (
        <section className="builder-page">
            <header>
                <h1>Vinnubekkurinn</h1>
                <p>Búðu til og skipuleggðu dagskrár.</p>
            </header>

            <div className={styles.container}>
                <aside className={styles.filters} aria-label="Síur">
                    <label>
                        Leit
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Leita í dagskrám" />
                    </label>

                    <label>
                        Flokkur
                        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                            <option value="all">Allt</option>
                            {/* Backend-driven tags (placeholder until API exists) */}
                            {loading ? (
                                <option disabled>Hleður…</option>
                            ) : (
                                (tags || []).map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))
                            )}
                        </select>
                    </label>

                    {error ? <div style={{ color: 'var(--sl-error, #b00020)' }}>Villa við að sækja gögn: {String(error.message || error)}</div> : null}
                </aside>

                <main className={styles.grid}>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ProgramCard key={`placeholder-${i}`} id={`ph-${i}`} name={`Hleður…`} description={undefined} tags={[]} />
                        ))
                    ) : filtered.length === 0 ? (
                        <div>Engar dagskrár fannst fyrir valin skilyrði.</div>
                    ) : (
                        filtered.map((p) => (
                            <ProgramCard
                                key={p.id}
                                id={p.id}
                                name={p.name}
                                description={p.description}
                                tags={p.tags}
                            />
                        ))
                    )}
                </main>
            </div>
        </section>
    );
}
