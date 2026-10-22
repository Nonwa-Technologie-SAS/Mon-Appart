import type { Role } from "@mon-appart/types"

import {
  bearer,
  login,
  PASSWORD,
  registerUser,
  type IdentityTestApp,
} from "../identity/identity-app"

export { bearer }

export interface TestUser {
  userId: string
  token: string
  auth: { Authorization: string }
}

/** Compte inscrit par l'API puis promu en base ; le nouveau login porte les rôles. */
export async function userWithRoles(
  test: IdentityTestApp,
  roles: Role[],
): Promise<TestUser> {
  const user = await registerUser(test)
  for (const role of roles) {
    await test.db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT u.id, r.id FROM users u, roles r WHERE u.public_id = $1 AND r.code = $2
       ON CONFLICT DO NOTHING`,
      [user.userId, role],
    )
  }
  const session = await login(test, user.email, PASSWORD).expect(200)
  const token: string = session.body.accessToken
  return { userId: user.userId, token, auth: bearer(token) }
}

/** Rattache un compte à un bien (mandat d'agent, gestion...) comme le ferait un admin. */
export async function assign(
  test: IdentityTestApp,
  propertyId: string,
  userId: string,
  ownershipType: "AGENT" | "MANAGER" | "JOINT",
): Promise<void> {
  await test.db.query(
    `INSERT INTO property_ownerships (property_id, owner_id, ownership_type)
     SELECT p.id, u.id, $3::ownership_type FROM properties p, users u
     WHERE p.public_id = $1 AND u.public_id = $2`,
    [propertyId, userId, ownershipType],
  )
}

export const VILLA_COCODY = {
  propertyType: "VILLA",
  commune: "COCODY",
  neighborhood: "RIVIERA",
  title: "Villa 4 chambres Cocody Riviera",
  description: "Villa avec jardin, proche des commodités.",
  surface: 280,
  bedrooms: 4,
  bathrooms: 3,
  address: "Riviera 3, rue des Jardins",
  latitude: 5.3625,
  longitude: -3.9612,
  attributes: { parkingSpaces: 2, standing: "HAUT" },
  amenities: ["PARKING", "SECURITY", "GARDEN"],
}

export const LAND_BINGERVILLE = {
  propertyType: "LAND",
  commune: "BINGERVILLE",
  neighborhood: "FEH_KESSE",
  title: "Terrain 600 m² Bingerville",
  landSurface: 600,
  latitude: 5.3558,
  longitude: -3.8854,
  attributes: { serviced: true, landTitle: "ACD" },
}

export async function createProperty(
  test: IdentityTestApp,
  user: TestUser,
  body: Record<string, unknown> = VILLA_COCODY,
  activate = true,
): Promise<string> {
  const created = await test.http
    .post("/api/v1/properties")
    .set(user.auth)
    .send(body)
    .expect(201)
  const id: string = created.body.id
  if (activate) {
    await test.http
      .patch(`/api/v1/properties/${id}`)
      .set(user.auth)
      .send({ status: "ACTIVE" })
      .expect(200)
  }
  return id
}

export async function createListing(
  test: IdentityTestApp,
  user: TestUser,
  propertyId: string,
  listingType: string,
  price?: { amount: number; period: string },
): Promise<string> {
  const created = await test.http
    .post("/api/v1/listings")
    .set(user.auth)
    .send({ propertyId, listingType, ...(price ? { price } : {}) })
    .expect(201)
  return created.body.id
}

export async function auditActions(
  test: IdentityTestApp,
  entityId: string,
): Promise<
  Array<{ action: string; new_values: Record<string, unknown> | null }>
> {
  const rows = await test.db.query<{
    action: string
    new_values: Record<string, unknown> | null
  }>(
    "SELECT action, new_values FROM audit_logs WHERE entity_id = $1 ORDER BY created_at, id",
    [entityId],
  )
  return rows.rows
}
