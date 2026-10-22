import { Injectable } from "@nestjs/common"

import {
  isUniqueViolation,
  type Tx,
} from "../../../../database/database.service"
import { Prisma } from "../../../../generated/prisma/client"
import type { AppointmentStatus } from "../../../../generated/prisma/enums"
import type { Actor, ClientContext } from "../../../identity"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import { communicationError } from "../../domain/communication-errors"
import {
  APPOINTMENT_ENTITY,
  CommunicationAuditAction,
  CommunicationEvent,
  RealtimeEvent,
} from "../../domain/communication-events"
import { ConversationAccessService } from "../../messaging/application/conversation-access.service"
import { ConversationService } from "../../messaging/application/conversation.service"
import { MessageService } from "../../messaging/application/message.service"
import {
  personView,
  type PersonView,
} from "../../messaging/application/messaging-views"
import {
  SystemCode,
  type ParticipantSide,
} from "../../messaging/domain/message-rules"
import {
  ConversationRepository,
  peopleSelect,
  type MessageRow,
} from "../../messaging/infrastructure/conversation.repository"
import { NotificationService } from "../../notifications/application/notification.service"
import { RealtimePublisher } from "../../realtime/realtime.publisher"
import { serialize } from "../../presentation/serialize"
import {
  availableActions,
  canPerform,
  checkVisitTime,
  isValidTimeZone,
  nextStatus,
  type AppointmentAction,
  type AppointmentState,
  type CancellationReason,
} from "../domain/appointment-rules"

export interface RequestVisitInput {
  listingId: string
  scheduledAt: Date
  timezone?: string
  durationMinutes?: number
  notes?: string
}

export interface AppointmentView {
  id: string
  status: AppointmentStatus
  side: ParticipantSide
  scheduledAt: Date
  timezone: string
  durationMinutes: number
  notes: string | null
  proposedAt: Date | null
  proposedBy: ParticipantSide | null
  listing: { id: string; title: string }
  conversationId: string | null
  requester: PersonView
  confirmedAt: Date | null
  cancelledAt: Date | null
  cancelledBy: ParticipantSide | null
  cancellationReason: string | null
  completedAt: Date | null
  createdAt: Date
  /** Actions que je peux faire maintenant. */
  actions: AppointmentAction[]
}

const appointmentSelect = {
  id: true,
  publicId: true,
  userId: true,
  propertyId: true,
  listingId: true,
  conversationId: true,
  scheduledAt: true,
  timezone: true,
  durationMinutes: true,
  status: true,
  notes: true,
  proposedAt: true,
  proposedById: true,
  confirmedAt: true,
  cancelledAt: true,
  cancelledById: true,
  cancellationReason: true,
  completedAt: true,
  createdAt: true,
  listing: { select: { publicId: true, title: true } },
  conversation: {
    select: { id: true, publicId: true, requesterId: true, status: true },
  },
  user: { select: peopleSelect },
} as const satisfies Prisma.AppointmentSelect

type AppointmentRow = Prisma.AppointmentGetPayload<{
  select: typeof appointmentSelect
}>

interface AfterCommit {
  appointment: AppointmentRow
  message: MessageRow | null
}

const DEFAULT_TIMEZONE = "Africa/Abidjan"
const LIST_LIMIT = 100

/**
 * Visites : demande par le client, confirmation par le côté annonce, nouvelle
 * date à accepter par l'autre partie, annulation, puis issue. Chaque étape
 * est conditionnelle à l'état lu sous verrou, écrit un message SYSTEM dans la
 * conversation, est auditée et notifie l'autre partie.
 */
