import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { Banner, Card, Heading, Icon, IconBadge, Label, Reveal, Sub } from "../components/ui";
import { CLAMP, dimmed, EASE, prog, spotlight } from "../lib/anim";
import type { Item, Panel } from "../content/types";
import { alpha, GOOD, INK, MUTED, SANS, SERIF, toneColor } from "../lib/theme";
import type { Cues } from "../lib/timing";
import { getSpec, SceneProps, SceneShell, useScene } from "./shared";

// ─────────────── Grid of cards ───────────────
const gridSizes = (cols: number, rows: number) => {
  if (rows > 1 && cols >= 4) return { icon: 84, label: 36, sub: 27, pad: 26, gap: 16 };
  if (rows > 1) return { icon: 100, label: 42, sub: 30, pad: 30, gap: 20 };
  if (cols >= 5) return { icon: 104, label: 38, sub: 29, pad: 30, gap: 22 };
  if (cols === 4) return { icon: 124, label: 44, sub: 31, pad: 34, gap: 24 };
  return { icon: 144, label: 52, sub: 33, pad: 40, gap: 28 };
};

export const GridLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "grid");
  const { frame, cues, color, kicker } = useScene(spec);
  const cols = spec.columns ?? Math.min(4, spec.items.length);
  const rows = Math.ceil(spec.items.length / cols);
  const s = gridSizes(cols, rows);
  const starts = spec.items.map((it, i) => cues.at(it.at, 20 + i * 8));
  const lastAt = spec.items[spec.items.length - 1].at;
  const release = lastAt ? cues.end(lastAt) + 8 : 0;
  const spots = spotlight(frame, starts, release);
  const top = spec.sub ? 330 : 300;
  const bottom = spec.banner ? 800 : rows > 1 ? 900 : 880;
  const gap = rows > 1 ? 28 : 36;
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      {spec.sub ? (
        <Reveal at={cues.at(spec.sub.at)} dy={14} style={{ position: "absolute", top: 268, left: 120 }}>
          <Sub style={{ fontSize: 34 }}>{spec.sub.text}</Sub>
        </Reveal>
      ) : null}
      <div
        style={{
          position: "absolute",
          top,
          height: bottom - top,
          left: 120,
          right: 120,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: rows > 1 ? "1fr" : undefined,
          alignContent: "center",
          gap,
        }}
      >
        {spec.items.map((item, i) => (
          <Reveal key={item.label} at={starts[i]} dy={50} scale style={{ height: rows > 1 ? "100%" : undefined }}>
            <Card
              accent={color}
              active={spots[i]}
              style={{
                height: rows > 1 ? "100%" : undefined,
                minHeight: rows > 1 ? undefined : 380,
                padding: s.pad,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: s.gap,
                opacity: dimmed(spots[i], frame, release),
                boxSizing: "border-box",
              }}
            >
              <IconBadge name={item.icon} color={color} size={s.icon} glow={spots[i]} />
              <Label size={s.label}>{item.label}</Label>
              {item.sub ? <Sub style={{ fontSize: s.sub }}>{item.sub}</Sub> : null}
            </Card>
          </Reveal>
        ))}
      </div>
      {spec.banner ? <Banner text={spec.banner.text} at={cues.at(spec.banner.at)} color={color} style={{ top: 836 }} /> : null}
    </SceneShell>
  );
};

