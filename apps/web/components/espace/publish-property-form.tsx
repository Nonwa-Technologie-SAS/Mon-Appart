"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { publishProperty } from "@/app/actions/properties"
import {
  PhotoLayoutEditor,
  type PhotoDraft,
} from "@/components/espace/photo-layout-editor"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { PROPERTY_TYPE_OPTIONS } from "@/lib/format"
import { uploadPropertyImages } from "@/lib/upload-property-images"

export function PublishPropertyForm() {
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<PhotoDraft[]>([])
  const draftsRef = useRef(drafts)
  const [isPending, startTransition] = useTransition()
  draftsRef.current = drafts

  useEffect(() => {
    return () => {
      draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.preview))
    }
  }, [])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.delete("images")
    setError(null)

    startTransition(async () => {
      try {
        const currentDrafts = draftsRef.current
        const imageUrls =
          currentDrafts.length > 0
            ? await uploadPropertyImages(currentDrafts.map((draft) => draft.file))
            : []
        const imageLayout = imageUrls.map((url, index) => ({
          url,
          room: currentDrafts[index]?.room ?? "OTHER",
          sortOrder: index,
        }))
        formData.set("imageLayout", JSON.stringify(imageLayout))

        const result = await publishProperty({}, formData)
        if (result?.error) {
          setError(result.error)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible de publier le bien"
        )
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-disabled={isPending || undefined}>
          <FieldLabel htmlFor="title">Titre de l&apos;annonce</FieldLabel>
          <Input
            id="title"
            name="title"
            required
            minLength={3}
            disabled={isPending}
            placeholder="Villa contemporaine — Cocody"
          />
        </Field>
        <Field data-disabled={isPending || undefined}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            required
            minLength={10}
            disabled={isPending}
            placeholder="Décrivez le bien, le quartier et les points forts."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="price">Loyer mensuel (F CFA)</FieldLabel>
            <Input
              id="price"
              name="price"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              disabled={isPending}
              placeholder="450000"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="type">Type de bien</FieldLabel>
            <NativeSelect id="type" name="type" required disabled={isPending}>
              {PROPERTY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field data-disabled={isPending || undefined}>
          <FieldLabel htmlFor="location">Localisation</FieldLabel>
          <Input
            id="location"
            name="location"
            required
            disabled={isPending}
            placeholder="Cocody, Abidjan"
          />
          <FieldDescription>
            Ville ou quartier. Les coordonnées GPS sont calculées
            automatiquement à la publication.
          </FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="beds">Chambres</FieldLabel>
            <Input
              id="beds"
              name="beds"
              disabled={isPending}
              placeholder="3"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="baths">Salles de bain</FieldLabel>
            <Input
              id="baths"
              name="baths"
              disabled={isPending}
              placeholder="2"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="surface">Surface</FieldLabel>
            <Input
              id="surface"
              name="surface"
              disabled={isPending}
              placeholder="120 m²"
            />
          </Field>
        </div>
        <PhotoLayoutEditor
          drafts={drafts}
          onChange={setDrafts}
          disabled={isPending}
        />
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Publication…" : "Publier le bien"}
        </Button>
      </FieldGroup>
    </form>
  )
}
