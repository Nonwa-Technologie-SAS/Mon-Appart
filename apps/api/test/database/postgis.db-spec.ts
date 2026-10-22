import type { Client } from "pg"
import {
  connect,
  createFixture,
  expectViolation,
  inRollback,
  SQLSTATE,
} from "./db"

describe("PostGIS", () => {
  let client: Client

  beforeAll(async () => {
    client = await connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it("dispose de l'extension PostGIS", async () => {
    const { rows } = await client.query<{ version: string }>(
      "SELECT PostGIS_Version() AS version",
    )
    expect(rows[0]?.version).toMatch(/^3\./)
  })

  it("indexe geo_point avec GIST", async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE indexname = 'properties_geo_point_gist_idx'",
    )
    expect(rows[0]?.indexdef).toContain("USING gist (geo_point)")
  })

  it("calcule geo_point depuis latitude et longitude", async () => {
    await inRollback(client, async () => {
      const { propertyId } = await createFixture(client)
      const { rows } = await client.query<{
        lat: number
        lng: number
        srid: number
      }>(
        `SELECT ST_Y(geo_point::geometry) AS lat, ST_X(geo_point::geometry) AS lng,
                ST_SRID(geo_point::geometry) AS srid
           FROM properties WHERE id = $1`,
        [propertyId],
      )
      expect(rows[0]).toEqual({ lat: 5.359, lng: -3.958, srid: 4326 })
    })
  })

  it("interdit l'écriture directe de geo_point", async () => {
    await inRollback(client, async () => {
      const { propertyId } = await createFixture(client)
      await expectViolation(
        client,
        "UPDATE properties SET geo_point = ST_GeogFromText('POINT(0 0)') WHERE id = $1",
        [propertyId],
        { code: SQLSTATE.generatedAlways },
      )
    })
  })

  it("trouve les biens dans un rayon, triés par distance", async () => {
    await inRollback(client, async () => {
      const f = await createFixture(client)
      const { rows } = await client.query<{ id: string; distance_m: number }>(
        `SELECT id, ST_Distance(geo_point, origin) AS distance_m
           FROM properties,
                LATERAL (SELECT ST_SetSRID(ST_MakePoint(-3.9600, 5.3550), 4326)::geography AS origin) o
          WHERE id = ANY($1::bigint[])
            AND ST_DWithin(geo_point, origin, 5000)
          ORDER BY distance_m`,
        [[f.propertyId, f.otherPropertyId]],
      )
      expect(rows.map((row) => row.id)).toEqual([f.propertyId])
      expect(rows[0]!.distance_m).toBeGreaterThan(400)
      expect(rows[0]!.distance_m).toBeLessThan(600)
    })
  })
})