// ─────────────── Two panels side by side ───────────────
const PanelView: React.FC<{
  panel: Panel;
  cues: Cues;
  frame: number;
  accent: string;
  active: number;
  release: number;
  height: number;
}> = ({ panel, cues, frame, accent, active, release, height }) => {
  const c = toneColor(panel.tone, accent);
  const start = cues.at(panel.at);
  const own = panel.items.filter((i) => i.at);
  const spread = panel.items.filter((i) => !i.at);
  const itemAt = (item: Item) => (item.at ? cues.at(item.at) : cues.spread(panel.at, spread.indexOf(item) + 1, spread.length + 1));
  const itemSpots = spotlight(
    frame,
    own.map((i) => cues.at(i.at)),
    release,
  );
  return (
    <Reveal at={start} dy={50} style={{ flex: 1 }}>
      <Card accent={c} active={active} style={{ height, padding: "40px 46px", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: c, opacity: 0.85, borderRadius: "28px 28px 0 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 30 }}>
          <IconBadge name={panel.icon} color={c} size={100} glow={active} />
          <div>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: panel.title.length > 14 ? 54 : 62, color: INK, lineHeight: 1.05 }}>{panel.title}</div>
            {panel.sub ? <Sub style={{ fontSize: 30, marginTop: 6 }}>{panel.sub}</Sub> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: panel.items.length > 3 ? 12 : 20 }}>
          {panel.items.map((item) => {
            const oi = own.indexOf(item);
            const a = oi >= 0 ? itemSpots[oi] : 0;
            return (
              <Reveal key={item.label} at={itemAt(item)} dx={-30} dy={0}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    padding: panel.items.length > 3 ? "10px 20px" : "12px 20px",
                    borderRadius: 18,
                    background: a > 0 ? alpha(c, 0.14 * a) : "rgba(255,255,255,0.035)",
                    border: `1px solid ${a > 0 ? alpha(c, 0.5 * a) : "rgba(255,255,255,0.06)"}`,
                    opacity: oi >= 0 ? dimmed(a, frame, release) : 1,
                  }}
                >
                  <Icon name={item.icon} size={44} color={c} />
                  <Label size={38} style={{ fontWeight: 600 }}>
                    {item.label}
                  </Label>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Card>
    </Reveal>
  );
};

export const SplitLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "split");
  const { frame, cues, color, kicker } = useScene(spec);
  const la = cues.at(spec.left.at);
  const ra = cues.at(spec.right.at);
  const lastIds = [...spec.left.items, ...spec.right.items].map((i) => i.at).filter(Boolean) as string[];
  const lastLine = lastIds.length ? lastIds.reduce((a, b) => (cues.end(a) > cues.end(b) ? a : b)) : spec.right.at;
  const release = Math.max(cues.end(spec.right.at), cues.end(lastLine)) + 8;
  const [ls, rs] = spotlight(frame, [la, ra], release);
  const height = spec.banner ? 515 : 590;
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 296, left: 120, right: 120, display: "flex", gap: 60, alignItems: "stretch" }}>
        <PanelView panel={spec.left} cues={cues} frame={frame} accent={color} active={ls} release={release} height={height} />
        <Reveal at={ra - 4} dy={0} scale style={{ alignSelf: "center" }}>
          <div style={{ fontFamily: SERIF, fontSize: 48, color: MUTED, fontStyle: "italic" }}>vs</div>
        </Reveal>
        <PanelView panel={spec.right} cues={cues} frame={frame} accent={color} active={rs} release={release} height={height} />
      </div>
      {spec.banner ? <Banner text={spec.banner.text} at={cues.at(spec.banner.at)} color={color} style={{ top: 842 }} /> : null}
    </SceneShell>
  );
};

