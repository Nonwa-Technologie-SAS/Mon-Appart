export const LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "req.body.password",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.token",
  "req.body.accessToken",
  "req.body.refreshToken",
  "req.body.refresh_token",
  "req.body.secret",
  "req.body.otp",
  "req.body.code",
  "req.headers['x-csrf-token']",
  "req.headers['x-mock-signature']",
  "req.headers['x-webhook-signature']",
  "req.query.token",
  "req.params.token",
  "res.headers['set-cookie']",
]

const SIGNED_PATH = /(\/media\/local\/(?:uploads|downloads)\/)[^/?#]+/g
const SIGNED_QUERY = /([?&](?:X-Amz-[A-Za-z-]+|Signature|token)=)[^&#]+/gi

/** URL journalisable : jetons des liens signés (chemin ou requête) masqués. */
export function redactUrl(url: string | undefined): string | undefined {
  return url
    ?.replace(SIGNED_PATH, "$1[redacted]")
    .replace(SIGNED_QUERY, "$1[redacted]")
}
