/**
 * Factories de test partagées.
 *
 * Les suites d’intégration HTTP (`catalog-app`, `identity-app`, …) restent
 * la source de vérité pour les parcours API. Ce module centralise les
 * fixtures SQL bas niveau utilisées par les `*.db-spec.ts` purs.
 */
export {
  connect,
  createFixture,
  expectViolation,
  inRollback,
  SQLSTATE,
  type Fixture,
} from "../database/db"

export {
  assign,
  createListing,
  createProperty,
  LAND_BINGERVILLE,
  userWithRoles,
  VILLA_COCODY,
  type TestUser,
} from "../catalog/catalog-app"

export {
  bearer,
  login,
  PASSWORD,
  registerUser,
  type IdentityTestApp,
} from "../identity/identity-app"
