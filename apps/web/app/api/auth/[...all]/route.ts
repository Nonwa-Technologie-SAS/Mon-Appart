/**
 * better-auth retiré : l’auth web passe par Nest (`/api/v1/auth/*` via rewrite).
 */
function gone() {
  return Response.json(
    {
      error: "AUTH_MOVED_TO_NEST",
      message:
        "L’authentification web utilise Nest Identity. Appelez /api/v1/auth/* (même origine).",
    },
    { status: 410 },
  )
}

export async function GET() {
  return gone()
}

export async function POST() {
  return gone()
}

export async function PUT() {
  return gone()
}

export async function PATCH() {
  return gone()
}

export async function DELETE() {
  return gone()
}