// ─────────────── Flow / chain of nodes ───────────────
const Arrow: React.FC<{ p: number; color: string; width: number }> = ({ p, color, width }) => (
  <svg width={width} height={60} style={{ flexShrink: 0, overflow: "visible" }}>
    <line x1={6} y1={30} x2={6 + (width - 24) * p} y2={30} stroke={color} strokeWidth={4} strokeLinecap="round" />
    {p > 0.95 ? <path d={`M ${width - 30} 16 L ${width - 8} 30 L ${width - 30} 44`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
  </svg>
);

export const FlowLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "flow");
  const { frame, cues, color, kicker } = useScene(spec);
  const n = spec.nodes.length;
  const starts = spec.nodes.map((node) => {
    const same = spec.nodes.filter((x) => x.at === node.at);
    return same.length > 1 ? cues.spread(node.at!, same.indexOf(node), same.length) : cues.at(node.at);
  });
  const release = cues.end(spec.nodes[n - 1].at!) + 6;
  const spots = spotlight(frame, starts, release);
  const arrowW = n >= 4 ? 90 : 130;
  const cardW = n >= 4 ? 330 : 420;
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div
        style={{
          position: "absolute",
          top: 300,
          bottom: spec.footer ? 270 : 160,
          left: 80,
          right: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {spec.nodes.map((node, i) => (
          <React.Fragment key={node.label}>
            {i > 0 ? <Arrow p={prog(frame, starts[i] - 10, 18)} color={alpha(color, 0.8)} width={arrowW} /> : null}
            <Reveal at={starts[i]} dy={40} scale>
              <Card
                accent={color}
                active={spots[i]}
                style={{
                  width: cardW,
                  minHeight: 360,
                  padding: "40px 26px 32px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 20,
                  opacity: dimmed(spots[i], frame, release),
                }}
              >
                {node.tag ? (
                  <div
                    style={{
                      position: "absolute",
                      top: -22,
                      padding: "6px 20px",
                      borderRadius: 999,
                      background: color,
                      color: "#0A0D18",
                      fontFamily: SANS,
                      fontWeight: 800,
                      fontSize: 24,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {node.tag}
                  </div>
                ) : null}
                <IconBadge name={node.icon} color={color} size={130} glow={spots[i]} />
                <Label size={40}>{node.label}</Label>
                {node.sub ? <Sub style={{ fontSize: 29 }}>{node.sub}</Sub> : null}
              </Card>
            </Reveal>
          </React.Fragment>
        ))}
      </div>
      {spec.footer ? <Banner text={spec.footer.text} at={cues.at(spec.footer.at)} color={color} style={{ top: 836 }} /> : null}
    </SceneShell>
  );
};

// ─────────────── Equation ───────────────
export const EquationLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "equation");
  const { frame, cues, color, kicker } = useScene(spec);
  const hasTerm = Boolean(spec.term);
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      {spec.term ? (
        <Reveal at={cues.at(spec.term.at)} dy={30} style={{ position: "absolute", top: 300, left: 220, right: 220 }}>
          <Card accent={color} active={0.6} style={{ padding: "40px 56px", display: "flex", gap: 40, alignItems: "center" }}>
            <IconBadge name="BookMarked" color={color} size={110} />
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, letterSpacing: "0.25em", color, marginBottom: 8 }}>KEY TERM</div>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 64, color: INK }}>{spec.term.title}</div>
              <Sub style={{ fontSize: 36, color: INK, marginTop: 8, opacity: 0.85 }}>{spec.term.def}</Sub>
            </div>
          </Card>
        </Reveal>
      ) : null}
      <div
        style={{
          position: "absolute",
          top: hasTerm ? 600 : 330,
          height: hasTerm ? 260 : 440,
          left: 80,
          right: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
        }}
      >
        {spec.parts.map((part, i) => {
          const at = cues.at(part.at) + (spec.parts.filter((p, j) => j < i && p.at === part.at).length * 10);
          if (part.role === "op") {
            return (
              <Reveal key={i} at={at} dy={0} scale>
                <div style={{ fontFamily: SERIF, fontSize: 110, color, lineHeight: 1 }}>{part.text}</div>
              </Reveal>
            );
          }
          const result = part.role === "result";
          const glow = result ? prog(frame, at + 10, 30) : 0;
          return (
            <Reveal key={i} at={at} dy={40} scale>
              <div
                style={{
                  padding: hasTerm ? "28px 40px" : "44px 52px",
                  borderRadius: 26,
                  background: result ? `linear-gradient(160deg, ${alpha(color, 0.45)}, ${alpha(color, 0.18)})` : "rgba(255,255,255,0.06)",
                  border: `2px solid ${result ? color : "rgba(255,255,255,0.14)"}`,
                  boxShadow: result ? `0 0 ${40 + glow * 60}px ${alpha(color, 0.25 + glow * 0.3)}` : "0 20px 50px rgba(0,0,0,0.4)",
                  fontFamily: result ? SERIF : SANS,
                  fontWeight: result ? 600 : 700,
                  fontSize: hasTerm ? 50 : result ? 84 : 56,
                  color: INK,
                  textAlign: "center",
                  maxWidth: hasTerm ? 560 : 520,
                  lineHeight: 1.1,
                }}
              >
                {part.text}
              </div>
            </Reveal>
          );
        })}
      </div>
      {spec.footer ? <Banner text={spec.footer.text} at={cues.at(spec.footer.at)} color={color} style={{ top: 836 }} /> : null}
    </SceneShell>
  );
};

