import React from "react";
import { interpolate } from "remotion";
import { Banner, Card, Heading, Icon, IconBadge, Label, Reveal, Sub } from "../components/ui";
import { CLAMP, dimmed, EASE, prog, spotlight } from "../lib/anim";
import { alpha, BAD, GOOD, INK, SANS, SERIF, toneColor } from "../lib/theme";
import { Arrow } from "./Layouts";
import { getSpec, SceneProps, SceneShell, useScene } from "./shared";

const Pill: React.FC<{ text: string; color: string; size?: number }> = ({ text, color, size = 26 }) => (
  <div
    style={{
      padding: "8px 22px",
      borderRadius: 999,
      background: alpha(color, 0.16),
      border: `1.5px solid ${alpha(color, 0.6)}`,
      fontFamily: SANS,
      fontWeight: 700,
      fontSize: size,
      color: INK,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

// ─────────────── Worked example: added value ───────────────
export const AddedValueLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "addedvalue");
  const { frame, cues, color, kicker } = useScene(spec);
  const buy = cues.at("buy");
  const sell = cues.at("sell");
  const result = cues.at("result");
  const warn = cues.at("warning");
  const count = Math.round(interpolate(frame, [result + 20, result + 60], [0, 8], { ...CLAMP, easing: EASE }));
  const split = interpolate(frame, [warn + 50, warn + 90], [0, 1], { ...CLAMP, easing: EASE });
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title="Worked example: a bakery" color={color} />
      <div style={{ position: "absolute", top: 290, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 36 }}>
        <Reveal at={buy} dy={40} scale>
          <Card accent={color} active={0.2} style={{ width: 480, padding: "30px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 18 }}>
              {["Wheat", "Egg", "Milk", "Candy"].map((n, i) => (
                <Reveal key={n} at={buy + 14 + i * 6} dy={20} scale>
                  <IconBadge name={n} color={color} size={78} />
                </Reveal>
              ))}
            </div>
            <Label size={36} style={{ fontWeight: 600 }}>
              Bought-in ingredients
            </Label>
            <div style={{ fontFamily: SERIF, fontSize: 96, color: INK, lineHeight: 1 }}>$2</div>
          </Card>
        </Reveal>
        <Reveal at={sell - 8} dy={0} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Icon name="ChefHat" size={60} color={color} />
          <Arrow p={prog(frame, sell - 6, 20)} color={color} width={170} />
          <Sub style={{ fontSize: 26 }}>mix · bake · decorate</Sub>
        </Reveal>
        <Reveal at={sell} dy={40} scale>
          <Card accent={color} active={0.5} style={{ width: 480, padding: "30px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <IconBadge name="Cake" color={color} size={96} glow={0.6} />
            <Label size={36} style={{ fontWeight: 600 }}>
              Selling price
            </Label>
            <div style={{ fontFamily: SERIF, fontSize: 96, color, lineHeight: 1 }}>$10</div>
          </Card>
        </Reveal>
      </div>
      <Reveal at={result} dy={30} style={{ position: "absolute", top: 640, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            padding: "22px 56px",
            borderRadius: 26,
            background: `linear-gradient(160deg, ${alpha(color, 0.35)}, ${alpha(color, 0.12)})`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 70px ${alpha(color, 0.35)}`,
            fontFamily: SERIF,
            fontSize: 68,
            color: INK,
          }}
        >
          Added value = $10 − $2 = <span style={{ color, fontWeight: 700 }}>${count}</span>
        </div>
      </Reveal>
      <Reveal at={warn} dy={30} style={{ position: "absolute", top: 800, left: 260, right: 260 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <Icon name="TriangleAlert" size={46} color={BAD} />
            <Label size={38}>Added value ≠ profit</Label>
          </div>
          <div style={{ flex: 1, height: 74, borderRadius: 16, overflow: "hidden", display: "flex", border: "1.5px solid rgba(255,255,255,0.15)" }}>
            <div
              style={{
                flex: 0.62 * split + (1 - split),
                background: alpha(BAD, 0.35),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 28,
                color: INK,
              }}
            >
              {split > 0.5 ? "Wages, rent, electricity…" : "$8 of added value"}
            </div>
            <div
              style={{
                flex: 0.38 * split,
                background: alpha(GOOD, 0.45),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 28,
                color: INK,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {split > 0.5 ? "Profit" : ""}
            </div>
          </div>
        </div>
      </Reveal>
    </SceneShell>
  );
};

// ─────────────── Market share calculation ───────────────
export const MarketShareLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "marketshare");
  const { frame, cues, color, kicker } = useScene(spec);
  const f = cues.at("formula");
  const ex = cues.at("ex");
  const ans = cues.at("answer");
  const pie = interpolate(frame, [ans - 4, ans + 36], [0, 0.2], { ...CLAMP, easing: EASE });
  const r = 150;
  const C = 2 * Math.PI * r;
  const box = 2 * r + 100;
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title="Calculating market share" color={color} />
      <Reveal at={f} dy={30} style={{ position: "absolute", top: 286, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, fontFamily: SERIF, fontSize: 60, color: INK }}>
          <span style={{ color }}>Market share</span>
          <span>=</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span>Firm&apos;s sales</span>
            <div style={{ height: 4, width: "100%", background: INK, margin: "8px 0", borderRadius: 2 }} />
            <span>Total market sales</span>
          </div>
          <span>× 100</span>
        </div>
      </Reveal>
      <div style={{ position: "absolute", top: 500, left: 200, right: 200, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Reveal at={ex} dx={-30} dy={0}>
            <Card accent={color} active={0.2} style={{ padding: "20px 36px", display: "flex", alignItems: "center", gap: 22 }}>
              <IconBadge name="Footprints" color={color} size={70} />
              <Label size={40}>Firm&apos;s sales: $2 million</Label>
            </Card>
          </Reveal>
          <Reveal at={cues.spread("ex", 1, 2)} dx={-30} dy={0}>
            <Card accent={color} active={0.2} style={{ padding: "20px 36px", display: "flex", alignItems: "center", gap: 22 }}>
              <IconBadge name="Globe" color={color} size={70} />
              <Label size={40}>Total market: $10 million</Label>
            </Card>
          </Reveal>
          <Reveal at={ans} dy={20}>
            <div style={{ fontFamily: SERIF, fontSize: 64, color: INK, paddingLeft: 10 }}>
              2 ÷ 10 × 100 = <span style={{ color, fontWeight: 700 }}>20%</span>
            </div>
          </Reveal>
        </div>
        <Reveal at={ex} scale dy={0}>
          <div style={{ position: "relative", width: box, height: box }}>
            <svg width={box} height={box} style={{ rotate: "-90deg", overflow: "visible" }}>
              <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={70} />
              <circle
                cx={box / 2}
                cy={box / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={70}
                strokeDasharray={`${C * pie} ${C}`}
                style={{ filter: `drop-shadow(0 0 20px ${alpha(color, 0.6)})` }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <div style={{ fontFamily: SERIF, fontSize: 80, color: INK, fontWeight: 600 }}>{Math.round(pie * 100)}%</div>
              <Sub style={{ fontSize: 26 }}>of the market</Sub>
            </div>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

// ─────────────── Mergers & takeovers on a chain of production ───────────────
export const MergersLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "mergers");
  const { frame, cues, color, kicker } = useScene(spec);
  const ids = ["horizontal", "backward", "forward", "conglomerate"];
  const starts = ids.map((id) => cues.at(id));
  const release = cues.end("conglomerate") + 6;
  const spots = spotlight(frame, starts, release);
  const [sh, sb, sf, sc] = spots;
  const intro = cues.at("intro");

  const node = (x: number, y: number, icon: string, title: string, stage: string, at: number, active: number, hero = false, dashed = false) => (
    <Reveal at={at} dy={30} scale style={{ position: "absolute", left: x - 200, top: y - 60, width: 400 }}>
      <Card
        accent={color}
        active={hero ? 0.7 : active}
        style={{
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          borderStyle: dashed ? "dashed" : "solid",
          background: hero ? `linear-gradient(160deg, ${alpha(color, 0.3)}, ${alpha(color, 0.08)})` : undefined,
        }}
      >
        <IconBadge name={icon} color={color} size={72} glow={active} />
        <div>
          <Label size={30}>{title}</Label>
          <Sub style={{ fontSize: 21, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{stage}</Sub>
        </div>
      </Card>
    </Reveal>
  );

  const tag = (x: number, y: number, text: string, at: number, active: number, align: "center" | "left" = "center") => (
    <Reveal at={at + 10} dy={10} style={{ position: "absolute", left: x, top: y, translate: align === "center" ? "-50% -50%" : "0 -50%" }}>
      <div
        style={{
          padding: "10px 24px",
          borderRadius: 999,
          background: active > 0.05 ? color : alpha(color, 0.18),
          color: active > 0.05 ? "#0A0D18" : INK,
          border: `1.5px solid ${color}`,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 26,
          whiteSpace: "nowrap",
          boxShadow: `0 0 ${active * 40}px ${alpha(color, 0.6)}`,
        }}
      >
        {text}
      </div>
    </Reveal>
  );

  const line = (x1: number, y1: number, x2: number, y2: number, at: number, dashed = false) => {
    const p = prog(frame, at, 24);
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x1 + (x2 - x1) * p}
        y2={y1 + (y2 - y1) * p}
        stroke={color}
        strokeWidth={4}
        strokeDasharray={dashed ? "10 10" : undefined}
        strokeLinecap="round"
        opacity={p > 0 ? 0.85 : 0}
      />
    );
  };

  const cx = 960;
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {line(cx, 520, cx, 400, starts[1])}
        {line(cx, 640, cx, 760, starts[2])}
        {line(760, 580, 490, 580, starts[0])}
        {line(1160, 580, 1430, 580, starts[3], true)}
      </svg>
      {node(cx, 340, "Sprout", "Cocoa farm", "Primary", starts[1] - 4, sb)}
      {node(cx, 580, "Factory", "Chocolate maker", "Our firm", intro, 0, true)}
      {node(cx, 820, "Store", "Sweet shops", "Tertiary", starts[2] - 4, sf)}
      {node(290, 580, "Factory", "Rival chocolate maker", "Secondary", starts[0], sh)}
      {node(1630, 580, "Hotel", "Hotel chain", "Unrelated industry", starts[3], sc, false, true)}
      {tag(625, 528, "Horizontal", starts[0], sh)}
      {tag(cx + 28, 460, "Backward vertical", starts[1], sb, "left")}
      {tag(cx + 28, 700, "Forward vertical", starts[2], sf, "left")}
      {tag(1295, 528, "Conglomerate", starts[3], sc)}
      <Reveal at={intro} dy={10} style={{ position: "absolute", left: 120, top: 270 }}>
        <Sub style={{ fontSize: 30 }}>Chain of production ↓</Sub>
      </Reveal>
    </SceneShell>
  );
};

// ─────────────── Franchise relationship ───────────────
export const FranchiseLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "franchise");
  const { frame, cues, color, kicker } = useScene(spec);
  const def = cues.at("def");
  const money = cues.at("money");
  const support = cues.at("support");
  const side = (x: number, icon: string, title: string, sub: string, at: number) => (
    <Reveal at={at} dy={40} scale style={{ position: "absolute", left: x, top: 330, width: 440 }}>
      <Card accent={color} active={0.4} style={{ padding: "40px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
        <IconBadge name={icon} color={color} size={140} glow={0.4} />
        <div style={{ fontFamily: SERIF, fontSize: 60, color: INK, fontWeight: 600 }}>{title}</div>
        <Sub style={{ fontSize: 32 }}>{sub}</Sub>
      </Card>
    </Reveal>
  );
  const flow = (y: number, text: string, at: number, dir: 1 | -1) => {
    const p = prog(frame, at, 30);
    const x1 = dir === 1 ? 620 : 1300;
    const x2 = dir === 1 ? 1300 : 620;
    const xe = x1 + (x2 - x1) * p;
    return (
      <>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <line x1={x1} y1={y} x2={xe} y2={y} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={p > 0 ? 1 : 0} />
          {p > 0.95 ? (
            <path
              d={dir === 1 ? `M ${x2 - 24} ${y - 16} L ${x2} ${y} L ${x2 - 24} ${y + 16}` : `M ${x2 + 24} ${y - 16} L ${x2} ${y} L ${x2 + 24} ${y + 16}`}
              fill="none"
              stroke={color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
        <Reveal at={at + 10} dy={dir === 1 ? -10 : 10} style={{ position: "absolute", left: 960, top: y + (dir === 1 ? -62 : 22), translate: "-50% 0" }}>
          <Pill text={text} color={color} size={28} />
        </Reveal>
      </>
    );
  };
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      {side(170, "Crown", "Franchisor", "Owns the brand & business model", def)}
      {side(1310, "Store", "Franchisee", "Buys the right to run an outlet", cues.spread("def", 2, 3))}
      {flow(480, "Brand · training · supplies · advertising", support, 1)}
      {flow(640, "Initial fee + royalties (% of sales)", money, -1)}
      <Reveal at={cues.spread("support", 2, 3)} dy={20} style={{ position: "absolute", top: 820, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 22 }}>
        <Sub style={{ fontSize: 30, alignSelf: "center" }}>Common in:</Sub>
        <Pill text="Fast food" color={color} size={30} />
        <Pill text="Hotels" color={color} size={30} />
        <Pill text="Gyms" color={color} size={30} />
      </Reveal>
    </SceneShell>
  );
};

// ─────────────── 2 × 2 boxes ───────────────
export const QuadLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "quad");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.boxes.map((b) => cues.at(b.at));
  const release = cues.end(spec.boxes[spec.boxes.length - 1].at) + 6;
  const spots = spotlight(frame, starts, release);
  const solution = spec.boxes.every((b) => b.tone === "neutral");
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 120,
          right: 120,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridAutoRows: 280,
          gap: 32,
        }}
      >
        {spec.boxes.map((b, i) => {
          const c = toneColor(b.tone, color);
          return (
            <Reveal key={b.title} at={starts[i]} dy={40} scale style={{ height: "100%" }}>
              <Card accent={c} active={spots[i]} style={{ height: "100%", padding: "32px 40px", boxSizing: "border-box", opacity: dimmed(spots[i], frame, release) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <IconBadge name={b.icon} color={c} size={84} glow={spots[i]} />
                  <div>
                    {solution ? (
                      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 22, letterSpacing: "0.2em", color: BAD }}>PROBLEM</div>
                    ) : null}
                    <Label size={40}>{b.title}</Label>
                  </div>
                </div>
                <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
                  {b.items.map((it, k) => (
                    <Reveal key={it} at={starts[i] + 24 + k * 14} dx={-20} dy={0}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <Icon name={solution ? "Lightbulb" : b.tone === "good" ? "CircleCheck" : "CircleX"} size={38} color={solution ? GOOD : c} />
                        <Label size={36} style={{ fontWeight: 600 }}>
                          {solution ? <span style={{ color: GOOD }}>Solution: </span> : null}
                          {it}
                        </Label>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </SceneShell>
  );
};

// ─────────────── Joint venture Venn ───────────────
export const VennLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "venn");
  const { frame, cues, color, kicker } = useScene(spec);
  const def = cues.at(spec.atDef);
  const join = prog(frame, def + 10, 50);
  const r = 205;
  const cy = 450;
  const offset = 260 - 90 * join;
  const circle = (x: number, label: string) => (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: cy - r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: 2 * r,
        background: alpha(color, 0.14),
        border: `3px solid ${alpha(color, 0.75)}`,
        display: "flex",
        alignItems: "center",
        justifyContent: x < 960 ? "flex-start" : "flex-end",
        padding: "0 46px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Icon name="Building2" size={56} color={INK} />
        <Label size={32}>{label}</Label>
      </div>
    </div>
  );
  const list = (items: string[], at: number, good: boolean, x: number) => (
    <div style={{ position: "absolute", top: 730, left: x, width: 720, display: "flex", flexDirection: "column", alignItems: good ? "flex-end" : "flex-start", gap: 14 }}>
      {items.map((it, i) => (
        <Reveal key={it} at={at + i * 12} dy={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 26px",
              borderRadius: 999,
              background: alpha(good ? GOOD : BAD, 0.14),
              border: `1.5px solid ${alpha(good ? GOOD : BAD, 0.6)}`,
            }}
          >
            <Icon name={good ? "CircleCheck" : "CircleX"} size={36} color={good ? GOOD : BAD} />
            <Label size={34} style={{ fontWeight: 600 }}>
              {it}
            </Label>
          </div>
        </Reveal>
      ))}
    </div>
  );
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <Reveal at={def} dy={30} scale>
        <div style={{ position: "absolute", inset: 0 }}>
          {circle(960 - offset, spec.a)}
          {circle(960 + offset, spec.b)}
          <div style={{ position: "absolute", left: 960, top: cy, translate: "-50% -50%", opacity: join, scale: String(0.8 + 0.2 * join) }}>
            <div
              style={{
                padding: "14px 26px",
                borderRadius: 18,
                background: color,
                color: "#0A0D18",
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 32,
                textAlign: "center",
                boxShadow: `0 0 50px ${alpha(color, 0.7)}`,
              }}
            >
              {spec.middle}
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal at={cues.at(spec.example.at)} dy={20} style={{ position: "absolute", top: 668, left: 0, right: 0, textAlign: "center" }}>
        <Sub style={{ fontSize: 34, fontStyle: "italic", fontFamily: SERIF, color: INK, opacity: 0.85 }}>{spec.example.text}</Sub>
      </Reveal>
      {list(spec.pros.items, cues.at(spec.pros.at), true, 200)}
      {list(spec.cons.items, cues.at(spec.cons.at), false, 1000)}
    </SceneShell>
  );
};

// ─────────────── Comparison table ───────────────
export const TableLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "table");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.rows.map((r) => cues.at(r.at));
  const release = cues.end(spec.rows[spec.rows.length - 1].at) + 6;
  const spots = spotlight(frame, starts, release);
  const widths = [520, 300, 300, 290, 270];
  const cellColor = (v: string) => {
    if (v === "Unlimited" || v === "No" || v === "Low") return BAD;
    if (v === "Limited" || v === "Yes" || v === "High" || v === "Very high") return GOOD;
    return INK;
  };
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 290, left: 120, right: 120 }}>
        <Reveal at={8} dy={10}>
          <div style={{ display: "flex", padding: "0 30px 14px", borderBottom: `2px solid ${alpha(color, 0.6)}` }}>
            {spec.columns.map((c, i) => (
              <div key={c} style={{ width: widths[i], fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: "0.18em", color, textTransform: "uppercase" }}>
                {c}
              </div>
            ))}
          </div>
        </Reveal>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          {spec.rows.map((row, ri) => (
            <Reveal key={row.cells[0]} at={starts[ri]} dx={-40} dy={0}>
              <Card accent={color} active={spots[ri]} style={{ display: "flex", alignItems: "center", padding: "22px 30px", opacity: dimmed(spots[ri], frame, release) }}>
                {row.cells.map((cell, ci) => (
                  <div
                    key={ci}
                    style={{
                      width: widths[ci],
                      fontFamily: ci === 0 ? SERIF : SANS,
                      fontWeight: ci === 0 ? 600 : 700,
                      fontSize: ci === 0 ? 42 : 36,
                      color: ci === 0 ? INK : cellColor(cell),
                    }}
                  >
                    {cell}
                  </div>
                ))}
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
      <Banner text={spec.footer.text} at={cues.at(spec.footer.at)} color={color} style={{ top: 836 }} />
    </SceneShell>
  );
};

// ─────────────── Stakeholder wheel ───────────────
export const WheelLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "wheel");
  const { frame, cues, color, kicker } = useScene(spec);
  const cx = 960;
  const cy = 590;
  const ext = "#5EEAD4";
  const inAt = cues.at(spec.inner.at);
  const outAt = cues.at(spec.outer.at);
  const release = cues.end(spec.outer.at) + 6;
  const [si, so] = spotlight(frame, [inAt, outAt], release);
  const ring = (rx: number, ry: number, angles: number[], items: typeof spec.inner.items, at: number, c: string, active: number, line: string) =>
    items.map((it, i) => {
      const a = (angles[i] * Math.PI) / 180;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      const t = cues.spread(line, i, items.length);
      const p = prog(frame, t, 24);
      return (
        <React.Fragment key={it.label}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <line x1={cx} y1={cy} x2={cx + (x - cx) * p} y2={cy + (y - cy) * p} stroke={alpha(c, 0.5)} strokeWidth={2.5} strokeDasharray="6 8" />
          </svg>
          <Reveal at={t} dy={20} scale style={{ position: "absolute", left: x - 100, top: y - 52, width: 200 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: dimmed(active, frame, release) }}>
              <IconBadge name={it.icon} color={c} size={84} glow={active} />
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 30,
                  color: INK,
                  padding: "2px 14px",
                  borderRadius: 10,
                  background: "rgba(5,7,15,0.7)",
                }}
              >
                {it.label}
              </div>
            </div>
          </Reveal>
        </React.Fragment>
      );
    });
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <Reveal at={cues.at(spec.def.at)} dy={14} style={{ position: "absolute", top: 268, left: 120 }}>
        <Sub style={{ fontSize: 34 }}>{spec.def.text}</Sub>
      </Reveal>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <ellipse cx={cx} cy={cy} rx={260} ry={200} fill="none" stroke={alpha(color, 0.3 * prog(frame, inAt, 30))} strokeWidth={2} strokeDasharray="4 10" />
        <ellipse cx={cx} cy={cy} rx={640} ry={230} fill="none" stroke={alpha(ext, 0.3 * prog(frame, outAt, 30))} strokeWidth={2} strokeDasharray="4 10" />
      </svg>
      {ring(260, 200, [-90, 150, 30], spec.inner.items, inAt, color, si, spec.inner.at)}
      {ring(640, 230, [-140, -40, 0, 90, 180], spec.outer.items, outAt, ext, so, spec.outer.at)}
      <Reveal at={cues.at(spec.def.at) + 6} scale dy={0} style={{ position: "absolute", left: cx - 110, top: cy - 110 }}>
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 220,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: `radial-gradient(circle at 35% 30%, ${alpha(color, 0.55)}, ${alpha(color, 0.15)} 70%)`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 90px ${alpha(color, 0.45)}`,
          }}
        >
          <Icon name="Building2" size={60} color={INK} />
          <div style={{ fontFamily: SERIF, fontSize: 30, color: INK, marginTop: 4, whiteSpace: "nowrap" }}>{spec.center}</div>
        </div>
      </Reveal>
      <div style={{ position: "absolute", top: 268, right: 120, display: "flex", gap: 20 }}>
        <Reveal at={inAt} dy={10}>
          <Pill text={`● ${spec.inner.label}`} color={color} size={28} />
        </Reveal>
        <Reveal at={outAt} dy={10}>
          <Pill text={`● ${spec.outer.label}`} color={ext} size={28} />
        </Reveal>
      </div>
    </SceneShell>
  );
};

// ─────────────── Conflicting objectives ───────────────
export const ConflictLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "conflict");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.rows.map((r) => cues.at(r.at));
  const release = cues.end(spec.rows[spec.rows.length - 1].at) + 6;
  const spots = spotlight(frame, starts, release);
  const side = (s: { icon: string; who: string; wants: string }, active: number, right: boolean) => (
    <Card
      accent={color}
      active={active}
      style={{ width: 640, padding: "20px 30px", display: "flex", alignItems: "center", gap: 24, flexDirection: right ? "row-reverse" : "row", textAlign: right ? "right" : "left" }}
    >
      <IconBadge name={s.icon} color={color} size={86} glow={active} />
      <div style={{ flex: 1 }}>
        <Label size={40}>{s.who}</Label>
        <Sub style={{ fontSize: 32 }}>want {s.wants.toLowerCase()}</Sub>
      </div>
    </Card>
  );
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 296, left: 120, right: 120, display: "flex", flexDirection: "column", gap: 26 }}>
        {spec.rows.map((row, i) => {
          const shake = spots[i] > 0.5 ? Math.sin(frame * 1.3) * 3 * spots[i] : 0;
          return (
            <Reveal key={row.a.who} at={starts[i]} dy={30}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: dimmed(spots[i], frame, release) }}>
                <div style={{ translate: `${shake}px 0` }}>{side(row.a, spots[i], false)}</div>
                <Reveal at={starts[i] + 16} scale dy={0}>
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 120,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: alpha(BAD, 0.2 + 0.25 * spots[i]),
                      border: `2px solid ${BAD}`,
                      boxShadow: `0 0 ${spots[i] * 50}px ${alpha(BAD, 0.6)}`,
                    }}
                  >
                    <Icon name="Zap" size={60} color={BAD} />
                  </div>
                </Reveal>
                <div style={{ translate: `${-shake}px 0` }}>
                  <Reveal at={starts[i] + 26} dx={30} dy={0}>
                    {side(row.b, spots[i], true)}
                  </Reveal>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
      <Banner text={spec.footer.text} at={cues.at(spec.footer.at)} color={color} style={{ top: 836 }} />
    </SceneShell>
  );
};

