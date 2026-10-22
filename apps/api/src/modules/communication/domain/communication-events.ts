/**
 * Événements publiés après commit. Charges utiles : identifiants publics et
 * codes ; jamais de corps de message, de coordonnées ni de jeton.
 */
export const CommunicationEvent = {
  CONVERSATION_CREATED: "conversation.created",
  MESSAGE_SENT: "message.sent",
  CONVERSATION_CLOSED: "conversation.closed",
  APPOINTMENT_CHANGED: "appointment.changed",
  /** Des livraisons ont été mises en file : le worker est réveillé. */
  DELIVERIES_QUEUED: "notification.deliveries_queued",
} as const

export const CommunicationAuditAction = {
  CONVERSATION_CREATED: "CONVERSATION_CREATED",
  CONVERSATION_CLOSED: "CONVERSATION_CLOSED",
  ATTACHMENT_UPLOAD_STARTED: "MESSAGE_ATTACHMENT_UPLOAD_STARTED",
  APPOINTMENT_REQUESTED: "APPOINTMENT_REQUESTED",
  APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
  APPOINTMENT_RESCHEDULE_REQUESTED: "APPOINTMENT_RESCHEDULE_REQUESTED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED",
  APPOINTMENT_NO_SHOW: "APPOINTMENT_NO_SHOW",
  NOTIFICATION_PREFERENCES_UPDATED: "NOTIFICATION_PREFERENCES_UPDATED",
  PUSH_DEVICE_REGISTERED: "PUSH_DEVICE_REGISTERED",
  PUSH_DEVICE_REMOVED: "PUSH_DEVICE_REMOVED",
} as const

export const CONVERSATION_ENTITY = "conversation"
export const APPOINTMENT_ENTITY = "appointment"
export const USER_ENTITY = "user"

/** Événements Socket.IO émis vers la salle personnelle d'un utilisateur. */
export const RealtimeEvent = {
  MESSAGE_NEW: "message:new",
  MESSAGE_DELIVERED: "message:delivered",
  MESSAGE_READ: "message:read",
  CONVERSATION_UPDATED: "conversation:updated",
  UNREAD_COUNT: "conversation:unread_count",
  APPOINTMENT_UPDATED: "appointment:updated",
  NOTIFICATION_NEW: "notification:new",
} as const
