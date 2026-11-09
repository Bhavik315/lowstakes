import React from "react";
import type { SceneSpec } from "../content/types";
import { AcronymLayout, BarsLayout, DefinitionLayout, EquationLayout, FlowLayout, GridLayout, RecapLayout, SplitLayout, StagesLayout, StatementLayout, TipLayout } from "./Layouts";
import { ChapterLayout, EndLayout, MontageLayout, RoadmapLayout, TitleLayout } from "./Intro";
import type { SceneProps } from "./shared";
import {
  AddedValueLayout,
  ConflictLayout,
  FranchiseLayout,
  MarketShareLayout,
  MergersLayout,
  ProfileLayout,
  QuadLayout,
  TableLayout,
  VennLayout,
  WheelLayout,
} from "./Special";

export const LAYOUTS: Record<SceneSpec["kind"], React.FC<SceneProps>> = {
  montage: MontageLayout,
  title: TitleLayout,
  roadmap: RoadmapLayout,
  chapter: ChapterLayout,
  split: SplitLayout,
  grid: GridLayout,
  flow: FlowLayout,
  equation: EquationLayout,
  definition: DefinitionLayout,
  stages: StagesLayout,
  bars: BarsLayout,
  profile: ProfileLayout,
  mergers: MergersLayout,
  franchise: FranchiseLayout,
  quad: QuadLayout,
  venn: VennLayout,
  table: TableLayout,
  wheel: WheelLayout,
  conflict: ConflictLayout,
  tip: TipLayout,
  statement: StatementLayout,
  addedvalue: AddedValueLayout,
  marketshare: MarketShareLayout,
  acronym: AcronymLayout,
  recap: RecapLayout,
  end: EndLayout,
};
