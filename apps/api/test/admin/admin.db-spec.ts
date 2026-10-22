import {
  createListing,
  createProperty,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"
import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"

const PRICE = { amount: 1_500_000, period: "MONTH" }

describe("Back-office : accès, comptes, modération et audit", () => {
  let test: IdentityTestApp
  let owner: TestUser
  let customer: TestUser
  let moderator: TestUser
  let support: TestUser
  let analyst: TestUser
  let admin: TestUser

  beforeAll(async () => {
    test = await createIdentityApp()
    owner = await userWithRoles(test, ["OWNER"])
    customer = await userWithRoles(test, [])
    moderator = await userWithRoles(test, ["MODERATOR"])
    support = await userWithRoles(test, ["SUPPORT"])
    analyst = await userWithRoles(test, ["ANALYST"])
    admin = await userWithRoles(test, ["ADMIN"])
  })

  afterAll(async () => {
    await test.close()
  })

  const get = (user: TestUser, path: string) =>
    test.http.get(`/api/v1/admin${path}`).set(user.auth)
  const post = (user: TestUser, path: string, body: object = {}) =>
    test.http.post(`/api/v1/admin${path}`).set(user.auth).send(body)

  async function status(userId: string): Promise<string> {
    const row = await test.db.query<{ status: string }>(
      "SELECT status FROM users WHERE public_id = $1",
      [userId],
    )
    return row.rows[0]!.status
  }

  async function pendingListing(): Promise<string> {
    const property = await createProperty(test, owner)
    const listing = await createListing(test, owner, property, "RENT", PRICE)
    await test.http
      .post(`/api/v1/listings/${listing}/status`)
      .set(owner.auth)
      .send({ status: "PENDING_REVIEW" })
      .expect(200)
    return listing
  }

  describe("accès", () => {
    it("un compte sans admin:access est refusé, même authentifié", async () => {
      for (const user of [customer, owner]) {
        const res = await get(user, "/me").expect(403)
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSION")
      }
      await test.http.get("/api/v1/admin/me").expect(401)
    })

    it("expose les permissions effectives relues en base", async () => {
      const me = await get(analyst, "/me").expect(200)
      expect(me.body.roles).toEqual(["ANALYST", "CUSTOMER"])
      expect(me.body.permissions).toEqual(
        expect.arrayContaining(["admin:access", "analytics:admin"]),
      )
      expect(me.body.permissions).not.toContain("user:read")
      expect(me.body.manageableRoles).toEqual([])
      await get(analyst, "/users").expect(403)
      await get(analyst, "/audit-logs").expect(403)
    })

    it("un rôle retiré en base coupe l'accès sans attendre l'expiration du jeton", async () => {
      const staff = await userWithRoles(test, ["SUPPORT"])
      await get(staff, "/me").expect(200)
      await test.db.query(
        `DELETE FROM user_roles ur USING users u, roles r
         WHERE ur.user_id = u.id AND ur.role_id = r.id
           AND u.public_id = $1 AND r.code = 'SUPPORT'`,
        [staff.userId],
      )
      await get(staff, "/me").expect(403)
    })

    it("la matrice des rôles en base correspond aux rôles du back-office", async () => {
      await get(support, "/roles").expect(403)
      const roles = await get(admin, "/roles").expect(200)
      const byCode = new Map<string, string[]>(
        roles.body.map((role: { code: string; permissions: string[] }) => [
          role.code,
          role.permissions,
        ]),
      )
      expect(byCode.get("ANALYST")).toEqual(["admin:access", "analytics:admin"])
      expect(byCode.get("SUPPORT")).not.toContain("role:manage")
      expect(byCode.get("SUPPORT")).not.toContain("user:suspend")
      expect(byCode.get("ADMIN")).not.toContain("verification:documents")
    })
  })

  describe("comptes", () => {
    it("liste avec coordonnées masquées ; recherche par contact réservée à user:pii", async () => {
      const email: string = (
        await test.db.query<{ email: string }>(
          "SELECT email FROM users WHERE public_id = $1",
          [customer.userId],
        )
      ).rows[0]!.email

      const denied = await get(
        moderator,
        `/users?q=${encodeURIComponent(email)}`,
      ).expect(403)
      expect(denied.body.code).toBe("ADMIN_CONTACT_SEARCH_FORBIDDEN")

      const found = await get(
        support,
        `/users?q=${encodeURIComponent(email)}`,
      ).expect(200)
      expect(found.body.items).toHaveLength(1)
      expect(found.body.items[0].id).toBe(customer.userId)
      expect(found.body.items[0].email).not.toBe(email)
      expect(found.body.items[0].email).toMatch(/^.\*\*\*@/)

      await get(support, "/users?q=a").expect(400)
    })

    it("la fiche ne révèle les coordonnées qu'avec user:pii, et l'audite", async () => {
      const masked = await get(moderator, `/users/${customer.userId}`).expect(
        200,
      )
      expect(masked.body.contactRevealed).toBe(false)
      expect(masked.body.actions.decisions).toEqual([])

      const full = await get(support, `/users/${customer.userId}`).expect(200)
      expect(full.body.contactRevealed).toBe(true)
      expect(full.body.email).toContain("@example.test")
      expect(JSON.stringify(full.body)).not.toMatch(/password|token|otp/i)

      const viewed = await test.db.query(
        `SELECT 1 FROM audit_logs a JOIN users u ON u.id = a.actor_id
         WHERE a.action = 'USER_CONTACT_VIEWED' AND a.entity_id = $1
           AND u.public_id = $2`,
        [customer.userId, support.userId],
      )
      expect(viewed.rowCount).toBe(1)
    })

    it("le support ne change pas les rôles et ne suspend pas", async () => {
      const role = await post(support, `/users/${customer.userId}/roles`, {
        role: "MODERATOR",
        operation: "grant",
        reason: "test",
      }).expect(403)
      expect(role.body.code).toBe("INSUFFICIENT_PERMISSION")
      await post(support, `/users/${customer.userId}/suspend`, {
        reason: "test",
        expectedStatus: "PENDING",
      }).expect(403)
    })

    it("le support déconnecte un client, pas un membre du staff", async () => {
      const target = await userWithRoles(test, [])
      const res = await post(
        support,
        `/users/${target.userId}/revoke-sessions`,
        {
          reason: "Demande du titulaire",
        },
      ).expect(200)
      expect(res.body.revokedSessions).toBeGreaterThanOrEqual(1)
      await test.http.get("/api/v1/auth/me").set(target.auth).expect(401)

      const protectedRes = await post(
        support,
        `/users/${moderator.userId}/revoke-sessions`,
        { reason: "test" },
      ).expect(403)
      expect(protectedRes.body.code).toBe("ADMIN_TARGET_PROTECTED")
    })

    it("anti-élévation : ni rôle privilégié, ni action sur soi-même", async () => {
      const escalate = await post(admin, `/users/${customer.userId}/roles`, {
        role: "SUPER_ADMIN",
        operation: "grant",
        reason: "test",
      }).expect(403)
      expect(escalate.body.code).toBe("ADMIN_ROLE_FORBIDDEN")

      const self = await post(admin, `/users/${admin.userId}/roles`, {
        role: "MODERATOR",
        operation: "grant",
        reason: "test",
      }).expect(403)
      expect(self.body.code).toBe("ADMIN_TARGET_PROTECTED")

      const peer = await userWithRoles(test, ["ADMIN"])
      await post(admin, `/users/${peer.userId}/suspend`, {
        reason: "test",
        expectedStatus: await status(peer.userId),
      }).expect(403)
    })

    it("attribue un rôle avec motif audité ; le retrait révoque les sessions", async () => {
      const target = await userWithRoles(test, [])
      const granted = await post(admin, `/users/${target.userId}/roles`, {
        role: "MODERATOR",
        operation: "grant",
        reason: "Renfort modération",
      }).expect(200)
      expect(granted.body.changed).toBe(true)
      expect(granted.body.roles).toContain("MODERATOR")

      const again = await post(admin, `/users/${target.userId}/roles`, {
        role: "MODERATOR",
        operation: "grant",
        reason: "Renfort modération",
      }).expect(200)
      expect(again.body.changed).toBe(false)

      const audit = await test.db.query<{ new_values: object }>(
        "SELECT new_values FROM audit_logs WHERE action = 'ROLE_CHANGED' AND entity_id = $1",
        [target.userId],
      )
      expect(audit.rows).toEqual([
        {
          new_values: {
            operation: "grant",
            role: "MODERATOR",
            reason: "Renfort modération",
          },
        },
      ])

      await post(admin, `/users/${target.userId}/roles`, {
        role: "MODERATOR",
        operation: "revoke",
        reason: "Fin de mission",
      }).expect(200)
      await test.http.get("/api/v1/auth/me").set(target.auth).expect(401)
    })

    it("suspension : statut attendu exigé (409), sessions révoquées, réactivation notifiée", async () => {
      const target = await userWithRoles(test, [])
      const current = await status(target.userId)

      const stale = await post(admin, `/users/${target.userId}/suspend`, {
        reason: "Fraude signalée",
        expectedStatus: current === "ACTIVE" ? "PENDING" : "ACTIVE",
      }).expect(409)
      expect(stale.body.code).toBe("ACCOUNT_STATUS_CHANGED")

      const suspended = await post(admin, `/users/${target.userId}/suspend`, {
        reason: "Fraude signalée",
        expectedStatus: current,
      }).expect(200)
      expect(suspended.body).toMatchObject({ from: current, to: "SUSPENDED" })
      await test.http.get("/api/v1/auth/me").set(target.auth).expect(401)

      const replay = await post(admin, `/users/${target.userId}/suspend`, {
        reason: "Fraude signalée",
        expectedStatus: current,
      }).expect(409)
      expect(replay.body.code).toBe("ACCOUNT_STATUS_CHANGED")

      const reactivated = await post(
        admin,
        `/users/${target.userId}/reactivate`,
        { reason: "Doute levé", expectedStatus: "SUSPENDED" },
      ).expect(200)
      expect(["ACTIVE", "PENDING"]).toContain(reactivated.body.to)

      const notices = await test.db.query<{ category: string; body: string }>(
        `SELECT n.category, n.body FROM notifications n JOIN users u ON u.id = n.user_id
         WHERE u.public_id = $1`,
        [target.userId],
      )
      expect(notices.rows.some((row) => row.category === "ACCOUNT")).toBe(true)
      expect(JSON.stringify(notices.rows)).not.toContain("Fraude signalée")
    })

    it("protège le dernier SUPER_ADMIN actif face à deux retraits simultanés", async () => {
      const first = await userWithRoles(test, ["SUPER_ADMIN"])
      const second = await userWithRoles(test, ["SUPER_ADMIN"])
      // Comptes de test seulement : les SUPER_ADMIN d'exécutions précédentes
      // ne doivent pas fausser le décompte.
      await test.db.query(
        `UPDATE users SET status = 'INACTIVE'
         WHERE status = 'ACTIVE' AND email LIKE '%@example.test'
           AND public_id NOT IN ($1, $2)
           AND id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                      WHERE r.code = 'SUPER_ADMIN')`,
        [first.userId, second.userId],
      )
      await test.db.query(
        "UPDATE users SET status = 'ACTIVE' WHERE public_id IN ($1, $2)",
        [first.userId, second.userId],
      )

      const results = await Promise.all([
        post(first, `/users/${second.userId}/ban`, {
          reason: "test",
          expectedStatus: "ACTIVE",
        }),
        post(second, `/users/${first.userId}/ban`, {
          reason: "test",
          expectedStatus: "ACTIVE",
        }),
      ])
      expect(results.filter((res) => res.status === 200)).toHaveLength(1)
      const refused = results.find((res) => res.status !== 200)!
      expect([401, 403, 409]).toContain(refused.status)
      if (refused.status === 409) {
        expect(refused.body.code).toBe("LAST_SUPER_ADMIN")
      }
      const statuses = await Promise.all([
        status(first.userId),
        status(second.userId),
      ])
      expect(statuses.filter((value) => value === "ACTIVE")).toHaveLength(1)
    })
  })

  describe("modération des annonces", () => {
    it("file, dossier et contrôles d'aide à la décision", async () => {
      const listing = await pendingListing()
      const queue = await get(moderator, `/listings?q=${listing}`).expect(200)
      expect(queue.body.items.map((item: { id: string }) => item.id)).toEqual([
        listing,
      ])

      const detail = await get(moderator, `/listings/${listing}`).expect(200)
      expect(detail.body.decisions).toEqual([
        "APPROVE",
        "REJECT",
        "REQUEST_CHANGES",
      ])
      const checks = new Map(
        detail.body.checks.map((check: { code: string; outcome: string }) => [
          check.code,
          check.outcome,
        ]),
      )
      expect(checks.get("PHOTOS")).toBe("WARN")
      expect(checks.get("CURRENT_PRICE")).toBe("PASS")
      // Dépend des annonces publiées par les autres tests : seul le format
      // est vérifié ici, les seuils le sont par les tests unitaires.
      expect(["PASS", "WARN", "UNKNOWN"]).toContain(checks.get("PRICE_PER_SQM"))

      await get(support, `/listings/${listing}`).expect(403)
      await post(support, `/listings/${listing}/approve`, {
        expectedStatus: "PENDING_REVIEW",
      }).expect(403)
    })

    it("motif obligatoire, cohérent avec la décision et actif", async () => {
      const listing = await pendingListing()
      const missing = await post(moderator, `/listings/${listing}/reject`, {
        expectedStatus: "PENDING_REVIEW",
      }).expect(422)
      expect(missing.body.code).toBe("MODERATION_REASON_REQUIRED")

      const wrong = await post(moderator, `/listings/${listing}/reject`, {
        expectedStatus: "PENDING_REVIEW",
        reasonCode: "UNDER_INVESTIGATION",
      }).expect(422)
      expect(wrong.body.code).toBe("MODERATION_REASON_INVALID")

      const notApplicable = await post(
        moderator,
        `/listings/${listing}/suspend`,
        { expectedStatus: "PENDING_REVIEW", reasonCode: "POLICY_VIOLATION" },
      ).expect(409)
      expect(notApplicable.body.code).toBe("MODERATION_NOT_APPLICABLE")
    })

    it("demande de corrections : transition, note interne, audit et notification sans note", async () => {
      const listing = await pendingListing()
      const res = await post(
        moderator,
        `/listings/${listing}/request-changes`,
        {
          expectedStatus: "PENDING_REVIEW",
          reasonCode: "PHOTOS_QUALITY",
          ownerMessage: "Ajoutez une photo du salon.",
          internalNote: "Photos probablement reprises d'un autre site.",
        },
      ).expect(200)
      expect(res.body).toEqual({ status: "DRAFT" })

      const replay = await post(
        moderator,
        `/listings/${listing}/request-changes`,
        { expectedStatus: "PENDING_REVIEW", reasonCode: "PHOTOS_QUALITY" },
      ).expect(409)
      expect(replay.body.code).toBe("LISTING_STATUS_CHANGED")

      const history = await test.db.query<{ reason: string }>(
        `SELECT h.reason FROM listing_status_history h JOIN listings l ON l.id = h.listing_id
         WHERE l.public_id = $1 AND h.old_status = 'PENDING_REVIEW'
           AND h.new_status = 'DRAFT'`,
        [listing],
      )
      expect(history.rows[0]!.reason).toBe(
        "PHOTOS_QUALITY — Ajoutez une photo du salon.",
      )

      const notices = await test.db.query<{
        title: string
        body: string
        data: Record<string, unknown>
      }>(
        `SELECT n.title, n.body, n.data FROM notifications n JOIN users u ON u.id = n.user_id
         WHERE u.public_id = $1 AND n.data->>'listingId' = $2`,
        [owner.userId, listing],
      )
      expect(notices.rows).toHaveLength(1)
      expect(notices.rows[0]!.title).toBe(
        "Corrections demandées sur votre annonce",
      )
      expect(notices.rows[0]!.body).toContain("Ajoutez une photo du salon.")
      expect(notices.rows[0]!.body).not.toContain("autre site")
      expect(notices.rows[0]!.data).toMatchObject({
        decision: "REQUEST_CHANGES",
        reasonCode: "PHOTOS_QUALITY",
      })

      const detail = await get(moderator, `/listings/${listing}`).expect(200)
      expect(detail.body.notes[0].body).toBe(
        "Photos probablement reprises d'un autre site.",
      )
      const audit = await test.db.query<{
        new_values: Record<string, unknown>
      }>(
        "SELECT new_values FROM audit_logs WHERE action = 'LISTING_MODERATED' AND entity_id = $1",
        [listing],
      )
      expect(audit.rows[0]!.new_values).toMatchObject({
        decision: "REQUEST_CHANGES",
        status: "DRAFT",
        reasonCode: "PHOTOS_QUALITY",
      })
      expect(JSON.stringify(audit.rows)).not.toContain("autre site")
    })

    it("validation puis suspension et restauration justifiée", async () => {
      const listing = await pendingListing()
      await post(moderator, `/listings/${listing}/approve`, {
        expectedStatus: "PENDING_REVIEW",
      }).expect(200)
      await post(moderator, `/listings/${listing}/suspend`, {
        expectedStatus: "PUBLISHED",
        reasonCode: "UNDER_INVESTIGATION",
      }).expect(200)
      const unjustified = await post(
        moderator,
        `/listings/${listing}/restore`,
        {
          expectedStatus: "SUSPENDED",
        },
      ).expect(422)
      expect(unjustified.body.code).toBe("MODERATION_JUSTIFICATION_REQUIRED")
      await post(moderator, `/listings/${listing}/restore`, {
        expectedStatus: "SUSPENDED",
        internalNote: "Vérification terminée, rien à signaler.",
      }).expect(200)
    })

    it("les notes internes sont non modifiables", async () => {
      const listing = await pendingListing()
      const note = await post(moderator, `/listings/${listing}/notes`, {
        body: "À revoir demain",
      }).expect(201)
      await expect(
        test.db.query(
          "UPDATE admin_notes SET body = 'x' WHERE public_id = $1",
          [note.body.id],
        ),
      ).rejects.toThrow()
    })
  })

  describe("motifs, tableau de bord et audit", () => {
    it("motifs : lecture pour le staff, gestion avec settings:manage seulement", async () => {
      const list = await get(moderator, "/moderation-reasons").expect(200)
      expect(
        list.body.map((reason: { code: string }) => reason.code),
      ).toContain("PHOTOS_QUALITY")
      const code = `TEST_${Date.now()}`
      const body = {
        code,
        action: "REJECT",
        label: "Motif de test",
        ownerMessage: "Votre annonce ne respecte pas nos règles.",
      }
      await post(moderator, "/moderation-reasons", body).expect(403)
      await post(admin, "/moderation-reasons", body).expect(201)
      const duplicate = await post(admin, "/moderation-reasons", body).expect(
        409,
      )
      expect(duplicate.body.code).toBe("MODERATION_REASON_EXISTS")

      await test.http
        .patch(`/api/v1/admin/moderation-reasons/${code}`)
        .set(admin.auth)
        .send({ isActive: false })
        .expect(200)
      const listing = await pendingListing()
      const inactive = await post(moderator, `/listings/${listing}/reject`, {
        expectedStatus: "PENDING_REVIEW",
        reasonCode: code,
      }).expect(422)
      expect(inactive.body.code).toBe("MODERATION_REASON_INVALID")
    })

    it("tableau de bord : files filtrées par permission, avec définition et date", async () => {
      await pendingListing()
      const board = await get(moderator, "/dashboard").expect(200)
      expect(Date.parse(board.body.computedAt)).not.toBeNaN()
      const pending = board.body.queues.find(
        (queue: { key: string }) => queue.key === "listings_pending_review",
      )
      expect(pending.value).toBeGreaterThanOrEqual(1)
      expect(pending.definition).toBeTruthy()

      const analystBoard = await get(analyst, "/dashboard").expect(200)
      expect(analystBoard.body.queues).toEqual([])
      expect(analystBoard.body.analyticsAvailable).toBe(true)
    })

    it("journal d'audit paginé par curseur, réservé à audit_log:read", async () => {
      await get(moderator, "/audit-logs").expect(403)
      const target = await userWithRoles(test, [])
      for (const reason of ["premier", "second"]) {
        await post(admin, `/users/${target.userId}/notes`, {
          body: `Note ${reason}`,
        }).expect(201)
      }
      const first = await get(
        admin,
        `/audit-logs?entityId=${target.userId}&action=ADMIN_NOTE_ADDED&limit=1`,
      ).expect(200)
      expect(first.body.items).toHaveLength(1)
      expect(first.body.nextCursor).toBeTruthy()
      const second = await get(
        admin,
        `/audit-logs?entityId=${target.userId}&action=ADMIN_NOTE_ADDED&limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`,
      ).expect(200)
      expect(second.body.items).toHaveLength(1)
      expect(second.body.items[0].newValues).not.toEqual(
        first.body.items[0].newValues,
      )
      expect(second.body.nextCursor).toBeNull()
      expect(first.body.items[0].actor.id).toBe(admin.userId)

      await get(admin, "/audit-logs?cursor=pas-un-curseur").expect(400)
    })
  })
})
