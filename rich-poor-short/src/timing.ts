import data from "./data/words.json";

export const FPS = 30;

/** Video length follows the voiceover, so it loops the moment the last line ends. */
export const DURATION = Math.ceil((data.audioDurationMs / 1000) * FPS);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const spoken = data.words.map((w) => norm(w.text));

/**
 * Frame at which a spoken word (or phrase) starts, straight from the edge-tts
 * word boundaries. `nth` picks a later occurrence (1-based).
 */
export const cue = (phrase: string, nth = 1): number => {
  const parts = phrase.split(/\s+/).map(norm);
  let seen = 0;
  for (let i = 0; i <= spoken.length - parts.length; i++) {
    if (parts.every((p, j) => spoken[i + j] === p) && ++seen === nth) {
      return Math.round((data.words[i].startMs / 1000) * FPS);
    }
  }
  throw new Error(`Voiceover cue not found: "${phrase}" (#${nth})`);
};

export const T = {
  // hook
  rich: cue("rich"),
  richer: cue("richer"),
  poor: cue("poor"),
  poorer: cue("poorer"),
  // meet
  meet: cue("meet"),
  rahul: cue("rahul"),
  vikram: cue("vikram"),
  both: cue("both"),
  fifty: cue("fifty"),
  // rahul spends
  rahulSpends: cue("rahul spends"),
  spends: cue("spends"),
  phone: cue("phone"),
  emi: cue("emi"),
  credit: cue("credit"),
  thirtySix: cue("thirty six"),
  interest: cue("interest"),
  hisMoney: cue("his money"),
  works: cue("works"),
  bank: cue("bank"),
  // vikram invests
  vikramInvests: cue("vikram invests"),
  invests: cue("invests"),
  twentyK: cue("twenty thousand"),
  every: cue("every"),
  into: cue("into"),
  index: cue("index"),
  // ten years later
  tenYears: cue("ten years"),
  later: cue("later"),
  rahulHas: cue("rahul has"),
  zero: cue("zero"),
  threeLoans: cue("three loans"),
  // growth
  vikramQ: cue("vikram", 3),
  he: cue("he put"),
  twentyFour: cue("twenty four"),
  grew: cue("grew"),
  fortySix: cue("forty six"),
  // compounding
  thatIs: cue("that is"),
  compounding: cue("compounding"),
  money1: cue("money making"),
  money2: cue("money", 3),
  money3: cue("which makes"),
  money4: cue("more money"),
  // faster
  keeps: cue("and it keeps"),
  faster: cue("faster"),
  hisFirst: cue("his first"),
  tenLakh1: cue("ten lakh", 1),
  took: cue("took"),
  threeYears: cue("three years"),
  hisLatest: cue("his latest"),
  tenLakh2: cue("ten lakh", 2),
  just: cue("just"),
  sixteen: cue("sixteen"),
  // pay vs collect
  soThePoor: cue("so the poor"),
  pay: cue("pay"),
  theRich: cue("the rich", 2),
  collect: cue("collect"),
  // outro
  startSmall: cue("start small"),
  startToday: cue("start today"),
  nextTime: cue("and the next"),
  asks: cue("asks"),
};

/** Scenes cut a few frames before the first word of their sentence. */
const LEAD = 3;
const cuts = [
  ["hook", 0],
  ["meet", T.meet - LEAD],
  ["spend", T.rahulSpends - LEAD],
  ["bank", T.hisMoney - LEAD],
  ["invest", T.vikramInvests - LEAD],
  ["later", T.tenYears - LEAD],
  ["grow", T.vikramQ - LEAD],
  ["compound", T.thatIs - LEAD],
  ["faster", T.keeps - LEAD],
  ["flow", T.soThePoor - LEAD],
  ["outro", T.startSmall - LEAD],
] as const;

export type SceneName = (typeof cuts)[number][0];

export const SCENES = Object.fromEntries(
  cuts.map(([name, from], i) => [
    name,
    { from, durationInFrames: (cuts[i + 1]?.[1] ?? DURATION) - from },
  ]),
) as Record<SceneName, { from: number; durationInFrames: number }>;

/** Convert an absolute cue frame into a frame local to a scene. */
export const local = (scene: SceneName, absoluteFrame: number) =>
  absoluteFrame - SCENES[scene].from;

/** Key numbers that get a camera punch (zoom + shake). */
export const IMPACTS: { frame: number; strength: number }[] = [
  { frame: T.poorer, strength: 0.7 },
  { frame: T.thirtySix, strength: 1 },
  { frame: T.zero, strength: 0.9 },
  { frame: T.fortySix, strength: 0.9 },
  { frame: T.compounding, strength: 1.2 },
  { frame: T.tenLakh1, strength: 0.8 },
  { frame: T.tenLakh2, strength: 0.8 },
  { frame: T.sixteen, strength: 0.7 },
];
