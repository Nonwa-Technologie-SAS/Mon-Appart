import type { Client } from "pg"
import {
  connect,
  createFixture,
  expectViolation,
  inRollback,
  SQLSTATE,
} from "./db"

describe("contraintes d'intégrité", () => {
  let client: Client

  beforeAll(async () => {
    client = await connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it("refuse un utilisateur sans email ni téléphone", async () => {
    await inRollback(client, async () => {
      await expectViolation(
        client,
        "INSERT INTO users (status) VALUES ('ACTIVE')",
        [],
        {
          code: SQLSTATE.checkViolation,
          constraint: "users_contact_present_chk",
        },
      )
    })
  })

  it("refuse un email déjà utilisé, sans tenir compte de la casse", async () => {
    await inRollback(client, async () => {
      await client.query("INSERT INTO users (email) VALUES ('Awa@Example.ci')")
      await expectViolation(
        client,
        "INSERT INTO users (email) VALUES ('awa@example.ci')",
        [],
        {
          code: SQLSTATE.uniqueViolation,
          constraint: "users_email_active_key",
        },
      )
    })
  })

  it("libère l'email d'un compte supprimé logiquement", async () => {
    await inRollback(client, async () => {
      await client.query(
        "INSERT INTO users (email, deleted_at) VALUES ('ancien@example.ci', now())",
      )
      await client.query(
        "INSERT INTO users (email) VALUES ('ancien@example.ci')",
      )
    })
  })

  it.each(["-1", "0"])("refuse un prix de %s", async (amount) => {
    await inRollback(client, async () => {
      const { listingId } = await createFixture(client)
      await expectViolation(
        client,
        "INSERT INTO listing_prices (listing_id, amount, period) VALUES ($1, $2, 'MONTH')",
        [listingId, amount],
        {
          code: SQLSTATE.checkViolation,
          constraint: "listing_prices_amount_positive_chk",
        },
      )
    })
  })

  it("refuse des attributs JSONB qui ne sont pas un objet", async () => {
    await inRollback(client, async () => {
      const { propertyId } = await createFixture(client)
      await expectViolation(
        client,
        "UPDATE properties SET attributes = '[]'::jsonb WHERE id = $1",
        [propertyId],
        {
          code: SQLSTATE.checkViolation,
          constraint: "properties_attributes_object_chk",
        },
      )
    })
  })

  it("refuse deux prix courants pour une même annonce", async () => {
    await inRollback(client, async () => {
      const { listingId } = await createFixture(client)
      await client.query(
        "INSERT INTO listing_prices (listing_id, amount, period) VALUES ($1, 300000, 'MONTH')",
        [listingId],
      )
      await expectViolation(
        client,
        "INSERT INTO listing_prices (listing_id, amount, period) VALUES ($1, 320000, 'MONTH')",
        [listingId],
        {
          code: SQLSTATE.uniqueViolation,
          constraint: "listing_prices_current_key",
        },
      )
    })
  })

  it("refuse une devise qui n'est pas au format ISO 4217", async () => {
    await inRollback(client, async () => {
      const { listingId } = await createFixture(client)
      await expectViolation(
        client,
        "INSERT INTO listing_prices (listing_id, amount, currency, period) VALUES ($1, 10, 'cfa', 'MONTH')",
        [listingId],
        {
          code: SQLSTATE.checkViolation,
          constraint: "listing_prices_currency_chk",
        },
      )
    })
  })

  it("refuse un favori en double", async () => {
    await inRollback(client, async () => {
      const { customerId, propertyId } = await createFixture(client)
      const sql = "INSERT INTO favorites (user_id, property_id) VALUES ($1, $2)"
      await client.query(sql, [customerId, propertyId])
      await expectViolation(client, sql, [customerId, propertyId], {
        code: SQLSTATE.uniqueViolation,
      })
    })
  })

  it("refuse une demande dont l'annonce ne correspond pas au bien", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO inquiries (user_id, property_id, listing_id, owner_id, type)
         VALUES ($1, $2, $3, $4, 'MESSAGE')`,
        [f.customerId, f.otherPropertyId, f.listingId, f.ownerId],
        { code: SQLSTATE.foreignKeyViolation },
      )
    })
  })

  it("refuse une demande adressée à soi-même", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO inquiries (user_id, property_id, listing_id, owner_id, type)
         VALUES ($1, $2, $3, $1, 'MESSAGE')`,
        [f.ownerId, f.propertyId, f.listingId],
        { code: SQLSTATE.checkViolation, constraint: "inquiries_not_self_chk" },
      )
    })
  })

  it("refuse deux annonces actives du même type pour un bien", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO listings (property_id, created_by_id, listing_type, status, title)
         VALUES ($1, $2, 'RENT', 'PENDING_REVIEW', 'Doublon')`,
        [f.propertyId, f.ownerId],
        {
          code: SQLSTATE.uniqueViolation,
          constraint: "listings_one_live_per_type_key",
        },
      )
    })
  })

  it("refuse une annonce publiée sans date de publication", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO listings (property_id, created_by_id, listing_type, status, title)
         VALUES ($1, $2, 'SALE', 'PUBLISHED', 'Sans date')`,
        [f.propertyId, f.ownerId],
        {
          code: SQLSTATE.checkViolation,
          constraint: "listings_published_has_date_chk",
        },
      )
    })
  })

  it("refuse un second propriétaire unique courant", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      const sql =
        "INSERT INTO property_ownerships (property_id, owner_id, ownership_type) VALUES ($1, $2, 'SOLE')"
      await client.query(sql, [f.propertyId, f.ownerId])
      await expectViolation(client, sql, [f.propertyId, f.customerId], {
        code: SQLSTATE.uniqueViolation,
        constraint: "property_ownerships_current_sole_key",
      })
    })
  })

  it("empêche la suppression d'un bien qui a des annonces", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        "DELETE FROM properties WHERE id = $1",
        [f.propertyId],
        {
          code: SQLSTATE.foreignKeyViolation,
        },
      )
    })
  })

  it("refuse un score de recommandation hors de 0..1", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO recommendations (user_id, property_id, listing_id, score, algorithm_version, expires_at)
         VALUES ($1, $2, $3, 1.5, 'v0', now() + interval '1 day')`,
        [f.customerId, f.propertyId, f.listingId],
        {
          code: SQLSTATE.checkViolation,
          constraint: "recommendations_score_chk",
        },
      )
    })
  })

  it("refuse une recommandation dont l'annonce ne correspond pas au bien", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO recommendations (user_id, property_id, listing_id, score, algorithm_version, expires_at)
         VALUES ($1, $2, $3, 0.5, 'v0', now() + interval '1 day')`,
        [f.customerId, f.otherPropertyId, f.listingId],
        { code: SQLSTATE.foreignKeyViolation },
      )
    })
  })

  it("refuse un rang de recommandation nul ou négatif", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      await expectViolation(
        client,
        `INSERT INTO recommendations (user_id, property_id, listing_id, score, rank, algorithm_version, expires_at)
         VALUES ($1, $2, $3, 0.5, 0, 'v0', now() + interval '1 day')`,
        [f.customerId, f.propertyId, f.listingId],
        {
          code: SQLSTATE.checkViolation,
          constraint: "recommendations_rank_chk",
        },
      )
    })
  })
})
