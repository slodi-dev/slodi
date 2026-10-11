/**
 * Blocks for the "Design system / Tokens" docs page. Everything is computed from
 * `app/slodi-tokens.css` at build time (Vite `?raw` import) — nothing here is a
 * hand-copied value.
 *
 * Swatches paint the *resolved* value for each theme, so the Light and Dark
 * columns are both true regardless of the toolbar theme.
 */
import React, { useMemo } from "react";
import tokensCss from "@/app/slodi-tokens.css?raw";
import {
  buildTokenSet,
  groupOf,
  isHslTriplet,
  THEMES,
  type ResolvedToken,
  type ThemeName,
  type TokenGroup,
} from "./parseTokens";

const tokenSet = buildTokenSet(tokensCss);

const tokensByGroup = (() => {
  const groups = new Map<TokenGroup, string[]>();
  for (const name of tokenSet.names) {
    const light = tokenSet.byTheme.light.get(name) ?? tokenSet.byTheme.dark.get(name);
    const group = groupOf(name, light?.resolved ?? null);
    groups.set(group, [...(groups.get(group) ?? []), name]);
  }
  return groups;
})();

export const tokenCount = tokenSet.names.length;

function supports(property: string, value: string): boolean {
  if (typeof CSS === "undefined" || !CSS.supports) return true;
  return CSS.supports(property, value);
}

const mono: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};

// The transparency checkerboard behind translucent swatches, in the border grey
// of the current theme.
const checkerGrey = "hsl(var(--sl-color-border))";
const checker: React.CSSProperties = {
  backgroundImage: `linear-gradient(45deg,${checkerGrey} 25%,transparent 25%),linear-gradient(-45deg,${checkerGrey} 25%,transparent 25%),linear-gradient(45deg,transparent 75%,${checkerGrey} 75%),linear-gradient(-45deg,transparent 75%,${checkerGrey} 75%)`,
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
};

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        ...mono,
        display: "inline-block",
        marginTop: 4,
        padding: "1px 6px",
        borderRadius: 4,
        background: "hsl(var(--sl-color-error-subtle))",
        color: "hsl(var(--sl-color-error-text))",
      }}
    >
      ⚠ {children}
    </span>
  );
}

function tokenProblem(token: ResolvedToken | undefined): React.ReactNode {
  if (!token) return null;
  if (token.missing.length) return <Problem>undefined: {token.missing.join(", ")}</Problem>;
  return null;
}

