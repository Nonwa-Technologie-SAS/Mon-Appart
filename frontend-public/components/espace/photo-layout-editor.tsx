"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { MAX_PROPERTY_IMAGES } from "@/lib/upload-constants"
import {
  VISIT_ROOM_LABELS,
  VISIT_ROOM_OPTIONS,
  VISIT_ROOMS,
  type VisitRoom,
} from "@/lib/visit-rooms"

export type PhotoDraft = {
  key: string
  file: File
  preview: string
  room: VisitRoom
}

export function PhotoLayoutEditor({
  drafts,
  onChange,
  disabled = false,
}: {
  drafts: PhotoDraft[]
  onChange: (drafts: PhotoDraft[]) => void
  disabled?: boolean
}) {
  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []).filter((file) => file.size > 0)
    if (incoming.length === 0) return

    onChange([
      ...drafts,
      ...incoming.slice(0, Math.max(0, MAX_PROPERTY_IMAGES - drafts.length)).map(
        (file) => ({
          key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          preview: URL.createObjectURL(file),
          room: "OTHER" as const,
        })
      ),
    ])
  }

  function updateRoom(key: string, room: VisitRoom) {
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, room } : draft)))
  }

  function moveDraft(key: string, direction: -1 | 1) {
    const index = drafts.findIndex((draft) => draft.key === key)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= drafts.length) return
    const next = drafts.slice()
    const current = next[index]
    const swap = next[nextIndex]
    if (!current || !swap) return
    next[index] = swap
    next[nextIndex] = current
    onChange(next)
  }

  function removeDraft(key: string) {
    const draft = drafts.find((item) => item.key === key)
    if (draft) URL.revokeObjectURL(draft.preview)
    onChange(drafts.filter((item) => item.key !== key))
  }

  const roomsInTour = VISIT_ROOMS.filter((room) =>
    drafts.some((draft) => draft.room === room)
  )

  return (
    <Field data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="images">Photos et disposition de la visite</FieldLabel>
      <Input
        id="images"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        disabled={disabled || drafts.length >= MAX_PROPERTY_IMAGES}
        className="max-w-full"
        onChange={(event) => {
          addFiles(event.target.files)
          event.currentTarget.value = ""
        }}
      />
      <FieldDescription>
        Jusqu&apos;à {MAX_PROPERTY_IMAGES} photos. Classez-les par pièce : la
        visite en ligne suivra ce parcours (entrée, salon, cuisine…).
      </FieldDescription>

      {drafts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {roomsInTour.length > 0 ? (
            <ol className="flex flex-wrap gap-2">
              {roomsInTour.map((room, index) => (
                <li
                  key={room}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                >
                  {index + 1}. {VISIT_ROOM_LABELS[room]}
                  {" · "}
                  {drafts.filter((draft) => draft.room === room).length}
                </li>
              ))}
            </ol>
          ) : null}

          <ul className="flex flex-col gap-3">
            {drafts.map((draft, index) => (
              <li
                key={draft.key}
                className="flex gap-3 rounded-xl border border-border bg-card p-3"
              >
                <DraftPreview src={draft.preview} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="truncate text-sm font-medium">{draft.file.name}</p>
                  <NativeSelect
                    aria-label="Pièce de la visite"
                    value={draft.room}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRoom(draft.key, event.target.value as VisitRoom)
                    }
                  >
                    {VISIT_ROOM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={disabled || index === 0}
                      aria-label="Monter la photo"
                      onClick={() => moveDraft(draft.key, -1)}
                    >
                      <ChevronUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={disabled || index === drafts.length - 1}
                      aria-label="Descendre la photo"
                      onClick={() => moveDraft(draft.key, 1)}
                    >
                      <ChevronDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      aria-label="Retirer la photo"
                      onClick={() => removeDraft(draft.key)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Field>
  )
}

function DraftPreview({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="size-20 shrink-0 rounded-lg bg-muted sm:size-24" />
    )
  }

  return (
    // Local blob previews are not in the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="size-20 shrink-0 rounded-lg object-cover sm:size-24"
    />
  )
}
