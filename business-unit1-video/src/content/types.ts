// Shared types for the scene script. This file must stay free of runtime
// imports so that Node can load the script directly to export narration.

export type Line = {
  /** Cue id used by visuals. Lines without an id get `L<index>`. */
  id?: string;
  /** Text shown in the captions. */
  text: string;
  /** Optional spoken version when it differs from the caption (numbers, acronyms). */
  say?: string;
  /** Extra silence (seconds) after this line. */
  pause?: number;
};

export type Item = {
  icon: string;
  label: string;
  sub?: string;
  /** Cue id: the item appears when this line starts. */
  at?: string;
};

export type Tone = "accent" | "good" | "bad" | "neutral";

export type Panel = {
  title: string;
  icon: string;
  tone: Tone;
  at: string;
  sub?: string;
  items: Item[];
};

export type Banner = { text: string; at: string };

type Base = {
  id: string;
  /** 0 = intro, 1..5 = syllabus chapters, 6 = summary */
  chapter: number;
  lines: Line[];
};

export type MontageScene = Base & {
  kind: "montage";
  items: Item[];
  center: { label: string; at: string };
  question: { text: string; at: string };
};

export type TitleScene = Base & {
  kind: "title";
  kicker: string;
  title: string;
  subtitle: string;
};

export type RoadmapScene = Base & {
  kind: "roadmap";
  heading: string;
  items: { num: string; title: string; sub: string; at: string }[];
};

export type ChapterScene = Base & {
  kind: "chapter";
  num: number;
  code: string;
  title: string;
  subtitle: string;
};

export type SplitScene = Base & {
  kind: "split";
  heading: string;
  left: Panel;
  right: Panel;
  banner?: Banner;
};

export type GridScene = Base & {
  kind: "grid";
  heading: string;
  sub?: { text: string; at: string };
  items: Item[];
  columns?: number;
  banner?: Banner;
};

export type FlowScene = Base & {
  kind: "flow";
  heading: string;
  nodes: (Item & { tag?: string })[];
  footer?: Banner;
};

export type EquationScene = Base & {
  kind: "equation";
  heading: string;
  term?: { title: string; def: string; at: string };
  parts: { text: string; at: string; role: "term" | "op" | "result" | "bad" }[];
  footer?: Banner;
};

export type DefinitionScene = Base & {
  kind: "definition";
  eyebrow: string;
  term: string;
  def: string;
  at: string;
  icon: string;
  chips?: Item[];
  forks?: { from: string; chosen: string; lost: string; at: string; icon: string }[];
};

export type StagesScene = Base & {
  kind: "stages";
  heading: string;
  stages: Item[];
};

export type BarsScene = Base & {
  kind: "bars";
  heading: string;
  sub: string;
  legend: string[];
  rows: { label: string; values: number[]; at: string }[];
  note: Banner;
};

export type ProfileScene = Base & {
  kind: "profile";
  icon: string;
  title: string;
  tags: string[];
  def: string;
  atDef: string;
  pros: { title: string; items: string[]; at: string };
  cons: { title: string; items: string[]; at: string };
};

export type MergersScene = Base & {
  kind: "mergers";
  heading: string;
};

export type FranchiseScene = Base & {
  kind: "franchise";
  heading: string;
};

export type QuadScene = Base & {
  kind: "quad";
  heading: string;
  boxes: { title: string; tone: Tone; icon: string; items: string[]; at: string }[];
};

export type VennScene = Base & {
  kind: "venn";
  heading: string;
  a: string;
  b: string;
  middle: string;
  atDef: string;
  example: { text: string; at: string };
  pros: { items: string[]; at: string };
  cons: { items: string[]; at: string };
};

export type TableScene = Base & {
  kind: "table";
  heading: string;
  columns: string[];
  rows: { cells: string[]; at: string }[];
  footer: Banner;
};

export type WheelScene = Base & {
  kind: "wheel";
  heading: string;
  def: { text: string; at: string };
  center: string;
  inner: { items: Item[]; at: string; label: string };
  outer: { items: Item[]; at: string; label: string };
};

export type ConflictScene = Base & {
  kind: "conflict";
  heading: string;
  rows: {
    a: { icon: string; who: string; wants: string };
    b: { icon: string; who: string; wants: string };
    at: string;
  }[];
  footer: Banner;
};

export type TipScene = Base & {
  kind: "tip";
  eyebrow: string;
  big: string;
  text: string;
  at: string;
};

export type StatementScene = Base & {
  kind: "statement";
  heading: string;
  left: { big: string; small: string; icon: string; at: string };
  right: { big: string; small: string; icon: string; at: string };
  chips: Item[];
};

export type AddedValueScene = Base & { kind: "addedvalue" };
export type MarketShareScene = Base & { kind: "marketshare" };

export type AcronymScene = Base & {
  kind: "acronym";
  heading: string;
  letters: { letter: string; word: string }[];
  at: string;
  example: { text: string; at: string };
};

export type RecapScene = Base & {
  kind: "recap";
  heading: string;
  items: { num: string; text: string; at: string }[];
};

export type EndScene = Base & {
  kind: "end";
  title: string;
  sub: string;
};

export type SceneSpec =
  | MontageScene
  | TitleScene
  | RoadmapScene
  | ChapterScene
  | SplitScene
  | GridScene
  | FlowScene
  | EquationScene
  | DefinitionScene
  | StagesScene
  | BarsScene
  | ProfileScene
  | MergersScene
  | FranchiseScene
  | QuadScene
  | VennScene
  | TableScene
  | WheelScene
  | ConflictScene
  | TipScene
  | StatementScene
  | AddedValueScene
  | MarketShareScene
  | AcronymScene
  | RecapScene
  | EndScene;