function Swatch({ token }: { token: ResolvedToken | undefined }) {
  if (!token) return <span style={mono}>—</span>;
  const value = token.resolved;
  const valid = isHslTriplet(value) && supports("color", `hsl(${value})`);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        title={value ?? "unresolved"}
        style={{
          ...checker,
          width: 44,
          height: 28,
          borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.15)",
          flex: "none",
          overflow: "hidden",
        }}
      >
        {valid && <div style={{ width: "100%", height: "100%", background: `hsl(${value})` }} />}
      </div>
      <div>
        <div style={mono}>{value ?? "—"}</div>
        {tokenProblem(token)}
        {!token.missing.length && !valid && <Problem>not a colour</Problem>}
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} style={{ textAlign: "left" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function namesIn(group: TokenGroup, filter?: (name: string) => boolean): string[] {
  return (tokensByGroup.get(group) ?? []).filter((n) => (filter ? filter(n) : true));
}

/** Colour tokens with a Light and a Dark swatch each. */
export function ColorTable({
  group,
  prefix,
}: {
  group: "primitive-color" | "semantic-color" | "component-color" | "patrol";
  prefix?: string;
}) {
  const names = namesIn(group, prefix ? (n) => n.startsWith(prefix) : undefined);
  return (
    <Table head={["Token", "Light", "Dark"]}>
      {names.map((name) => (
        <tr key={name}>
          <td>
            <code style={{ whiteSpace: "nowrap" }}>{name}</code>
            <div style={{ ...mono, opacity: 0.7 }}>
              {tokenSet.byTheme.light.get(name)?.declared}
            </div>
          </td>
          <td>
            <Swatch token={tokenSet.byTheme.light.get(name)} />
          </td>
          <td>
            <Swatch token={tokenSet.byTheme.dark.get(name)} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Primitive ramps as compact strips: one row per ramp, one chip per step. */
export function PrimitiveRamps() {
  const ramps = new Map<string, string[]>();
  for (const name of namesIn("primitive-color")) {
    const m = name.match(/^--sl-primitive-(.+)-(\d+)$/);
    const ramp = m ? m[1] : name.replace("--sl-primitive-", "");
    ramps.set(ramp, [...(ramps.get(ramp) ?? []), name]);
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {[...ramps].map(([ramp, names]) => (
        <div key={ramp}>
          <div style={{ ...mono, marginBottom: 4 }}>{ramp}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {names.map((name) => {
              const t = tokenSet.byTheme.light.get(name);
              return (
                <div key={name} title={`${name}: ${t?.resolved}`} style={{ width: 64 }}>
                  <div
                    style={{
                      height: 36,
                      borderRadius: 6,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: t?.resolved ? `hsl(${t.resolved})` : undefined,
                    }}
                  />
                  <div style={{ ...mono, fontSize: 10 }}>{name.split("-").pop()}</div>
                  {t?.missing.length ? <Problem>undef</Problem> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Semantic tokens that a named theme overrides, side by side across all five themes. */
export function ThemeMatrix() {
  const overridden = tokenSet.names.filter(
    (name) =>
      name.startsWith("--sl-color-") &&
      THEMES.some(
        (t) =>
          tokenSet.byTheme[t].get(name)?.declared !== tokenSet.byTheme.light.get(name)?.declared
      ) &&
      (["forest-night", "campfire", "northern-lights"] as ThemeName[]).some(
        (t) =>
          tokenSet.byTheme[t].get(name)?.declared !== tokenSet.byTheme.light.get(name)?.declared
      )
  );
  return (
    <Table head={["Token", ...THEMES]}>
      {overridden.map((name) => (
        <tr key={name}>
          <td>
            <code style={{ whiteSpace: "nowrap" }}>{name}</code>
          </td>
          {THEMES.map((t) => (
            <td key={t}>
              <Swatch token={tokenSet.byTheme[t].get(name)} />
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

/** Patrol colours: the base swatch with its foreground, plus the full state ramp. */
export function PatrolColors() {
  const patrols = ["drekar", "falkar", "drott", "rekkar", "rover", "adrir"];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: 12,
      }}
    >
      {patrols.map((p) => {
        const base = tokenSet.byTheme.light.get(`--sl-color-patrol-${p}`)?.resolved;
        const fg = tokenSet.byTheme.light.get(`--sl-color-patrol-${p}-foreground`)?.resolved;
        return (
          <div
            key={p}
            style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, overflow: "hidden" }}
          >
            <div
              style={{
                background: base ? `hsl(${base})` : undefined,
                color: fg ? `hsl(${fg})` : undefined,
                padding: "16px 12px",
                fontWeight: 600,
              }}
            >
              {p}
            </div>
            <div style={{ display: "flex" }}>
              {["subtle", "muted", "hover", "active"].map((state) => {
                const v = tokenSet.byTheme.light.get(`--sl-color-patrol-${p}-${state}`)?.resolved;
                return (
                  <div
                    key={state}
                    title={`--sl-color-patrol-${p}-${state}: ${v}`}
                    style={{ flex: 1, height: 24, background: v ? `hsl(${v})` : undefined }}
                  />
                );
              })}
            </div>
            <div style={{ ...mono, padding: "4px 8px" }}>--sl-color-patrol-{p}</div>
          </div>
        );
      })}
    </div>
  );
}

function ValueTable({
  group,
  sample,
}: {
  group: TokenGroup;
  sample: (value: string, name: string) => React.ReactNode;
}) {
  const names = namesIn(group);
  return (
    <Table head={["Token", "Declared", "Resolved", "Sample"]}>
      {names.map((name) => {
        const t = tokenSet.byTheme.light.get(name);
        return (
          <tr key={name}>
            <td>
              <code style={{ whiteSpace: "nowrap" }}>{name}</code>
            </td>
            <td style={mono}>{t?.declared}</td>
            <td style={mono}>
              {t?.resolved ?? "—"}
              <div>{tokenProblem(t)}</div>
            </td>
            <td>{t?.resolved ? sample(t.resolved, name) : null}</td>
          </tr>
        );
      })}
    </Table>
  );
}

export function SpacingTokens() {
  return (
    <ValueTable
      group="spacing"
      sample={(v) => (
        <div
          style={{
            width: v,
            maxWidth: 320,
            height: 12,
            borderRadius: 2,
            background: "hsl(142 50% 32%)",
          }}
        />
      )}
    />
  );
}

export function RadiusTokens() {
  return (
    <ValueTable
      group="radius"
      sample={(v) => (
        <div
          style={{
            width: 64,
            height: 40,
            borderRadius: v,
            border: "2px solid hsl(142 50% 32%)",
            background: "hsl(142 50% 96%)",
          }}
        />
      )}
    />
  );
}

export function TypographyTokens() {
  return (
    <ValueTable
      group="typography"
      sample={(v, name) => {
        if (/font-size|text-/.test(name) && /rem|px|em|clamp/.test(v))
          return <span style={{ fontSize: v, lineHeight: 1.2 }}>Kötturinn og músin</span>;
        if (/weight/.test(name)) return <span style={{ fontWeight: v }}>Ratleikur um hverfið</span>;
        if (/family/.test(name))
          return <span style={{ fontFamily: v }}>Þórsmörk á ágústkvöldi</span>;
        if (/line-height/.test(name))
          return (
            <span style={{ lineHeight: v, display: "block", maxWidth: 200, fontSize: 12 }}>
              Skátarnir ganga saman upp á heiðina og syngja.
            </span>
          );
        return null;
      }}
    />
  );
}

/** Shadows on both the light and the dark page background, with an invalid-value check. */
export function ShadowTokens() {
  const names = namesIn("shadow");
  const bg = (t: ThemeName) => tokenSet.byTheme[t].get("--sl-color-background")?.resolved;
  const surface = (t: ThemeName) => tokenSet.byTheme[t].get("--sl-color-surface")?.resolved;
  return (
    <Table head={["Token", "Resolved", "Light", "Dark"]}>
      {names.map((name) => (
        <tr key={name}>
          <td>
            <code style={{ whiteSpace: "nowrap" }}>{name}</code>
          </td>
          <td style={{ ...mono, maxWidth: 280 }}>
            {tokenSet.byTheme.light.get(name)?.resolved}
            <div>{tokenProblem(tokenSet.byTheme.light.get(name))}</div>
            {(() => {
              const v = tokenSet.byTheme.light.get(name)?.resolved;
              return v && !supports("box-shadow", v) ? (
                <Problem>invalid box-shadow — the browser drops it (sc-549)</Problem>
              ) : null;
            })()}
          </td>
          {(["light", "dark"] as ThemeName[]).map((t) => {
            const v = tokenSet.byTheme[t].get(name)?.resolved ?? "none";
            return (
              <td key={t} style={{ background: `hsl(${bg(t)})`, padding: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 44,
                    borderRadius: 8,
                    background: `hsl(${surface(t)})`,
                    boxShadow: v,
                  }}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </Table>
  );
}

export function ZIndexTokens() {
  const names = namesIn("z-index")
    .map((name) => ({ name, t: tokenSet.byTheme.light.get(name) }))
    .sort((a, b) => Number(a.t?.resolved ?? 0) - Number(b.t?.resolved ?? 0));
  return (
    <Table head={["Token", "Declared", "Value"]}>
      {names.map(({ name, t }) => (
        <tr key={name}>
          <td>
            <code style={{ whiteSpace: "nowrap" }}>{name}</code>
          </td>
          <td style={mono}>{t?.declared}</td>
          <td style={mono}>
            {t?.resolved}
            <div>{tokenProblem(t)}</div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Everything that is not in one of the groups above (motion, sizes, layout…). */
export function OtherTokens() {
  const names = namesIn("other");
  return (
    <Table head={["Token", "Declared", "Light", "Dark"]}>
      {names.map((name) => (
        <tr key={name}>
          <td>
            <code style={{ whiteSpace: "nowrap" }}>{name}</code>
          </td>
          <td style={mono}>{tokenSet.byTheme.light.get(name)?.declared}</td>
          <td style={mono}>
            {tokenSet.byTheme.light.get(name)?.resolved}
            <div>{tokenProblem(tokenSet.byTheme.light.get(name))}</div>
          </td>
          <td style={mono}>{tokenSet.byTheme.dark.get(name)?.resolved}</td>
        </tr>
      ))}
    </Table>
  );
}

/** A count per group, for the top of the page. */
export function TokenSummary() {
  const rows = useMemo(
    () => [...tokensByGroup].map(([g, names]) => [g, names.length] as const),
    []
  );
  const broken = tokenSet.names.filter((n) =>
    THEMES.some((t) => (tokenSet.byTheme[t].get(n)?.missing.length ?? 0) > 0)
  );
  return (
    <div>
      <p>
        <strong>{tokenCount}</strong> <code>--sl-*</code> tokens parsed from{" "}
        <code>app/slodi-tokens.css</code>:{" "}
        {rows.map(([g, n], i) => (
          <span key={g}>
            {i > 0 && " · "}
            {g} {n}
          </span>
        ))}
      </p>
      {broken.length > 0 && (
        <p>
          <Problem>
            {broken.length} token(s) reference an undeclared name in some theme: {broken.join(", ")}
          </Problem>
        </p>
      )}
    </div>
  );
}