// ─────────────── Key-term definition ───────────────
export const DefinitionLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "definition");
  const { frame, cues, color, kicker } = useScene(spec);
  const compact = Boolean(spec.forks);
  const defAt = cues.at(spec.at);
  const chips = spec.chips ?? [];
  const chipStarts = chips.map((c) => {
    const same = chips.filter((x) => x.at === c.at);
    return cues.spread(c.at!, same.indexOf(c), same.length);
  });
  const forkStarts = (spec.forks ?? []).map((f) => cues.at(f.at));
  const allStarts = compact ? forkStarts : chipStarts;
  const lastLine = compact ? spec.forks![spec.forks!.length - 1].at : chips.length ? chips[chips.length - 1].at! : spec.at;
  const release = cues.end(lastLine) + 6;
  const spots = spotlight(frame, compact ? forkStarts : chips.map((c) => cues.at(c.at)), release);
  const bigChips = chips.length <= 3 && chips.every((c) => c.sub);
  return (
    <SceneShell spec={spec}>
      <div style={{ position: "absolute", top: compact ? 84 : 110, left: 120, right: 120, display: "flex", gap: 56, alignItems: "center" }}>
        <Reveal at={0} scale dy={0}>
          <IconBadge name={spec.icon} color={color} size={compact ? 170 : 220} glow={0.6} />
        </Reveal>
        <div style={{ flex: 1 }}>
          <Reveal at={2} dy={14}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: "0.22em", color, textTransform: "uppercase" }}>
              {kicker} · {spec.eyebrow}
            </div>
          </Reveal>
          <Reveal at={6} dy={30}>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: compact ? 92 : 110, color: INK, lineHeight: 1.05, marginTop: 10 }}>
              {spec.term}
            </div>
          </Reveal>
          <Reveal at={defAt + 6} dy={20}>
            <div
              style={{
                marginTop: 18,
                paddingLeft: 28,
                borderLeft: `5px solid ${color}`,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: compact ? 44 : 50,
                color: INK,
                opacity: 0.92,
                lineHeight: 1.25,
                maxWidth: 1300,
              }}
            >
              {spec.def}
            </div>
          </Reveal>
        </div>
      </div>
      {compact ? (
        <div style={{ position: "absolute", top: 470, left: 160, right: 160, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: "0.2em", color: MUTED, paddingLeft: 30 }}>
            <div style={{ width: 520 }}>WHO DECIDES</div>
            <div style={{ width: 470 }}>CHOSEN</div>
            <div>GIVEN UP = OPPORTUNITY COST</div>
          </div>
          {spec.forks!.map((f, i) => (
            <Reveal key={f.from} at={allStarts[i]} dx={-40} dy={0}>
              <Card
                accent={color}
                active={spots[i]}
                style={{ display: "flex", alignItems: "center", padding: "20px 30px", opacity: dimmed(spots[i], frame, release) }}
              >
                <div style={{ width: 490, display: "flex", alignItems: "center", gap: 22 }}>
                  <IconBadge name={f.icon} color={color} size={72} />
                  <Label size={38}>{f.from}</Label>
                </div>
                <div style={{ width: 470, display: "flex", alignItems: "center", gap: 16 }}>
                  <Icon name="CircleCheck" size={44} color={GOOD} />
                  <Label size={38} style={{ fontWeight: 600 }}>
                    {f.chosen}
                  </Label>
                </div>
                <Reveal at={allStarts[i] + 30} dx={-20} dy={0}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "10px 24px",
                      borderRadius: 999,
                      background: alpha(color, 0.18),
                      border: `1.5px solid ${alpha(color, 0.7)}`,
                    }}
                  >
                    <Icon name="CircleX" size={40} color={color} />
                    <Label size={38} style={{ fontWeight: 600 }}>
                      {f.lost}
                    </Label>
                  </div>
                </Reveal>
              </Card>
            </Reveal>
          ))}
        </div>
      ) : (
        <div style={{ position: "absolute", top: 560, left: 120, right: 120, display: "flex", justifyContent: "center", gap: 30 }}>
          {chips.map((c, i) => (
            <Reveal key={c.label} at={allStarts[i]} dy={40} scale>
              <Card
                accent={color}
                active={spots[i]}
                style={{
                  display: "flex",
                  flexDirection: bigChips ? "column" : "row",
                  alignItems: "center",
                  gap: bigChips ? 18 : 20,
                  padding: bigChips ? "36px 70px" : "26px 34px",
                  opacity: dimmed(spots[i], frame, release),
                }}
              >
                <IconBadge name={c.icon} color={color} size={bigChips ? 120 : 72} glow={spots[i]} />
                <div style={{ textAlign: bigChips ? "center" : "left" }}>
                  <Label size={bigChips ? 50 : 34}>{c.label}</Label>
                  {c.sub ? <Sub style={{ fontSize: 30 }}>{c.sub}</Sub> : null}
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
    </SceneShell>
  );
};

// ─────────────── Stages along a timeline ───────────────
export const StagesLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "stages");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.stages.map((s) => cues.at(s.at));
  const release = cues.end(spec.stages[spec.stages.length - 1].at!) + 6;
  const spots = spotlight(frame, starts, release);
  const n = spec.stages.length;
  const lineP = interpolate(frame, starts.concat(release), spec.stages.map((_, i) => i / n).concat(1), CLAMP);
  const xs = spec.stages.map((_, i) => 120 + (1680 / n) * (i + 0.5));
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={140} y1={560} x2={1780} y2={560} stroke="rgba(255,255,255,0.12)" strokeWidth={6} strokeLinecap="round" />
        <line x1={140} y1={560} x2={140 + 1640 * lineP} y2={560} stroke={color} strokeWidth={6} strokeLinecap="round" />
        <path d="M 1760 538 L 1792 560 L 1760 582" fill="none" stroke={lineP > 0.97 ? color : "rgba(255,255,255,0.12)"} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {spec.stages.map((st, i) => (
        <Reveal key={st.label} at={starts[i]} dy={40} scale style={{ position: "absolute", left: xs[i] - 260, top: 340, width: 520 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", opacity: dimmed(spots[i], frame, release) }}>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: "0.2em", color, marginBottom: 22 }}>STAGE {i + 1}</div>
            <IconBadge name={st.icon} color={color} size={150} glow={spots[i]} />
            <div style={{ height: 70 }} />
            <Label size={50}>{st.label}</Label>
            <Sub style={{ fontSize: 34, marginTop: 10 }}>{st.sub}</Sub>
          </div>
        </Reveal>
      ))}
    </SceneShell>
  );
};

// ─────────────── Stacked bar chart ───────────────
const SECTOR_COLORS = ["#F59E0B", "#38BDF8", "#A78BFA"];

export const BarsLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "bars");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.rows.map((r) => cues.at(r.at));
  const release = cues.end(spec.rows[spec.rows.length - 1].at) + 6;
  const spots = spotlight(frame, starts, release);
  const barW = 1180;
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <Reveal at={10} dy={14} style={{ position: "absolute", top: 268, left: 120 }}>
        <Sub style={{ fontSize: 34 }}>{spec.sub}</Sub>
      </Reveal>
      <Reveal at={14} dy={14} style={{ position: "absolute", top: 268, right: 120, display: "flex", gap: 36 }}>
        {spec.legend.map((l, i) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: SECTOR_COLORS[i] }} />
            <Label size={32} style={{ fontWeight: 600 }}>
              {l}
            </Label>
          </div>
        ))}
      </Reveal>
      <div style={{ position: "absolute", top: 360, left: 120, right: 120, display: "flex", flexDirection: "column", gap: 44 }}>
        {spec.rows.map((row, ri) => (
          <Reveal key={row.label} at={starts[ri]} dx={-30} dy={0}>
            <div style={{ display: "flex", alignItems: "center", gap: 40, opacity: dimmed(spots[ri], frame, release) }}>
              <Label size={38} style={{ width: 420, textAlign: "right", fontWeight: 600 }}>
                {row.label}
              </Label>
              <div
                style={{
                  width: barW,
                  height: 110,
                  borderRadius: 18,
                  overflow: "hidden",
                  display: "flex",
                  background: "rgba(255,255,255,0.06)",
                  boxShadow: spots[ri] > 0 ? `0 0 ${50 * spots[ri]}px ${alpha(color, 0.3)}` : undefined,
                }}
              >
                {row.values.map((v, vi) => {
                  const grow = interpolate(frame, [starts[ri] + vi * 8, starts[ri] + vi * 8 + 40], [0, 1], { ...CLAMP, easing: EASE });
                  const w = (barW * v * grow) / 100;
                  return (
                    <div
                      key={vi}
                      style={{
                        width: w,
                        height: "100%",
                        background: `linear-gradient(180deg, ${SECTOR_COLORS[vi]}, ${alpha(SECTOR_COLORS[vi], 0.7)})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: SANS,
                        fontWeight: 800,
                        fontSize: 40,
                        color: "#0A0D18",
                        overflow: "hidden",
                        borderRight: vi < row.values.length - 1 && w > 0 ? "3px solid #05070F" : undefined,
                      }}
                    >
                      {v >= 8 && grow > 0.7 ? `${v}%` : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Banner text={spec.note.text} at={cues.at(spec.note.at)} color={color} style={{ top: 836 }} />
    </SceneShell>
  );
};

// ─────────────── Exam tip / trap ───────────────
export const TipLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "tip");
  const { frame, cues, color, kicker } = useScene(spec);
  const at = cues.at(spec.at);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 12);
  return (
    <SceneShell spec={spec}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
        <Reveal at={0} dy={40} scale>
          <Card
            accent={color}
            active={0.6 + pulse * 0.3}
            style={{ width: 1400, padding: "70px 90px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Icon name="TriangleAlert" size={52} color={color} />
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: "0.25em", color }}>{spec.eyebrow.toUpperCase()}</div>
            </div>
            <Sub style={{ fontSize: 28, marginTop: 8, letterSpacing: "0.15em" }}>{kicker.toUpperCase()}</Sub>
            <Reveal at={at} dy={30} scale>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 170, color: INK, marginTop: 30, lineHeight: 1 }}>{spec.big}</div>
            </Reveal>
            <Reveal at={at + 40} dy={20}>
              <Sub style={{ fontSize: 46, marginTop: 40, color: INK, opacity: 0.85 }}>{spec.text}</Sub>
            </Reveal>
          </Card>
        </Reveal>
      </AbsoluteFill>
    </SceneShell>
  );
};

// ─────────────── Big-number statement ───────────────
export const StatementLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "statement");
  const { frame, cues, color, kicker } = useScene(spec);
  const la = cues.at(spec.left.at);
  const ra = cues.at(spec.right.at);
  const chipStarts = spec.chips.map((c, i) => cues.spread(c.at!, i, spec.chips.length));
  const box = (side: typeof spec.left, at: number, hot: boolean) => (
    <Reveal at={at} dy={40} scale>
      <Card accent={color} active={hot ? 0.8 : 0.2} style={{ width: 600, padding: "44px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <IconBadge name={side.icon} color={color} size={110} />
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 140, color: hot ? color : INK, lineHeight: 1 }}>{side.big}</div>
        <Sub style={{ fontSize: 34 }}>{side.small}</Sub>
      </Card>
    </Reveal>
  );
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 290, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 50 }}>
        {box(spec.left, la, false)}
        <Arrow p={prog(frame, ra - 12, 18)} color={color} width={160} />
        {box(spec.right, ra, true)}
      </div>
      <div style={{ position: "absolute", top: 790, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26 }}>
        {spec.chips.map((c, i) => (
          <Reveal key={c.label} at={chipStarts[i]} dy={30} scale>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 30px",
                borderRadius: 999,
                background: alpha(color, 0.16),
                border: `1.5px solid ${alpha(color, 0.6)}`,
              }}
            >
              <Icon name={c.icon} size={40} color={color} />
              <Label size={36} style={{ fontWeight: 600 }}>
                {c.label}
              </Label>
            </div>
          </Reveal>
        ))}
      </div>
    </SceneShell>
  );
};

// ─────────────── Acronym (SMART) ───────────────
export const AcronymLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "acronym");
  const { frame, cues, color, kicker } = useScene(spec);
  const n = spec.letters.length;
  const starts = spec.letters.map((_, i) => cues.spread(spec.at, i + 1, n + 1));
  const release = cues.end(spec.at) + 6;
  const spots = spotlight(frame, starts, release);
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 320, left: 120, right: 120, display: "flex", gap: 28 }}>
        {spec.letters.map((l, i) => (
          <Reveal key={l.letter} at={starts[i]} dy={60} scale style={{ flex: 1 }}>
            <Card accent={color} active={spots[i]} style={{ padding: "40px 10px 44px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 190, lineHeight: 1, color }}>{l.letter}</div>
              <Label size={40} style={{ marginTop: 14 }}>
                {l.word}
              </Label>
            </Card>
          </Reveal>
        ))}
      </div>
      <Reveal at={cues.at(spec.example.at)} dy={30} style={{ position: "absolute", top: 720, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "26px 50px", borderRadius: 24, background: "rgba(255,255,255,0.06)", border: `1.5px solid ${alpha(color, 0.6)}` }}>
          <Icon name="Quote" size={48} color={color} />
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 50, color: INK }}>{spec.example.text}</div>
        </div>
      </Reveal>
    </SceneShell>
  );
};

// ─────────────── Recap list ───────────────
export const RecapLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "recap");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.items.map((i) => cues.at(i.at));
  const release = cues.end(spec.items[spec.items.length - 1].at) + 6;
  const spots = spotlight(frame, starts, release);
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 300, left: 200, right: 200, display: "flex", flexDirection: "column", gap: 20 }}>
        {spec.items.map((item, i) => (
          <Reveal key={item.num} at={starts[i]} dx={-60} dy={0}>
            <Card accent={color} active={spots[i]} style={{ display: "flex", alignItems: "center", gap: 36, padding: "20px 36px", opacity: dimmed(spots[i], frame, release) }}>
              <Icon name="CircleCheck" size={52} color={prog(frame, starts[i] + 20, 10) > 0.5 ? GOOD : MUTED} />
              <div style={{ fontFamily: SERIF, fontSize: 46, color, width: 100, fontWeight: 600 }}>{item.num}</div>
              <Label size={42} style={{ fontWeight: 600 }}>
                {item.text}
              </Label>
            </Card>
          </Reveal>
        ))}
      </div>
    </SceneShell>
  );
};

export { Arrow };
