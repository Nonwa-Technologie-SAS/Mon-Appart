import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../../database/database.service"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import { CommunicationEvent } from "../../domain/communication-events"
import { NotificationService } from "../../notifications/application/notification.service"

const BATCH = 50

/**
 * Rappels des visites confirmées qui approchent. Plusieurs instances peuvent
 * tourner : chaque visite est réclamée sous verrou (SKIP LOCKED) et la clé de
 * regroupement inclut l'horaire, donc un rappel par créneau au plus.
 */
@Injectable()
export class AppointmentReminders {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationService,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
  ) {}

  async sendDue(): Promise<number> {
    const hours = this.config.appointments.reminderHours
    const sent = await this.db.transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM appointments
        WHERE status = 'CONFIRMED'
          AND reminder_sent_at IS NULL
          AND scheduled_at > now()
          AND scheduled_at <= now() + make_interval(hours => ${hours}::int)
        ORDER BY scheduled_at
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED
      `
      if (due.length === 0) return 0
      const rows = await tx.appointment.findMany({
        where: { id: { in: due.map((row) => row.id) } },
        select: {
          id: true,
          publicId: true,
          userId: true,
          propertyId: true,
          scheduledAt: true,
          listing: { select: { publicId: true, title: true } },
          conversation: { select: { publicId: true } },
          property: {
            select: {
              ownerships: {
                where: { isCurrent: true },
                select: { ownerId: true },
              },
            },
          },
        },
      })
      for (const row of rows) {
        const recipients = new Set([
          row.userId,
          ...row.property.ownerships.map((item) => item.ownerId),
        ])
        for (const userId of recipients) {
          await this.notifications.notify(
            userId,
            {
              type: "APPOINTMENT",
              category: "APPOINTMENT_REMINDERS",
              title: "Rappel : visite prochaine",
              body: `Pour « ${row.listing.title} »`,
              data: {
                appointmentId: row.publicId,
                listingId: row.listing.publicId,
                scheduledAt: row.scheduledAt.toISOString(),
                ...(row.conversation
                  ? { conversationId: row.conversation.publicId }
                  : {}),
              },
              dedupKey: `appointment:${row.publicId}:reminder:${row.scheduledAt.toISOString()}`,
              expiresAt: row.scheduledAt,
            },
            tx,
          )
        }
      }
      await tx.appointment.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { reminderSentAt: new Date() },
      })
      return rows.length
    })
    if (sent > 0) {
      this.activity.emit(CommunicationEvent.DELIVERIES_QUEUED, "reminders", {})
    }
    return sent
  }
}
