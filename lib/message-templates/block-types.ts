/**
 * Email template block tree — the source of truth stored in `message_templates.content` and
 * rendered to email-safe HTML by lib/message-templates/render-email.ts. Max nesting depth is 2:
 * rows (→ columns) and containers only exist at the top level and hold leaf blocks.
 */
import type { LinkType } from "./app-link";

export type BlockType = "text" | "image" | "row" | "column" | "container" | "table" | "button" | "divider";
export type LeafBlockType = "text" | "image" | "table" | "button" | "divider";

export type BlockAlign = "left" | "center" | "right";

interface BaseBlock {
  id: string;
  type: BlockType;
  /** Label shown on the canvas (auto-generated, e.g. "text1"). */
  name?: string;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  props: { html: string };
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  props: {
    src: string;
    alt: string;
    width?: number;
    /** Unit for `width` — absent means px. */
    widthUnit?: "px" | "%";
    align: BlockAlign;
    borderRadius: number;
    href?: string;
    /** "app": `href` is a path on this system, prefixed with {{appUrl}} when rendered. Absent = "url". */
    linkType?: LinkType;
  };
}

export interface RowBlock extends BaseBlock {
  type: "row";
  props: {
    paddingY: number;
    paddingX: number;
    backgroundColor: string;
    /** Variable key gating visibility at send time — hidden when the value is empty. */
    visibleIf?: string;
  };
  children: ColumnBlock[];
}

export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type JustifyContent = "flex-start" | "flex-end" | "center" | "space-between";
export type AlignItems = "flex-start" | "flex-end" | "center" | "stretch";

export interface ContainerBlock extends BaseBlock {
  type: "container";
  props: {
    marginY: number;
    marginX: number;
    paddingY: number;
    paddingX: number;
    backgroundColor: string;
    borderColor?: string;
    borderRadius?: number;
    visibleIf?: string;
    /** Absent means "block" (children stacked). */
    display?: "block" | "flex";
    flexDirection?: FlexDirection;
    justifyContent?: JustifyContent;
    alignItems?: AlignItems;
    gap?: number;
  };
  children: LeafBlock[];
}

export interface ColumnBlock extends BaseBlock {
  type: "column";
  props: { widthPercent: number };
  children: LeafBlock[];
}

export interface TableBlock extends BaseBlock {
  type: "table";
  props: {
    hasHeader: boolean;
    cells: string[][];
    headerBgColor?: string;
    borderColor?: string;
  };
}

export interface ButtonBlock extends BaseBlock {
  type: "button";
  props: {
    label: string;
    href: string;
    /** "app": `href` is a path on this system, prefixed with {{appUrl}} when rendered. Absent = "url". */
    linkType?: LinkType;
    bgColor: string;
    textColor: string;
    radius: number;
    paddingY: number;
    paddingX: number;
    align: BlockAlign;
  };
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
  props: { color: string; thickness: number; marginY: number };
}

/** Blocks allowed inside a column or container. */
export type LeafBlock = TextBlock | ImageBlock | TableBlock | ButtonBlock | DividerBlock;

/** Blocks allowed at the top level of a template. */
export type Block = LeafBlock | RowBlock | ContainerBlock;

export type BlockTree = Block[];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Texto",
  image: "Imagem",
  row: "Linha",
  column: "Coluna",
  container: "Contêiner",
  table: "Tabela",
  button: "Botão",
  divider: "Divisor",
};

export const LEAF_BLOCK_TYPES: LeafBlockType[] = ["text", "image", "table", "button", "divider"];

export function isLeafType(type: BlockType): type is LeafBlockType {
  return (LEAF_BLOCK_TYPES as BlockType[]).includes(type);
}
