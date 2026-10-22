import type { NotificationCategory } from "../../../../generated/prisma/enums"

export interface TemplateInput {
  category: NotificationCategory
  title: string
  body: string | null
  /** Lien vers l'application, sans jeton ni identifiant sensible. */
  link: string | null
}

export interface EmailContent {
  subject: string
  text: string
  html: string
}

export interface PushContent {
  title: string
  body: string
}

const BRAND = "Mon Appart"
const SMS_MAX = 160

/**
 * Les titres et corps de notification sont écrits par le backend, sans donnée
 * personnelle ni contenu de conversation : on ne transmet jamais le texte d'un
 * message par e-mail, SMS ou push.
 */
export function renderEmail(input: TemplateInput): EmailContent {
  const lines = [
    input.title,
    ...(input.body ? ["", input.body] : []),
    ...(input.link ? ["", `Ouvrir Mon Appart : ${input.link}`] : []),
    "",
    "—",
    "Vous recevez cet e-mail car vos préférences de notification l'autorisent.",
    "Modifiez-les depuis votre compte Mon Appart.",
  ]
  const html = [
    "<!doctype html>",
    '<html lang="fr"><body style="font-family:sans-serif;color:#1a1a1a">',
    `<p style="font-size:16px;font-weight:600">${escapeHtml(input.title)}</p>`,
    ...(input.body ? [`<p>${escapeHtml(input.body)}</p>`] : []),
    ...(input.link
      ? [`<p><a href="${escapeHtml(input.link)}">Ouvrir Mon Appart</a></p>`]
      : []),
    '<p style="font-size:12px;color:#666">Vous recevez cet e-mail car vos préférences de notification l\'autorisent. Modifiez-les depuis votre compte Mon Appart.</p>',
    "</body></html>",
  ].join("")
  return {
    subject: `${BRAND} — ${singleLine(input.title)}`.slice(0, 200),
    text: lines.join("\n"),
    html,
  }
}

/** Court, sans contenu de conversation ; tronqué à un segment SMS. */
export function renderSms(input: TemplateInput): string {
  const base = `${BRAND} : ${singleLine(input.title)}`
  const withLink = input.link ? `${base} ${input.link}` : base
  if (withLink.length <= SMS_MAX) return withLink
  return base.length <= SMS_MAX ? base : `${base.slice(0, SMS_MAX - 1)}…`
}

/**
 * Peut s'afficher sur un écran verrouillé : titre générique de la marque et
 * intitulé de la notification seulement, jamais son corps.
 */
export function renderPush(input: TemplateInput): PushContent {
  return { title: BRAND, body: singleLine(input.title).slice(0, 120) }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}
