import type {
  ConversationStatus,
  ConversationType,
  ListingStatus,
  ListingType,
  MessageType,
  ParticipantRole,
} from "../../../../generated/prisma/enums"
import type { MediaAttachmentInfo } from "../../../media"
import {
  displayName,
  messageStatus,
  type MessageStatus,
  type ParticipantSide,
} from "../domain/message-rules"
import type {
  ConversationRow,
  MessageRow,
  ParticipantRow,
} from "../infrastructure/conversation.repository"

export interface PersonView {
  id: string | null
  role: ParticipantRole | "SYSTEM"
  displayName: string
}

export interface AttachmentView {
  id: string
  type: string
  mimeType: string
  size: number
  filename: string | null
  width: number | null
  height: number | null
  ready: boolean
}

export interface MessageView {
  id: string
  conversationId: string
  seq: number
  type: MessageType
  body: string | null
  systemCode: string | null
  data: Record<string, unknown>
  author: PersonView | null
  mine: boolean
  /** Pour mes messages : SENT, DELIVERED ou READ. `null` sinon. */
  status: MessageStatus | null
  attachments: AttachmentView[]
  deleted: boolean
  createdAt: Date
}

export interface ConversationView {
  id: string
  type: ConversationType
  status: ConversationStatus
  side: ParticipantSide
  listing: {
    id: string
    title: string
    listingType: ListingType
    status: ListingStatus
  }
  /** Interlocuteurs actifs, sans coordonnées. */
  participants: PersonView[]
  lastMessage: MessageView | null
  unread: number
  lastReadSeq: number
  lastSeq: number
  archived: boolean
  muted: boolean
  lastActivityAt: Date
  closedAt: Date | null
  createdAt: Date
}

type Person = {
  publicId: string
  firstName: string | null
  lastName: string | null
}

export function personView(
  user: Person | null,
  role: ParticipantRole,
): PersonView {
  return { id: user?.publicId ?? null, role, displayName: displayName(user) }
}

export function attachmentView(info: MediaAttachmentInfo): AttachmentView {
  return {
    id: info.mediaId,
    type: info.type,
    mimeType: info.mimeType,
    size: info.fileSize,
    filename: info.filename,
    width: info.width,
    height: info.height,
    ready: info.status === "READY" && !info.deleted,
  }
}

export function messageView(
  row: MessageRow,
  context: {
    conversationPublicId: string
    viewerId: bigint
    /** Rôle de l'auteur dans la conversation (déduit côté serveur). */
    authorRole: (authorId: bigint) => ParticipantRole
    counterpart: { readSeq: number; deliveredSeq: number }
    media: Map<bigint, MediaAttachmentInfo>
  },
): MessageView {
  const mine = row.authorId !== null && row.authorId === context.viewerId
  const deleted = row.deletedAt !== null
  return {
    id: row.publicId,
    conversationId: context.conversationPublicId,
    seq: row.seq,
    type: row.type,
    body: deleted ? null : row.body,
    systemCode: row.systemCode,
    data: asObject(row.data),
    author:
      row.type === "SYSTEM"
        ? null
        : personView(
            row.author,
            row.authorId === null
              ? "REQUESTER"
              : context.authorRole(row.authorId),
          ),
    mine,
    status: mine ? messageStatus(row.seq, context.counterpart) : null,
    attachments: deleted
      ? []
      : row.attachments.flatMap((attachment) => {
          const info = context.media.get(attachment.mediaId)
          return info ? [attachmentView(info)] : []
        }),
    deleted,
    createdAt: row.createdAt,
  }
}

export function conversationView(
  conversation: ConversationRow & {
    listing: ConversationView["listing"] & { publicId: string }
  },
  context: {
    side: ParticipantSide
    participant: Pick<
      ParticipantRow,
      "lastReadSeq" | "archivedAt" | "muted"
    > | null
    participants: PersonView[]
    lastMessage: MessageView | null
    unread: number
  },
): ConversationView {
  return {
    id: conversation.publicId,
    type: conversation.type,
    status: conversation.status,
    side: context.side,
    listing: {
      id: conversation.listing.publicId,
      title: conversation.listing.title,
      listingType: conversation.listing.listingType,
      status: conversation.listing.status,
    },
    participants: context.participants,
    lastMessage: context.lastMessage,
    unread: context.unread,
    lastReadSeq: context.participant?.lastReadSeq ?? 0,
    lastSeq: conversation.lastSeq,
    archived: Boolean(context.participant?.archivedAt),
    muted: context.participant?.muted ?? false,
    lastActivityAt: conversation.lastActivityAt,
    closedAt: conversation.closedAt,
    createdAt: conversation.createdAt,
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
