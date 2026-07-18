"use client";

import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/Button/Button";
import styles from "./palette.module.css";

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

/** Light / dark toggle — the primary theme control, up top. */
const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  const toggle = () => {
    const root = document.documentElement;
    const next = !isDark;
    root.removeAttribute("data-theme");
    root.classList.toggle("dark", next);
    setIsDark(next);
  };

  return (
    <button
      className={styles.toggle}
      onClick={toggle}
      type="button"
      aria-pressed={isDark}
    >
      {isDark ? "☀️ Ljóst þema" : "🌙 Dökkt þema"}
    </button>
  );
};

/** Full theme selector (incl. the three alternative themes). */
const ThemeSelector: React.FC = () => {
  const [theme, setTheme] = useState("light");

  const themes = [
    { value: "light", label: "☀️ Ljóst", attr: null as string | null },
    { value: "dark", label: "🌙 Dökkt", attr: "dark" },
    { value: "forest-night", label: "🌲 Skóganótt", attr: "forest-night" },
    { value: "campfire", label: "🔥 Bál", attr: "campfire" },
    { value: "northern-lights", label: "✨ Norðurljós", attr: "northern-lights" },
  ];

  const handleChange = (value: string) => {
    const selected = themes.find((t) => t.value === value);
    if (!selected) return;
    const root = document.documentElement;
    root.classList.remove("dark");
    root.removeAttribute("data-theme");
    if (selected.attr === "dark") root.classList.add("dark");
    else if (selected.attr) root.setAttribute("data-theme", selected.attr);
    setTheme(value);
  };

  return (
    <div className={styles.themeSelector}>
      {themes.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => handleChange(t.value)}
          className={cx(styles.themeButton, theme === t.value && styles.themeButtonActive)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

/** Live token inspector — reads computed values in the browser. */
const TokenInspector: React.FC<{
  token: string;
  label: string;
  type?: "color" | "spacing";
}> = ({ token, label, type = "color" }) => {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    setValue(computed.getPropertyValue(token).trim());
  }, [token]);

  return (
    <div className={styles.tokenInspector} ref={ref}>
      <div className={styles.tokenLabel}>{label}</div>
      <div className={styles.tokenDetails}>
        <code className={styles.tokenName}>{token}</code>
        <code className={styles.tokenValue}>{value}</code>
      </div>
      {type === "color" ? (
        <div className={styles.tokenPreview} style={{ background: `hsl(var(${token}))` }} />
      ) : (
        <div className={styles.tokenSpacingPreview}>
          <div className={styles.tokenSpacingBar} style={{ width: `var(${token})` }} />
        </div>
      )}
    </div>
  );
};

const NATURE = [
  { nm: "Mosi · aðallitur", desc: "Aðalaðgerðir", token: "--sl-color-primary" },
  { nm: "Fura · aukalitur", desc: "Aukaáhersla", token: "--sl-color-secondary" },
  { nm: "Birki · bakgrunnur", desc: "Grænleitur hlutlaus", token: "--sl-color-background" },
  { nm: "Yfirborð", desc: "Kort og spjöld", token: "--sl-color-surface" },
  { nm: "Börkur · rammi", desc: "Rammar og skil", token: "--sl-color-border" },
];

const PATROLS = [
  { name: "Drekar", base: "--sl-color-patrol-drekar", fg: "--sl-color-patrol-drekar-foreground" },
  { name: "Fálkar", base: "--sl-color-patrol-falkar", fg: "--sl-color-patrol-falkar-foreground" },
  { name: "Drótt", base: "--sl-color-patrol-drott", fg: "--sl-color-patrol-drott-foreground" },
  { name: "Rekkar", base: "--sl-color-patrol-rekkar", fg: "--sl-color-patrol-rekkar-foreground" },
  { name: "Róver", base: "--sl-color-patrol-rover", fg: "--sl-color-patrol-rover-foreground" },
  { name: "Aðrir", base: "--sl-color-patrol-adrir", fg: "--sl-color-patrol-adrir-foreground" },
];

const STATES = [
  { key: "sSuccess", label: "Árangur", aaa: "AAA 8.3", demo: "Dagskráin var vistuð." },
  { key: "sWarning", label: "Aðvörun", aaa: "AAA 7.3", demo: "Sumar breytingar eru óvistaðar." },
  { key: "sError", label: "Villa", aaa: "AAA 7.3", demo: "Ekki tókst að vista. Reyndu aftur." },
  { key: "sInfo", label: "Upplýsingar", aaa: "AAA 7.7", demo: "Þú ert að skoða drög." },
] as const;

const TIERS = [
  { cls: "tPrimary", text: "Aðaltexti — fyrirsagnir og áhersla", aaa: "AAA 15.6" },
  { cls: "tSecondary", text: "Aukatexti — meginmál og lýsingar", aaa: "AAA 7.4" },
  { cls: "tTertiary", text: "Þriðji texti — myndatextar og vísbendingar", aaa: "AAA 7.4" },
] as const;

const TYPE = [
  { tag: "heading-1", cls: "tH1", sample: "Aðalfyrirsögn" },
  { tag: "heading-2", cls: "tH2", sample: "Undirfyrirsögn" },
  { tag: "heading-3", cls: "tH3", sample: "Þriðja stig" },
  { tag: "body-lg", cls: "tBl", sample: "Stór meginmálstexti" },
  { tag: "body", cls: "tB", sample: "Venjulegur meginmálstexti" },
  { tag: "body-sm", cls: "tBs", sample: "Lítill meginmálstexti" },
  { tag: "caption", cls: "tCap", sample: "Myndatexti og skýringar" },
] as const;

const SPACING = [
  { tag: "compact", px: "4px", token: "--sl-spacing-compact" },
  { tag: "inline", px: "8px", token: "--sl-spacing-inline" },
  { tag: "element", px: "16px", token: "--sl-spacing-element" },
  { tag: "component", px: "24px", token: "--sl-spacing-component" },
  { tag: "container", px: "64px", token: "--sl-spacing-container" },
  { tag: "section", px: "96px", token: "--sl-spacing-section" },
];

const patrolStyle = (base: string, fg: string) => ({
  background: `hsl(var(${base}))`,
  color: `hsl(var(${fg}))`,
});

export default function PalettePage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <ThemeToggle />
          </div>
          <p className={styles.eyebrow}>Litakerfi · íhlutir · hönnunartákn</p>
          <h1 className={styles.title}>
            Byggt í <span className={styles.accent}>grænu</span>,
            <br />
            fetað eftir slóðanum.
          </h1>
          <p className={styles.lede}>
            Ein miðlæg síða fyrir litakerfi Slóða og íhlutasafnið. Litirnir eiga rætur í
            íslenskri víðerni — mosa, furu og birki — valdir til að vera mjúkir á augað og
            standast AAA-aðgengisstaðal.
          </p>
          <div className={styles.heroAnchor}>
            {NATURE.slice(0, 4).map((c) => (
              <div key={c.token} className={styles.anchorChip}>
                <div className={styles.sw} style={{ background: `hsl(var(${c.token}))` }} />
                <span className={styles.nm}>{c.nm.split(" · ")[0]}</span>
                <span className={styles.hx}>{c.token}</span>
              </div>
            ))}
          </div>
          <ThemeSelector />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.spine}>
          {/* 00 — token architecture */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>00 — Kerfið</span>
              <h2 className={styles.secTitle}>Þriggja þrepa tákn</h2>
              <p className={styles.secSub}>
                Frá hráum gildum upp í íhluti. Frumefni skilgreina, merkingartákn gefa samhengi,
                íhlutatákn beita þeim — hvert þrep vísar í það fyrir neðan.
              </p>
            </div>
            <div className={styles.tiers}>
              <div className={styles.tierCard}>
                <span className={styles.k}>Þrep 1 · Frumefni</span>
                <h3>Primitives</h3>
                <p>Hrá gildi, samhengislaus. Aldrei notuð beint.</p>
                <code>--sl-primitive-green-500: 142 50% 42%</code>
              </div>
              <div className={styles.tierCard}>
                <span className={styles.k}>Þrep 2 · Merking</span>
                <h3>Semantics</h3>
                <p>Samhengismeðvituð tákn sem vísa í frumefni.</p>
                <code>--sl-color-primary: var(--sl-primitive-green-500)</code>
              </div>
              <div className={styles.tierCard}>
                <span className={styles.k}>Þrep 3 · Íhlutir</span>
                <h3>Components</h3>
                <p>Íhlutatengd tákn sem vísa í merkingu.</p>
                <code>--sl-button-background-primary: var(--sl-color-primary)</code>
              </div>
            </div>
          </section>

          {/* 01 — nature palette */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>01 — Grunnur</span>
              <h2 className={styles.secTitle}>Náttúrulitirnir</h2>
              <p className={styles.secSub}>
                Grænn kjarni og hlutlausir tónar sem bera fínlegan grænan undirtón — svo öll fletir
                tilheyra sömu fjölskyldu í stað þess að vera kaldur grár.
              </p>
            </div>
            <div className={cx(styles.grid, styles.gNature)}>
              {NATURE.map((c) => (
                <div key={c.token} className={styles.swatch}>
                  <div className={styles.fill} style={{ background: `hsl(var(${c.token}))` }} />
                  <div className={styles.meta}>
                    <div className={styles.nm}>{c.nm}</div>
                    <div className={styles.desc}>{c.desc}</div>
                    <div className={styles.tok}>{c.token}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 02 — semantic states */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>02 — Merking</span>
              <h2 className={styles.secTitle}>Merkingarstaðir</h2>
              <p className={styles.secSub}>
                Árangur, aðvörun, villa og upplýsingar. Hver tónn er dempaður fyrir augað og textinn
                stenst AAA (7:1) á sínum bakgrunni.
              </p>
            </div>
            <div className={cx(styles.grid, styles.gState)}>
              {STATES.map((s) => (
                <div key={s.key} className={cx(styles.state, styles[s.key])}>
                  <div className={styles.band}>
                    <span className={styles.lbl}>{s.label}</span>
                    <span className={styles.aaa}>{s.aaa}</span>
                  </div>
                  <div className={styles.demo}>{s.demo}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 03 — patrol colors */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>03 — Sveitir</span>
              <h2 className={styles.secTitle}>Sveitalitir</h2>
              <p className={styles.secSub}>
                Sex fastir einkennislitir skátasveitanna — óbreyttir, enda hluti af sjálfsmynd
                hverrar sveitar.
              </p>
            </div>
            <div className={cx(styles.grid, styles.gPatrol)}>
              {PATROLS.map((p) => (
                <div key={p.name} className={styles.swatch}>
                  <div className={styles.fill} style={{ background: `hsl(var(${p.base}))` }} />
                  <div className={styles.meta}>
                    <div className={styles.nm}>{p.name}</div>
                    <div className={styles.tok}>{p.base}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 04 — text hierarchy */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>04 — Texti</span>
              <h2 className={styles.secTitle}>Textastigveldi</h2>
              <p className={styles.secSub}>
                Fjögur þrep af lestexta og tenglar — öll yfir AAA-mörkum á grænleitum bakgrunni.
              </p>
            </div>
            <div className={styles.textTiers}>
              {TIERS.map((t) => (
                <div key={t.cls} className={styles.tier}>
                  <span className={cx(styles.t1, styles[t.cls])}>{t.text}</span>
                  <span className={styles.aaa}>{t.aaa}</span>
                </div>
              ))}
              <div className={styles.tier}>
                <a className={cx(styles.t1, styles.tLink)} href="#">
                  Tengill — djúpur skógargrænn
                </a>
                <span className={styles.aaa}>AAA 7.1</span>
              </div>
            </div>
          </section>

          {/* 05 — type scale */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>05 — Letur</span>
              <h2 className={styles.secTitle}>Leturstigi</h2>
              <p className={styles.secSub}>
                Roboto Condensed í gegn — sterk andstæða milli fyrirsagna og meginmáls.
              </p>
            </div>
            <div className={styles.typeScale}>
              {TYPE.map((t) => (
                <div key={t.tag} className={styles.typeRow}>
                  <span className={styles.tag}>{t.tag}</span>
                  <span className={styles[t.cls]}>{t.sample}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 06 — spacing */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>06 — Bil</span>
              <h2 className={styles.secTitle}>Bilakvarði</h2>
              <p className={styles.secSub}>4px grunnkvarði fyrir samræmt rými.</p>
            </div>
            <div className={styles.spaceRows}>
              {SPACING.map((s) => (
                <div key={s.tag} className={styles.spaceRow}>
                  <span className={styles.tag}>{s.tag}</span>
                  <span className={styles.bar} style={{ width: `var(${s.token})` }} />
                  <span className={styles.px}>{s.px}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 07 — elevation */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>07 — Hæð</span>
              <h2 className={styles.secTitle}>Skuggar og hæð</h2>
              <p className={styles.secSub}>
                Fimm þrep af hæð — frá fínlegum hnappaskugga upp í svífandi glugga.
              </p>
            </div>
            <div className={styles.elevGrid}>
              {["e1", "e2", "e3", "e4", "e5"].map((e, i) => (
                <div key={e} className={cx(styles.elev, styles[e])}>
                  {["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"][i]}
                </div>
              ))}
            </div>
          </section>

          {/* 08 — component library */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>08 — Íhlutasafn</span>
              <h2 className={styles.secTitle}>Íhlutasafnið</h2>
              <p className={styles.secSub}>
                Raunverulegir íhlutir kerfisins, teiknaðir með tákunum hér að ofan — ein miðlæg síða
                til að skoða liti og íhluti saman.
              </p>
            </div>
            <div className={styles.compCard}>
              <div className={styles.compGroup}>
                <p className={styles.compLabel}>Hnappar · sex tilbrigði</p>
                <div className={styles.compRow}>
                  <Button variant="primary">Aðalhnappur</Button>
                  <Button variant="secondary">Aukahnappur</Button>
                  <Button variant="muted">Afrita</Button>
                  <Button variant="danger">Eyða</Button>
                  <Button variant="ghost">Til baka</Button>
                  <Button variant="info">Nánar</Button>
                </div>
              </div>

              <div className={styles.compGroup}>
                <p className={styles.compLabel}>Innsláttarreitir</p>
                <div className={styles.compRow} style={{ gap: "0.75rem" }}>
                  <input className={styles.field} type="text" placeholder="Leitaðu að dagskrá…" />
                  <input
                    className={cx(styles.field, styles.fieldFocus)}
                    type="text"
                    defaultValue="Í fókus"
                  />
                  <input className={styles.field} type="text" placeholder="Óvirkur" disabled />
                </div>
              </div>

              <div className={styles.compGroup}>
                <p className={styles.compLabel}>Tilkynningar</p>
                <div
                  className={styles.compRow}
                  style={{ flexDirection: "column", alignItems: "stretch", gap: "0.6rem" }}
                >
                  {STATES.map((s) => (
                    <div key={s.key} className={cx(styles.state, styles[s.key])}>
                      <div className={styles.demo}>{s.demo}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.compGroup}>
                <p className={styles.compLabel}>Merki og flögur</p>
                <div className={styles.compRow}>
                  <span className={styles.badge}>Nýtt</span>
                  <span className={styles.chip}>
                    Aldur: 8–12{" "}
                    <button type="button" aria-label="Fjarlægja">
                      ×
                    </button>
                  </span>
                  {PATROLS.slice(0, 4).map((p) => (
                    <span
                      key={p.name}
                      className={styles.patrolBadge}
                      style={patrolStyle(p.base, p.fg)}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.compGroup}>
                <p className={styles.compLabel}>Spjald og niðurfellanlegur hluti</p>
                <div
                  className={styles.compRow}
                  style={{ alignItems: "flex-start", gap: "1.25rem" }}
                >
                  <article className={styles.pcard}>
                    <div className={styles.cover} />
                    <div className={styles.pbody}>
                      <h4>Ratleikur í skóginum</h4>
                      <p>Skátarnir feta sig eftir merktum slóða og leysa þrautir á leiðinni.</p>
                      <div className={styles.compRow} style={{ gap: "0.4rem" }}>
                        {PATROLS.slice(0, 2).map((p) => (
                          <span
                            key={p.name}
                            className={styles.patrolBadge}
                            style={patrolStyle(p.base, p.fg)}
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                  <div className={styles.collapse}>
                    <div className={styles.collapseRow}>
                      Aldur <span className={styles.count}>2</span>
                    </div>
                    <div className={styles.collapseRow} style={{ borderBottom: 0 }}>
                      Flokkur
                    </div>
                    <label className={styles.checkRow}>
                      <input type="checkbox" defaultChecked /> Drekar
                    </label>
                    <label className={styles.checkRow}>
                      <input type="checkbox" /> Fálkar
                    </label>
                    <label className={styles.checkRow} style={{ paddingBottom: "0.75rem" }}>
                      <input type="checkbox" /> Drótt
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.compGroup}>
                <p className={styles.compLabel}>Gluggi (modal)</p>
                <div className={styles.modalStage}>
                  <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dlg-t">
                    <div className={styles.dhead}>
                      <h4 id="dlg-t">Eyða dagskrá?</h4>
                      <button className={styles.x} type="button" aria-label="Loka">
                        ×
                      </button>
                    </div>
                    <p>Þessi aðgerð er óafturkræf.</p>
                    <div className={styles.acts}>
                      <Button variant="ghost">Hætta við</Button>
                      <Button variant="danger">Eyða</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Live token inspector */}
          <section className={styles.section}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>09 — Rauntími</span>
              <h2 className={styles.secTitle}>Táknaskoðari</h2>
              <p className={styles.secSub}>Reiknuð gildi tákna í rauntíma — uppfærast með þemanu.</p>
            </div>
            <div className={cx(styles.grid, styles.gPatrol)}>
              <TokenInspector token="--sl-color-primary" label="Aðallitur" type="color" />
              <TokenInspector token="--sl-color-background" label="Bakgrunnur" type="color" />
              <TokenInspector token="--sl-spacing-component" label="Íhlutabil" type="spacing" />
            </div>
          </section>

          <p className={styles.foot}>Slóði · litakerfi byggt í grænu · AAA-aðgengi</p>
        </div>
      </main>
    </div>
  );
}
