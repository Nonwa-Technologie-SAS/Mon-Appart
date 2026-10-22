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
import { networkErrorMessage } from "@/lib/network"
import {
  clearPublishDraft,
  draftFromForm,
  readPublishDraft,
  writePublishDraft,
  type PublishDraftFields,
} from "@/lib/publish-draft"
import { uploadPropertyImages } from "@/lib/upload-property-images"

export function PublishPropertyForm() {
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<PhotoDraft[]>([])
  const [textDraft, setTextDraft] = useState<PublishDraftFields | null>(null)
  const draftsRef = useRef(drafts)
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  draftsRef.current = drafts

  useEffect(() => {
    setTextDraft(readPublishDraft() ?? {})
  }, [])

  useEffect(() => {
    return () => {
      draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.preview))
    }
  }, [])

  if (textDraft === null) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Chargement du formulaire…
      </p>
    )
  }

  function persistTextDraft() {
    const form = formRef.current
    if (!form) return
    writePublishDraft(draftFromForm(form))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.delete("images")
    setError(null)
    writePublishDraft(draftFromForm(form))

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
          return
        }
        clearPublishDraft()
      } catch (err) {
        setError(networkErrorMessage(err))
      }
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={persistTextDraft}
      className="space-y-8"
    >
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Étapes de publication">
        {(
          [
            { n: 1, label: "Infos" },
            { n: 2, label: "Caractéristiques" },
            { n: 3, label: "Photos" },
          ] as const
        ).map((step) => (
          <li
            key={step.n}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {step.n}
            </span>
            {step.label}
          </li>
        ))}
      </ol>

      <FieldGroup>
        <p className="text-sm font-semibold text-foreground">1. Infos principales</p>
        <Field data-disabled={isPending || undefined}>
          <FieldLabel htmlFor="title">Titre de l&apos;annonce</FieldLabel>
          <Input
            id="title"
            name="title"
            required
            minLength={3}
            disabled={isPending}
            defaultValue={textDraft.title}
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
            defaultValue={textDraft.description}
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
              defaultValue={textDraft.price}
              placeholder="450000"
              className="min-h-11"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="type">Type de bien</FieldLabel>
            <NativeSelect
              id="type"
              name="type"
              required
              disabled={isPending}
              defaultValue={textDraft.type}
              className="min-h-11"
            >
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
            defaultValue={textDraft.location}
            placeholder="Cocody, Abidjan"
            autoComplete="address-level2"
            className="min-h-11"
          />
          <FieldDescription>
            Ville ou quartier. Les coordonnées GPS sont calculées
            automatiquement à la publication. Un brouillon texte est conservé
            dans cet onglet en cas d’interruption réseau (pas les photos).
          </FieldDescription>
        </Field>

        <p className="pt-2 text-sm font-semibold text-foreground">
          2. Caractéristiques
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="beds">Chambres</FieldLabel>
            <Input
              id="beds"
              name="beds"
              inputMode="numeric"
              disabled={isPending}
              defaultValue={textDraft.beds}
              placeholder="3"
              className="min-h-11"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="baths">Salles de bain</FieldLabel>
            <Input
              id="baths"
              name="baths"
              inputMode="numeric"
              disabled={isPending}
              defaultValue={textDraft.baths}
              placeholder="2"
              className="min-h-11"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="surface">Surface</FieldLabel>
            <Input
              id="surface"
              name="surface"
              disabled={isPending}
              defaultValue={textDraft.surface}
              placeholder="120 m²"
              className="min-h-11"
            />
          </Field>
        </div>

        <p className="pt-2 text-sm font-semibold text-foreground">3. Photos</p>
        <PhotoLayoutEditor
          drafts={drafts}
          onChange={setDrafts}
          disabled={isPending}
        />
        {error ? <FieldError>{error}</FieldError> : null}
        <Button
          type="submit"
          disabled={isPending}
          className="min-h-11 w-full sm:w-auto"
        >
          {isPending ? "Publication…" : "Publier le bien"}
        </Button>
      </FieldGroup>
    </form>
  )
}
