"use client"

import { useActionState, useState } from "react"

import {
  createSavedSearch,
  type RetentionActionState,
} from "@/app/actions/retention"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const KEY = "mon-appart:growth:saved-search:v1"
const initial: RetentionActionState = {}

/**
 * Enregistre une recherche sur le compte (alertes) ou localement si déconnecté.
 */
export function SaveSearchCriteria({
  q,
  type,
  maxPrice,
  signedIn = false,
}: {
  q?: string
  type?: string
  maxPrice?: string
  signedIn?: boolean
}) {
  const [localStatus, setLocalStatus] = useState<string | null>(null)
  const [state, formAction, pending] = useActionState(
    createSavedSearch,
    initial,
  )

  function saveLocal() {
    const record = {
      q: q ?? null,
      type: type ?? null,
      maxPrice: maxPrice ?? null,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(record))
      setLocalStatus(
        "Critères mémorisés sur cet appareil. Connectez-vous pour recevoir des alertes.",
      )
    } catch {
      setLocalStatus("Impossible d’enregistrer (stockage indisponible).")
    }
  }

  if (!signedIn) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm">
        <p className="text-muted-foreground">
          Aucun bien pour ces critères ? Mémorisez-les sur cet appareil, ou
          connectez-vous pour activer des alertes réellement ciblées.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={saveLocal}
        >
          Mémoriser ces critères
        </Button>
        {localStatus ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {localStatus}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm"
    >
      <p className="text-muted-foreground">
        Enregistrez cette recherche pour la reprendre plus tard et recevoir un
        résumé des nouvelles annonces compatibles — pas de spam.
      </p>
      <input type="hidden" name="q" value={q ?? ""} />
      <input type="hidden" name="listingType" value={type ?? ""} />
      <input type="hidden" name="maxPrice" value={maxPrice ?? ""} />
      <input type="hidden" name="alertsEnabled" value="true" />
      <label
        className="mt-2 block text-xs font-medium"
        htmlFor="saved-search-name"
      >
        Nom de la recherche
      </label>
      <Input
        id="saved-search-name"
        name="name"
        required
        minLength={2}
        maxLength={80}
        placeholder="Ex. Appartement Cocody"
        className="mt-1"
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={pending}
      >
        {pending ? "Enregistrement…" : "Enregistrer et activer les alertes"}
      </Button>
      {state.success ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Recherche enregistrée. Vous pourrez la reprendre depuis votre profil.
        </p>
      ) : null}
      {state.error ? (
        <p className="mt-2 text-xs text-destructive" role="status">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
