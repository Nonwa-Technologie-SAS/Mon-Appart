"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

const KEY = "mon-appart:growth:saved-search:v1"

/**
 * Mémorise localement les critères (fondation alertes).
 * N’envoie aucune notification tant que le job d’alerte n’existe pas.
 */
export function SaveSearchCriteria({
  q,
  type,
  maxPrice,
}: {
  q?: string
  type?: string
  maxPrice?: string
}) {
  const [status, setStatus] = useState<string | null>(null)

  function save() {
    const record = {
      q: q ?? null,
      type: type ?? null,
      maxPrice: maxPrice ?? null,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(record))
      setStatus(
        "Critères mémorisés sur cet appareil. Les alertes arriveront lorsque le module d’alertes sera activé — aucune notification fictive.",
      )
    } catch {
      setStatus("Impossible d’enregistrer (stockage indisponible).")
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm">
      <p className="text-muted-foreground">
        Aucun bien pour ces critères ? Mémorisez-les pour une future alerte
        (stockage local uniquement, sans spam).
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={save}
      >
        Mémoriser ces critères
      </Button>
      {status ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
}
