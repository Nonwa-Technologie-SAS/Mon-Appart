/** Dates converties en chaînes ISO, récursivement (réponses JSON et Socket.IO). */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T

export function serialize<T>(value: T): Serialized<T> {
  return convert(value) as Serialized<T>
}

function convert(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(convert)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, convert(entry)]),
    )
  }
  return value
}
