import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { DatabaseService, type Db } from "../../../database/database.service"
import type { Actor } from "../../identity"
import { adminError } from "../domain/admin-errors"
import { AdminActivity, AdminAuditAction } from "./admin-activity"

export type NoteEntity = "user" | "listing"

export interface AdminNoteView {
  id: string
  body: string
  author: { id: string; name: string | null } | null
  createdAt: string
}

const NOTE_LIMIT = 50

/**
 * Notes internes du back-office, en ajout seul (trigger). Jamais renvoyées
 * aux utilisateurs ni copiées dans les notifications ou l'analytique.
 */
@Injectable()
export class AdminNoteService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: AdminActivity,
  ) {}

  async add(
    actor: Actor,
    entityType: NoteEntity,
    entityId: string,
    body: string,
    context: RequestContext | null,
    tx?: Db,
  ): Promise<AdminNoteView> {
    const text = body.trim()
    const run = async (db: Db) => {
      await this.assertTarget(entityType, entityId, db)
      const note = await db.adminNote.create({
        data: {
          entityType,
          entityId,
          authorId: actor.userId,
          body: text.slice(0, 2000),
        },
        select: noteSelect,
      })
      await this.activity.audit(
        {
          action: AdminAuditAction.NOTE_ADDED,
          actorId: actor.userId,
          entityType,
          entityId,
          newValues: { noteId: note.publicId },
        },
        context,
        db,
      )
      return toView(note)
    }
    return tx ? run(tx) : this.db.transaction(run)
  }

  async list(
    entityType: NoteEntity,
    entityId: string,
  ): Promise<AdminNoteView[]> {
    const notes = await this.db.client.adminNote.findMany({
      where: { entityType, entityId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: NOTE_LIMIT,
      select: noteSelect,
    })
    return notes.map(toView)
  }

  private async assertTarget(
    entityType: NoteEntity,
    entityId: string,
    db: Db,
  ): Promise<void> {
    if (entityType === "user") {
      const user = await db.user.findFirst({
        where: { publicId: entityId, deletedAt: null },
        select: { id: true },
      })
      if (!user) throw adminError("USER_NOT_FOUND")
      return
    }
    const listing = await db.listing.findUnique({
      where: { publicId: entityId },
      select: { id: true },
    })
    if (!listing) throw adminError("LISTING_NOT_FOUND")
  }
}

const noteSelect = {
  publicId: true,
  body: true,
  createdAt: true,
  author: { select: { publicId: true, firstName: true, lastName: true } },
} as const

function toView(note: {
  publicId: string
  body: string
  createdAt: Date
  author: {
    publicId: string
    firstName: string | null
    lastName: string | null
  } | null
}): AdminNoteView {
  return {
    id: note.publicId,
    body: note.body,
    author: note.author
      ? {
          id: note.author.publicId,
          name: displayName(note.author),
        }
      : null,
    createdAt: note.createdAt.toISOString(),
  }
}

export function displayName(user: {
  firstName: string | null
  lastName: string | null
}): string | null {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ")
  return name || null
}
