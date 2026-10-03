import { z } from "zod";

const align = z.enum(["left", "center", "right"]);
const base = { id: z.string().min(1), name: z.string().max(60).optional() };
const visibleIf = z.string().max(64).optional();

const textBlock = z.object({ ...base, type: z.literal("text"), props: z.object({ html: z.string().max(50_000) }) });

const imageBlock = z.object({
  ...base,
  type: z.literal("image"),
  props: z.object({
    src: z.string().max(2000),
    alt: z.string().max(300),
    width: z.number().positive().optional(),
    widthUnit: z.enum(["px", "%"]).optional(),
    align,
    borderRadius: z.number().min(0),
    href: z.string().max(2000).optional(),
    linkType: z.enum(["app", "url"]).optional(),
  }),
});

const tableBlock = z.object({
  ...base,
  type: z.literal("table"),
  props: z.object({
    hasHeader: z.boolean(),
    cells: z.array(z.array(z.string().max(2000)).min(1).max(10)).min(1).max(50),
    headerBgColor: z.string().optional(),
    borderColor: z.string().optional(),
  }),
});

const buttonBlock = z.object({
  ...base,
  type: z.literal("button"),
  props: z.object({
    label: z.string().max(200),
    href: z.string().max(2000),
    linkType: z.enum(["app", "url"]).optional(),
    bgColor: z.string(),
    textColor: z.string(),
    radius: z.number().min(0),
    paddingY: z.number().min(0),
    paddingX: z.number().min(0),
    align,
  }),
});

const dividerBlock = z.object({
  ...base,
  type: z.literal("divider"),
  props: z.object({ color: z.string(), thickness: z.number().min(0), marginY: z.number().min(0) }),
});

const leafBlock = z.discriminatedUnion("type", [textBlock, imageBlock, tableBlock, buttonBlock, dividerBlock]);

const columnBlock = z.object({
  ...base,
  type: z.literal("column"),
  props: z.object({ widthPercent: z.number().min(1).max(100) }),
  children: z.array(leafBlock).max(30),
});

const rowBlock = z.object({
  ...base,
  type: z.literal("row"),
  props: z.object({ paddingY: z.number().min(0), paddingX: z.number().min(0), backgroundColor: z.string(), visibleIf }),
  children: z.array(columnBlock).min(1).max(6),
});

const containerBlock = z.object({
  ...base,
  type: z.literal("container"),
  props: z.object({
    marginY: z.number().min(0),
    marginX: z.number().min(0),
    paddingY: z.number().min(0),
    paddingX: z.number().min(0),
    backgroundColor: z.string(),
    borderColor: z.string().optional(),
    borderRadius: z.number().min(0).optional(),
    visibleIf,
    display: z.enum(["block", "flex"]).optional(),
    flexDirection: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
    justifyContent: z.enum(["flex-start", "flex-end", "center", "space-between"]).optional(),
    alignItems: z.enum(["flex-start", "flex-end", "center", "stretch"]).optional(),
    gap: z.number().min(0).optional(),
  }),
  children: z.array(leafBlock).max(30),
});

export const blockSchema = z.discriminatedUnion("type", [
  textBlock,
  imageBlock,
  tableBlock,
  buttonBlock,
  dividerBlock,
  rowBlock,
  containerBlock,
]);

export const blockTreeSchema = z.array(blockSchema).max(60);
