/**
 * Brouillon local de publication — champs texte uniquement (pas de photos,
 * pas de secrets). Isolé par onglet via sessionStorage. À effacer après succès.
 */

export const PUBLISH_DRAFT_KEY = "mon-appart:publish-draft:v1"

export type PublishDraftFields = {
  title?: string
  description?: string
  price?: string
  type?: string
  location?: string
  beds?: string
  baths?: string
  surface?: string
}

export function readPublishDraft(): PublishDraftFields | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PUBLISH_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PublishDraftFields
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export function writePublishDraft(fields: PublishDraftFields): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(PUBLISH_DRAFT_KEY, JSON.stringify(fields))
  } catch {
    // quota / mode privé
  }
}

export function clearPublishDraft(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(PUBLISH_DRAFT_KEY)
  } catch {
    // ignore
  }
}

export function draftFromForm(form: HTMLFormElement): PublishDraftFields {
  const data = new FormData(form)
  const pick = (name: string) => {
    const value = data.get(name)
    return typeof value === "string" ? value : undefined
  }
  return {
    title: pick("title"),
    description: pick("description"),
    price: pick("price"),
    type: pick("type"),
    location: pick("location"),
    beds: pick("beds"),
    baths: pick("baths"),
    surface: pick("surface"),
  }
}
