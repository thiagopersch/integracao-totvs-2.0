import type { Block, BlockTree, BlockType, ColumnBlock, LeafBlock } from "./block-types";

/** Where a block lives: the top-level list, a row's column, or a container. */
export type BlockLocation =
  | { type: "top" }
  | { type: "column"; rowId: string; columnId: string }
  | { type: "container"; containerId: string };

export function generateBlockId(): string {
  return crypto.randomUUID();
}

function evenWidths(count: number): number[] {
  const base = Math.floor(100 / count);
  const widths = Array<number>(count).fill(base);
  widths[count - 1] += 100 - base * count;
  return widths;
}

export function createColumn(widthPercent: number): ColumnBlock {
  return { id: generateBlockId(), type: "column", props: { widthPercent }, children: [] };
}

/** Every addressable block (top level + row-column and container children). */
export function collectAllBlocks(tree: BlockTree): (Block | LeafBlock)[] {
  const result: (Block | LeafBlock)[] = [];
  for (const block of tree) {
    result.push(block);
    if (block.type === "row") for (const column of block.children) result.push(...column.children);
    if (block.type === "container") result.push(...block.children);
  }
  return result;
}

/** Next free default name for a type, e.g. "text1", "container2". */
export function generateDefaultBlockName(type: BlockType, tree: BlockTree): string {
  const pattern = new RegExp(`^${type}(\\d+)$`);
  let max = 0;
  for (const block of collectAllBlocks(tree)) {
    const match = block.name?.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${type}${max + 1}`;
}

export function createDefaultBlock(type: Exclude<BlockType, "column">, tree: BlockTree): Block {
  const id = generateBlockId();
  const name = generateDefaultBlockName(type, tree);
  switch (type) {
    case "text":
      return { id, name, type, props: { html: "<p>Digite seu texto aqui...</p>" } };
    case "image":
      return { id, name, type, props: { src: "", alt: "", align: "center", borderRadius: 0 } };
    case "row":
      return {
        id,
        name,
        type,
        props: { paddingY: 16, paddingX: 0, backgroundColor: "transparent" },
        children: evenWidths(2).map(createColumn),
      };
    case "container":
      return {
        id,
        name,
        type,
        props: { marginY: 0, marginX: 0, paddingY: 16, paddingX: 16, backgroundColor: "transparent" },
        children: [],
      };
    case "table":
      return {
        id,
        name,
        type,
        props: {
          hasHeader: true,
          cells: [
            ["Coluna 1", "Coluna 2"],
            ["Valor 1", "Valor 2"],
          ],
        },
      };
    case "button":
      return {
        id,
        name,
        type,
        props: {
          label: "Clique aqui",
          href: "/dashboard",
          linkType: "app",
          bgColor: "#16a34a",
          textColor: "#ffffff",
          radius: 6,
          paddingY: 10,
          paddingX: 20,
          align: "center",
        },
      };
    case "divider":
      return { id, name, type, props: { color: "#e2e8f0", thickness: 1, marginY: 16 } };
  }
}

/** Gives every block (and column) in a tree fresh ids — used when duplicating/cloning defaults. */
export function cloneWithNewIds(tree: BlockTree): BlockTree {
  const reId = <T extends { id: string }>(b: T): T => ({ ...b, id: generateBlockId() });
  return tree.map((block) => {
    if (block.type === "row") {
      return reId({ ...block, children: block.children.map((c) => reId({ ...c, children: c.children.map(reId) })) });
    }
    if (block.type === "container") return reId({ ...block, children: block.children.map(reId) });
    return reId(block);
  });
}

/** Locates a block anywhere in the tree, with its location and position among its siblings. */
export function findBlock(
  tree: BlockTree,
  id: string
): { block: Block | LeafBlock; location: BlockLocation; index: number; siblings: number } | null {
  for (let i = 0; i < tree.length; i++) {
    const block = tree[i];
    if (block.id === id) return { block, location: { type: "top" }, index: i, siblings: tree.length };
    if (block.type === "row") {
      for (const column of block.children) {
        const idx = column.children.findIndex((c) => c.id === id);
        if (idx >= 0) {
          return {
            block: column.children[idx],
            location: { type: "column", rowId: block.id, columnId: column.id },
            index: idx,
            siblings: column.children.length,
          };
        }
      }
    }
    if (block.type === "container") {
      const idx = block.children.findIndex((c) => c.id === id);
      if (idx >= 0) {
        return {
          block: block.children[idx],
          location: { type: "container", containerId: block.id },
          index: idx,
          siblings: block.children.length,
        };
      }
    }
  }
  return null;
}

/** Applies `fn` to the child list at `location` (top level, a column, or a container). */
function mapList(tree: BlockTree, location: BlockLocation, fn: (list: (Block | LeafBlock)[]) => (Block | LeafBlock)[]): BlockTree {
  if (location.type === "top") return fn(tree) as BlockTree;
  return tree.map((block) => {
    if (location.type === "container" && block.type === "container" && block.id === location.containerId) {
      return { ...block, children: fn(block.children) as LeafBlock[] };
    }
    if (location.type === "column" && block.type === "row" && block.id === location.rowId) {
      return {
        ...block,
        children: block.children.map((col) =>
          col.id === location.columnId ? { ...col, children: fn(col.children) as LeafBlock[] } : col
        ),
      };
    }
    return block;
  });
}

export function insertBlock(tree: BlockTree, block: Block, location: BlockLocation, index?: number): BlockTree {
  if (location.type !== "top" && (block.type === "row" || block.type === "container")) return tree;
  return mapList(tree, location, (list) => {
    const next = [...list];
    next.splice(index ?? next.length, 0, block);
    return next;
  });
}

export function updateBlock(tree: BlockTree, id: string, updater: (block: Block | LeafBlock) => Block | LeafBlock): BlockTree {
  const found = findBlock(tree, id);
  if (!found) return tree;
  return mapList(tree, found.location, (list) => list.map((b) => (b.id === id ? updater(b) : b)));
}

export function removeBlock(tree: BlockTree, id: string): BlockTree {
  const found = findBlock(tree, id);
  if (!found) return tree;
  return mapList(tree, found.location, (list) => list.filter((b) => b.id !== id));
}

/** Moves a block to `toIndex` within its own list. */
export function moveBlockTo(tree: BlockTree, id: string, toIndex: number): BlockTree {
  const found = findBlock(tree, id);
  if (!found || toIndex < 0 || toIndex >= found.siblings || toIndex === found.index) return tree;
  return mapList(tree, found.location, (list) => {
    const next = [...list];
    const [moved] = next.splice(found.index, 1);
    next.splice(toIndex, 0, moved);
    return next;
  });
}

export function duplicateBlock(tree: BlockTree, id: string): BlockTree {
  const found = findBlock(tree, id);
  if (!found) return tree;
  const [copy] = cloneWithNewIds([found.block as Block]);
  const named = { ...copy, name: generateDefaultBlockName(copy.type, tree) } as Block;
  return insertBlock(tree, named, found.location, found.index + 1);
}

export function addColumnToRow(tree: BlockTree, rowId: string): BlockTree {
  return tree.map((block) => {
    if (block.type !== "row" || block.id !== rowId || block.children.length >= 6) return block;
    const children = [...block.children, createColumn(0)];
    const widths = evenWidths(children.length);
    return { ...block, children: children.map((c, i) => ({ ...c, props: { widthPercent: widths[i] } })) };
  });
}

export function removeColumnFromRow(tree: BlockTree, rowId: string, columnId: string): BlockTree {
  return tree.map((block) => {
    if (block.type !== "row" || block.id !== rowId || block.children.length <= 1) return block;
    const children = block.children.filter((c) => c.id !== columnId);
    const widths = evenWidths(children.length);
    return { ...block, children: children.map((c, i) => ({ ...c, props: { widthPercent: widths[i] } })) };
  });
}

/** Sets one column's width and spreads the difference over the column to its right (or left, for the last one). */
export function resizeColumn(tree: BlockTree, rowId: string, columnId: string, widthPercent: number): BlockTree {
  return tree.map((block) => {
    if (block.type !== "row" || block.id !== rowId || block.children.length < 2) return block;
    const idx = block.children.findIndex((c) => c.id === columnId);
    if (idx < 0) return block;
    const neighbor = idx < block.children.length - 1 ? idx + 1 : idx - 1;
    const total = block.children[idx].props.widthPercent + block.children[neighbor].props.widthPercent;
    const own = Math.min(Math.max(Math.round(widthPercent), 5), total - 5);
    return {
      ...block,
      children: block.children.map((c, i) =>
        i === idx ? { ...c, props: { widthPercent: own } } : i === neighbor ? { ...c, props: { widthPercent: total - own } } : c
      ),
    };
  });
}
