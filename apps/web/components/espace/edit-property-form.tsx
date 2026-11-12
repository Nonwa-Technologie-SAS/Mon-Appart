"use client"

import { useState, useTransition } from "react"

import { updateOwnedListing } from "@/app/actions/properties"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PropertyType } from "@/lib/domain-enums"
import { formatPropertyType } from "@/lib/format"
import type { OwnedListingEdit } from "@/lib/nest-publish"
import { networkErrorMessage } from "@/lib/network"

export function EditPropertyForm({ listing }: { listing: OwnedListingEdit }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        const result = await updateOwnedListing({}, formData)
        if (result?.error) setError(result.error)
      } catch (err) {
        setError(networkErrorMessage(err))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="listingId" value={listing.listingId} />
      <input type="hidden" name="propertyId" value={listing.propertyId} />
      <FieldGroup>
        <p className="text-sm text-muted-foreground">
          Type :{" "}
          <span className="font-medium text-foreground">
            {formatPropertyType(
              (Object.values(PropertyType) as string[]).includes(listing.type)
                ? (listing.type as PropertyType)
                : PropertyType.APARTMENT,
            )}
          </span>
        </p>
        <Field data-disabled={isPending || undefined}>
          <FieldLabel htmlFor="title">Titre de l&apos;annonce</FieldLabel>
          <Input
            id="title"
            name="title"
            required
            minLength={3}
            disabled={isPending}
            defaultValue={listing.title}
            className="min-h-11"
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
            defaultValue={listing.description}
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
              defaultValue={listing.price || undefined}
              className="min-h-11"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="location">Localisation</FieldLabel>
            <Input
              id="location"
              name="location"
              required
              disabled={isPending}
              defaultValue={listing.location}
              className="min-h-11"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="beds">Chambres</FieldLabel>
            <Input
              id="beds"
              name="beds"
              inputMode="numeric"
              disabled={isPending}
              defaultValue={listing.beds}
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
              defaultValue={listing.baths}
              className="min-h-11"
            />
          </Field>
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="surface">Surface</FieldLabel>
            <Input
              id="surface"
              name="surface"
              disabled={isPending}
              defaultValue={listing.surface}
              className="min-h-11"
            />
          </Field>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button
          type="submit"
          disabled={isPending}
          className="min-h-11 w-full sm:w-auto"
        >
          {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </FieldGroup>
    </form>
  )
}
