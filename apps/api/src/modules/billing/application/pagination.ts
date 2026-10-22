export interface Page<T> {
  items: T[]
  /** Identifiant public du dernier élément ; jamais un identifiant interne. */
  nextCursor: string | null
}

/** `rows` lu avec `take: limit + 1` et un curseur Prisma sur `publicId`. */
export function pageOf<Row extends { publicId: string }, View>(
  rows: Row[],
  limit: number,
  toView: (row: Row) => View,
): Page<View> {
  const more = rows.length > limit
  const items = more ? rows.slice(0, limit) : rows
  return {
    items: items.map(toView),
    nextCursor: more ? items[items.length - 1]!.publicId : null,
  }
}