@Injectable()
export class AppointmentService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly conversationService: ConversationService,
    private readonly access: ConversationAccessService,
    private readonly messages: MessageService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimePublisher,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
  ) {}

  async request(
    actor: Actor,
    input: RequestVisitInput,
    client: ClientContext,
  ): Promise<AppointmentView> {
    const timezone = input.timezone ?? DEFAULT_TIMEZONE
    if (!isValidTimeZone(timezone)) {
      throw communicationError("APPOINTMENT_TIME_INVALID", "fuseau horaire")
    }
    this.assertTime(input.scheduledAt)
    const listing = await this.conversationService.contactableListing(
      input.listingId,
      actor.userId,
    )

    let result: AfterCommit
    try {
      result = await this.conversations.transaction(async (tx) => {
        const existing = await this.conversations.findForRequester(
          listing.id,
          actor.userId,
          tx,
        )
        let conversationId: bigint
        let inquiryId: bigint
        if (existing) {
          if (existing.status !== "OPEN") {
            throw communicationError("CONVERSATION_CLOSED")
          }
          await this.access.resolveLoaded(actor.userId, existing, tx)
          const inquiry = await tx.inquiry.create({
            data: {
              userId: actor.userId,
              propertyId: listing.propertyId,
              listingId: listing.id,
              ownerId: listing.ownerId,
              type: "REQUEST_VISIT",
              message: null,
            },
            select: { id: true },
          })
          conversationId = existing.id
          inquiryId = inquiry.id
        } else {
          const opened = await this.conversationService.open(
            tx,
            actor,
            listing,
            "VISIT_COORDINATION",
            "REQUEST_VISIT",
          )
          conversationId = opened.conversation.id
          inquiryId = opened.conversation.inquiryId!
        }
        const created = await tx.appointment.create({
          data: {
            userId: actor.userId,
            propertyId: listing.propertyId,
            listingId: listing.id,
            ownerId: listing.ownerId,
            conversationId,
            inquiryId,
            scheduledAt: input.scheduledAt,
            timezone,
            durationMinutes: input.durationMinutes ?? 60,
            notes: input.notes?.trim() || null,
          },
          select: appointmentSelect,
        })
        const message = await this.messages.appendSystem(
          tx,
          created.conversation!,
          SystemCode.APPOINTMENT_REQUESTED,
          {
            appointmentId: created.publicId,
            scheduledAt: created.scheduledAt.toISOString(),
            timezone,
            by: "REQUESTER",
          },
          actor.userId,
        )
        await this.notifyOtherSide(tx, created, "REQUESTER", {
          title: "Nouvelle demande de visite",
          body: `Pour « ${created.listing.title} »`,
          key: "requested",
        })
        await this.audit(
          tx,
          actor,
          created,
          CommunicationAuditAction.APPOINTMENT_REQUESTED,
          { scheduledAt: created.scheduledAt.toISOString() },
          client,
        )
        return { appointment: created, message }
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw communicationError("APPOINTMENT_ALREADY_ACTIVE")
      }
      throw error
    }
    await this.afterCommit(result)
    return this.view(result.appointment, "REQUESTER", new Date())
  }

  async list(
    actor: Actor,
    query: { scope?: "upcoming" | "past"; limit?: number },
  ): Promise<AppointmentView[]> {
    const now = new Date()
    const upcoming = (query.scope ?? "upcoming") === "upcoming"
    const rows = await this.conversations.client.appointment.findMany({
      where: {
        AND: [
          {
            OR: [
              { userId: actor.userId },
              {
                property: {
                  ownerships: {
                    some: { ownerId: actor.userId, isCurrent: true },
                  },
                },
              },
            ],
          },
          upcoming
            ? {
                OR: [
                  { scheduledAt: { gte: now } },
                  { status: { in: ["PENDING", "RESCHEDULE_REQUESTED"] } },
                ],
              }
            : { scheduledAt: { lt: now } },
        ],
      },
      orderBy: { scheduledAt: upcoming ? "asc" : "desc" },
      take: Math.min(Math.max(query.limit ?? 50, 1), LIST_LIMIT),
      select: appointmentSelect,
    })
    return rows.map((row) =>
      this.view(
        row,
        row.userId === actor.userId ? "REQUESTER" : "LISTING_SIDE",
        now,
      ),
    )
  }

  async get(
    actor: Actor,
    appointmentPublicId: string,
  ): Promise<AppointmentView> {
    const row = await this.conversations.client.appointment.findUnique({
      where: { publicId: appointmentPublicId },
      select: appointmentSelect,
    })
    if (!row) throw communicationError("APPOINTMENT_NOT_FOUND")
    const side = await this.sideOf(actor.userId, row, this.conversations.client)
    return this.view(row, side, new Date())
  }

  confirm(actor: Actor, id: string, client: ClientContext) {
    return this.transition(actor, id, "CONFIRM", client, {})
  }

  reschedule(
    actor: Actor,
    id: string,
    scheduledAt: Date,
    client: ClientContext,
  ) {
    this.assertTime(scheduledAt)
    return this.transition(actor, id, "RESCHEDULE", client, { scheduledAt })
  }

  cancel(
    actor: Actor,
    id: string,
    reason: CancellationReason | undefined,
    client: ClientContext,
  ) {
    return this.transition(actor, id, "CANCEL", client, { reason })
  }

  complete(actor: Actor, id: string, client: ClientContext) {
    return this.transition(actor, id, "COMPLETE", client, {})
  }

  noShow(actor: Actor, id: string, client: ClientContext) {
    return this.transition(actor, id, "NO_SHOW", client, {})
  }

  private async transition(
    actor: Actor,
    appointmentPublicId: string,
    action: AppointmentAction,
    client: ClientContext,
    input: { scheduledAt?: Date; reason?: CancellationReason },
  ): Promise<AppointmentView> {
    const result = await this.conversations.transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM appointments
        WHERE public_id = ${appointmentPublicId}::uuid
        FOR UPDATE
      `
      if (!locked[0]) throw communicationError("APPOINTMENT_NOT_FOUND")
      const row = await tx.appointment.findUniqueOrThrow({
        where: { id: locked[0].id },
        select: appointmentSelect,
      })
      const side = await this.sideOf(actor.userId, row, tx)
      const now = new Date()
      if (!canPerform(this.state(row), side, action, now)) {
        throw communicationError("INVALID_APPOINTMENT_TRANSITION")
      }
      const status = nextStatus(action)
      const data: Prisma.AppointmentUncheckedUpdateInput = { status }
      let message: { code: SystemCode; payload: Prisma.InputJsonObject }
      let notice: { title: string; key: string }
      let auditAction: string
      switch (action) {
        case "CONFIRM": {
          const scheduledAt = row.proposedAt ?? row.scheduledAt
          Object.assign(data, {
            scheduledAt,
            proposedAt: null,
            proposedById: null,
            confirmedAt: now,
            ...(row.proposedAt ? { reminderSentAt: null } : {}),
          })
          message = {
            code: SystemCode.APPOINTMENT_CONFIRMED,
            payload: { scheduledAt: scheduledAt.toISOString() },
          }
          notice = {
            title: "Visite confirmée",
            key: `confirmed:${scheduledAt.toISOString()}`,
          }
          auditAction = CommunicationAuditAction.APPOINTMENT_CONFIRMED
          break
        }
        case "RESCHEDULE": {
          const proposedAt = input.scheduledAt!
          Object.assign(data, {
            proposedAt,
            proposedById: actor.userId,
            confirmedAt: null,
          })
          message = {
            code: SystemCode.APPOINTMENT_RESCHEDULE_PROPOSED,
            payload: { proposedAt: proposedAt.toISOString() },
          }
          notice = {
            title: "Nouvelle date de visite proposée",
            key: `reschedule:${proposedAt.toISOString()}`,
          }
          auditAction =
            CommunicationAuditAction.APPOINTMENT_RESCHEDULE_REQUESTED
          break
        }
        case "CANCEL": {
          const reason = input.reason ?? "OTHER"
          Object.assign(data, {
            proposedAt: null,
            proposedById: null,
            cancelledAt: now,
            cancelledById: actor.userId,
            cancellationReason: reason,
          })
          message = {
            code: SystemCode.APPOINTMENT_CANCELLED,
            payload: { reason },
          }
          notice = { title: "Visite annulée", key: "cancelled" }
          auditAction = CommunicationAuditAction.APPOINTMENT_CANCELLED
          break
        }
        case "COMPLETE":
        case "NO_SHOW": {
          Object.assign(data, { completedAt: now })
          const completed = action === "COMPLETE"
          message = {
            code: completed
              ? SystemCode.APPOINTMENT_COMPLETED
              : SystemCode.APPOINTMENT_NO_SHOW,
            payload: {},
          }
          notice = {
            title: completed
              ? "Visite effectuée"
              : "Visite marquée sans présentation",
            key: completed ? "completed" : "no_show",
          }
          auditAction = completed
            ? CommunicationAuditAction.APPOINTMENT_COMPLETED
            : CommunicationAuditAction.APPOINTMENT_NO_SHOW
          break
        }
      }
      const updated = await tx.appointment.updateMany({
        where: { id: row.id, status: row.status },
        data,
      })
      if (updated.count !== 1) {
        throw communicationError("INVALID_APPOINTMENT_TRANSITION")
      }
      const saved = await tx.appointment.findUniqueOrThrow({
        where: { id: row.id },
        select: appointmentSelect,
      })
      const systemMessage =
        saved.conversation && saved.conversation.status === "OPEN"
          ? await this.messages.appendSystem(
              tx,
              saved.conversation,
              message.code,
              { appointmentId: saved.publicId, by: side, ...message.payload },
              actor.userId,
            )
          : null
      await this.notifyOtherSide(tx, saved, side, {
        title: notice.title,
        body: `Pour « ${saved.listing.title} »`,
        key: notice.key,
      })
      await this.audit(
        tx,
        actor,
        saved,
        auditAction,
        {
          from: row.status,
          to: status,
          ...(input.reason ? { reason: input.reason } : {}),
        },
        client,
      )
      return { appointment: saved, message: systemMessage, side }
    })
    await this.afterCommit(result)
    return this.view(result.appointment, result.side, new Date())
  }

  /**
   * Partie de l'appelant : le client de la visite, ou un gestionnaire actuel
   * du bien. Tout autre utilisateur reçoit 404.
   */
  private async sideOf(
    userId: bigint,
    row: Pick<AppointmentRow, "userId" | "propertyId">,
    db: Tx | typeof this.conversations.client,
  ): Promise<ParticipantSide> {
    if (row.userId === userId) return "REQUESTER"
    const manager = await this.conversations.isCurrentManager(
      row.propertyId,
      userId,
      db,
    )
    if (!manager) throw communicationError("APPOINTMENT_NOT_FOUND")
    return "LISTING_SIDE"
  }

  private state(row: AppointmentRow): AppointmentState {
    return {
      status: row.status,
      scheduledAt: row.scheduledAt,
      proposedBy:
        row.proposedById === null
          ? null
          : row.proposedById === row.userId
            ? "REQUESTER"
            : "LISTING_SIDE",
    }
  }

  private assertTime(at: Date): void {
    const check = checkVisitTime(at, new Date(), this.config.appointments)
    if (check === "OK") return
    const detail = {
      TOO_SOON: `préavis minimal de ${this.config.appointments.minNoticeMinutes} minutes`,
      TOO_FAR: `au plus ${this.config.appointments.maxDaysAhead} jours à l'avance`,
      INVALID: "date invalide",
    }[check]
    throw communicationError("APPOINTMENT_TIME_INVALID", detail)
  }

  /** Notifie la partie qui n'a pas agi : le client, ou les gestionnaires actuels. */
  private async notifyOtherSide(
    tx: Tx,
    row: AppointmentRow,
    actorSide: ParticipantSide,
    notice: { title: string; body: string; key: string },
  ): Promise<void> {
    const recipients =
      actorSide === "REQUESTER"
        ? await this.conversations.currentManagerIds(row.propertyId, tx)
        : [row.userId]
    for (const userId of recipients) {
      await this.notifications.notify(
        userId,
        {
          type: "APPOINTMENT",
          category: "VISITS",
          title: notice.title,
          body: notice.body,
          data: {
            appointmentId: row.publicId,
            listingId: row.listing.publicId,
            ...(row.conversation
              ? { conversationId: row.conversation.publicId }
              : {}),
          },
          dedupKey: `appointment:${row.publicId}:${notice.key}`,
        },
        tx,
      )
    }
  }

  private audit(
    tx: Tx,
    actor: Actor,
    row: AppointmentRow,
    action: string,
    values: Prisma.InputJsonObject,
    client: ClientContext,
  ): Promise<void> {
    return this.activity.audit(
      {
        action,
        actorId: actor.userId,
        entityType: APPOINTMENT_ENTITY,
        entityId: row.publicId,
        newValues: { listingId: row.listing.publicId, ...values },
      },
      client,
      tx,
    )
  }

  private async afterCommit(result: AfterCommit): Promise<void> {
    const { appointment, message } = result
    if (appointment.conversation && message) {
      await this.messages.publishSystem(appointment.conversation, message)
    }
    const managers = await this.conversations.currentManagerIds(
      appointment.propertyId,
    )
    const people = await this.conversations.client.user.findMany({
      where: { id: { in: [appointment.userId, ...managers] } },
      select: { id: true, publicId: true },
    })
    const now = new Date()
    for (const person of people) {
      const side: ParticipantSide =
        person.id === appointment.userId ? "REQUESTER" : "LISTING_SIDE"
      this.realtime.toUsers(
        [person.publicId],
        RealtimeEvent.APPOINTMENT_UPDATED,
        {
          appointment: serialize(this.view(appointment, side, now)),
        },
      )
    }
    this.activity.emit(
      CommunicationEvent.APPOINTMENT_CHANGED,
      appointment.publicId,
      {
        appointmentId: appointment.publicId,
        status: appointment.status,
      },
    )
    this.activity.emit(
      CommunicationEvent.DELIVERIES_QUEUED,
      appointment.publicId,
      {},
    )
  }

  private view(
    row: AppointmentRow,
    side: ParticipantSide,
    now: Date,
  ): AppointmentView {
    const state = this.state(row)
    return {
      id: row.publicId,
      status: row.status,
      side,
      scheduledAt: row.scheduledAt,
      timezone: row.timezone,
      durationMinutes: row.durationMinutes,
      notes: row.notes,
      proposedAt: row.proposedAt,
      proposedBy: state.proposedBy,
      listing: { id: row.listing.publicId, title: row.listing.title },
      conversationId: row.conversation?.publicId ?? null,
      requester: personView(row.user, "REQUESTER"),
      confirmedAt: row.confirmedAt,
      cancelledAt: row.cancelledAt,
      cancelledBy:
        row.cancelledById === null
          ? null
          : row.cancelledById === row.userId
            ? "REQUESTER"
            : "LISTING_SIDE",
      cancellationReason: row.cancellationReason,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      actions: availableActions(state, side, now),
    }
  }
}