// ─────────────── Business organisation profile ───────────────
export const ProfileLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "profile");
  const { frame, cues, color, kicker } = useScene(spec);
  const pa = cues.at(spec.pros.at);
  const ca = cues.at(spec.cons.at);
  const release = cues.end(spec.cons.at) + 6;
  const [sp, sc] = spotlight(frame, [pa, ca], release);
  const column = (title: string, items: string[], at: number, line: string, good: boolean, active: number) => {
    const c = good ? GOOD : BAD;
    return (
      <Reveal at={at} dy={40} style={{ flex: 1 }}>
        <Card accent={c} active={active} style={{ height: 460, padding: "34px 40px", boxSizing: "border-box", opacity: dimmed(active, frame, release) }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: c, borderRadius: "28px 28px 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
            <Icon name={good ? "ThumbsUp" : "ThumbsDown"} size={44} color={c} />
            <div style={{ fontFamily: SERIF, fontSize: 48, color: INK, fontWeight: 600 }}>{title}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((it, i) => (
              <Reveal key={it} at={cues.spread(line, i, items.length) + 6} dx={-24} dy={0}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <Icon name={good ? "CircleCheck" : "CircleX"} size={40} color={c} />
                  <Label size={36} style={{ fontWeight: 600 }}>
                    {it}
                  </Label>
                </div>
              </Reveal>
            ))}
          </div>
        </Card>
      </Reveal>
    );
  };
  return (
    <SceneShell spec={spec}>
      <div style={{ position: "absolute", top: 84, left: 120, right: 120, display: "flex", gap: 44, alignItems: "center" }}>
        <Reveal at={0} scale dy={0}>
          <IconBadge name={spec.icon} color={color} size={170} glow={0.6} />
        </Reveal>
        <div style={{ flex: 1 }}>
          <Reveal at={2} dy={14}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: "0.22em", color, textTransform: "uppercase" }}>{kicker}</div>
          </Reveal>
          <Reveal at={6} dy={24}>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 84, color: INK, lineHeight: 1.05, marginTop: 6 }}>{spec.title}</div>
          </Reveal>
          <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
            {spec.tags.map((t, i) => (
              <Reveal key={t} at={cues.at(spec.atDef) + 12 + i * 8} dy={10}>
                <Pill text={t} color={t.startsWith("Unlimited") ? BAD : t.startsWith("Limited") ? GOOD : color} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
      <Reveal at={cues.at(spec.atDef) + 30} dy={16} style={{ position: "absolute", top: 336, left: 120, right: 120 }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: INK, opacity: 0.88, borderLeft: `5px solid ${color}`, paddingLeft: 26 }}>
          {spec.def}
        </div>
      </Reveal>
      <div style={{ position: "absolute", top: 430, left: 120, right: 120, display: "flex", gap: 44 }}>
        {column(spec.pros.title, spec.pros.items, pa, spec.pros.at, true, sp)}
        {column(spec.cons.title, spec.cons.items, ca, spec.cons.at, false, sc)}
      </div>
    </SceneShell>
  );
};

