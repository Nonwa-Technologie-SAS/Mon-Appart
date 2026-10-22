import { Injectable, Logger } from "@nestjs/common"
import { performance } from "node:perf_hooks"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { Prisma } from "../../../generated/prisma/client"
import { MetricsService } from "../../../observability/metrics.service"
import { AnalyticsConfig } from "../analytics.config"
import { addDays, isoDay, utcDay } from "../domain/ingestion-rules"
import { AnalyticsRepository } from "../infrastructure/analytics.repository"

export const AGGREGATE_JOB = "aggregate_daily"
/** Espace de verrous consultatifs PostgreSQL propre à Analytics. */
const LOCK_NAMESPACE = 72_410
const MAX_DAYS_PER_RUN = 31
const DAY_TIMEOUT_MS = 120_000

export interface AggregationResult {
  days: string[]
  skipped: string[]
}

/**
 * Agrégats journaliers (UTC) recalculés intégralement : supprimer puis
 * réinsérer un jour dans une transaction rend le calcul rejouable et
 * idempotent. Un verrou consultatif par jour évite deux calculs simultanés
 * (plusieurs instances). Les KPI métier sont lus dans les tables métier,
 * sources de vérité ; le parcours et l'exposition dans `analytics_events`.
 */
@Injectable()
export class AggregationService {
  private readonly logger = new Logger("AnalyticsAggregation")

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly config: AnalyticsConfig,
    private readonly metrics: MetricsService,
  ) {}

  /** Jours à (re)calculer depuis le checkpoint, fenêtre de retard comprise. */
  async run(now = new Date()): Promise<AggregationResult> {
    const started = performance.now()
    const today = utcDay(now)
    const checkpoint =
      await this.repository.client.analyticsCheckpoint.findUnique({
        where: { job: AGGREGATE_JOB },
      })
    let from: Date
    if (checkpoint?.completedDay) {
      from = addDays(utcDay(checkpoint.completedDay), 1 - this.config.lateDays)
    } else {
      const first = await this.repository.client.analyticsEvent.aggregate({
        _min: { occurredAt: true },
      })
      from = first._min.occurredAt ? utcDay(first._min.occurredAt) : today
    }
    const floor = this.oldestRecomputableDay(now)
    if (from < floor) from = floor
    // Rattrapage borné ; le passage suivant reprend où celui-ci s'arrête.
    const last = new Date(
      Math.min(today.getTime(), addDays(from, MAX_DAYS_PER_RUN - 1).getTime()),
    )

    const result: AggregationResult = { days: [], skipped: [] }
    try {
      for (let day = from; day <= last; day = addDays(day, 1)) {
        const done = await this.recomputeDay(day)
        ;(done ? result.days : result.skipped).push(isoDay(day))
      }
      const closed = addDays(last < today ? last : today, last < today ? 0 : -1)
      await this.saveCheckpoint(closed, now, performance.now() - started, null)
      this.metrics.analytics.jobRuns.inc({ job: AGGREGATE_JOB, outcome: "ok" })
      this.metrics.analytics.lastSuccess.set(
        { job: AGGREGATE_JOB },
        Math.floor(now.getTime() / 1_000),
      )
    } catch (error) {
      this.metrics.analytics.jobRuns.inc({
        job: AGGREGATE_JOB,
        outcome: "error",
      })
      await this.saveCheckpoint(
        checkpoint?.completedDay ?? null,
        now,
        performance.now() - started,
        safeErrorMessage(error),
      ).catch(() => undefined)
      throw error
    } finally {
      this.metrics.analytics.jobDuration.observe(
        { job: AGGREGATE_JOB },
        performance.now() - started,
      )
    }
    return result
  }

  /**
   * Avant cette date, les événements bruts ont pu être purgés : recalculer
   * effacerait des agrégats valides.
   */
  oldestRecomputableDay(now = new Date()): Date {
    return addDays(utcDay(now), 1 - this.config.retentionDays)
  }

  /** Recalcule un jour ; `false` si une autre instance le calcule déjà. */
  async recomputeDay(day: Date): Promise<boolean> {
    const start = utcDay(day)
    if (start < this.oldestRecomputableDay()) {
      throw new Error(
        `Jour ${isoDay(start)} antérieur à la rétention : recalcul refusé`,
      )
    }
    const range: DayRange = {
      day: isoDay(start),
      start: start.toISOString(),
      end: addDays(start, 1).toISOString(),
    }
    const lockKey = Math.floor(start.getTime() / 86_400_000)
    return this.repository.client.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(${LOCK_NAMESPACE}::int, ${lockKey}::int) AS locked
        `
        if (!lock?.locked) return false
        await tx.$executeRaw`DELETE FROM analytics_daily_metrics WHERE day = ${range.day}::date`
        await tx.$executeRaw`DELETE FROM analytics_listing_daily WHERE day = ${range.day}::date`
        for (const statement of dailyMetricStatements(range)) {
          await tx.$executeRaw(statement)
        }
        await tx.$executeRaw(listingDailyStatement(range))
        return true
      },
      { timeout: DAY_TIMEOUT_MS, maxWait: 5_000 },
    )
  }

  private async saveCheckpoint(
    completedDay: Date | null,
    now: Date,
    durationMs: number,
    error: string | null,
  ): Promise<void> {
    const data = {
      completedDay,
      lastRunAt: now,
      durationMs: Math.round(durationMs),
      lastError: error?.slice(0, 255) ?? null,
      updatedAt: now,
      ...(error ? {} : { lastSuccessAt: now }),
    }
    await this.repository.client.analyticsCheckpoint.upsert({
      where: { job: AGGREGATE_JOB },
      create: { job: AGGREGATE_JOB, ...data },
      update: data,
    })
    if (error) {
      this.logger.error(
        JSON.stringify({ action: "analytics.aggregation_failed", error }),
      )
    }
  }
}

interface DayRange {
  day: string
  start: string
  end: string
}

/** Événements du jour avec la clé d'acteur (compte, sinon pseudonyme, sinon visite). */
function eventsCte(range: DayRange): Prisma.Sql {
  return Prisma.sql`
    WITH ev AS (
      SELECT name, source, basis, properties, listing_id,
             COALESCE('u' || user_id::text, 'a' || anonymous_id::text,
                      's' || session_id::text, 'e' || event_id::text) AS actor
      FROM analytics_events
      WHERE occurred_at >= ${range.start}::timestamptz
        AND occurred_at < ${range.end}::timestamptz
    )`
}

function dailyMetricStatements(range: DayRange): Prisma.Sql[] {
  const day = Prisma.sql`${range.day}::date`
  const insert = Prisma.sql`
    INSERT INTO analytics_daily_metrics (day, metric, dimension, value, count, actors, computed_at)`
  const inRange = (column: string) => Prisma.sql`
    ${Prisma.raw(column)} >= ${range.start}::timestamptz
    AND ${Prisma.raw(column)} < ${range.end}::timestamptz`

  return [
    // Volumes par événement, au total et par plateforme.
    Prisma.sql`${eventsCte(range)} ${insert}
      SELECT ${day}, 'event.' || name, '', '', count(*), count(DISTINCT actor), now()
      FROM ev GROUP BY name
      UNION ALL
      SELECT ${day}, 'event.' || name, 'platform', lower(source::text),
             count(*), count(DISTINCT actor), now()
      FROM ev GROUP BY name, source`,

    // Parcours : acteurs ayant consenti ce jour-là (cohorte cohérente).
    Prisma.sql`${eventsCte(range)},
      cohort AS (SELECT DISTINCT actor FROM ev WHERE basis = 'CONSENT'),
      steps(step, name) AS (VALUES
        ('2_RESULTS', 'search_results_viewed'),
        ('2_RESULTS', 'map_results_viewed'),
        ('3_DETAIL', 'listing_detail_viewed'),
        ('4_CONTACT_STARTED', 'listing_contact_started'),
        ('5_CONTACT_SUBMITTED', 'listing_contact_submitted'),
        ('6_APPOINTMENT_REQUESTED', 'appointment_requested'),
        ('7_APPOINTMENT_COMPLETED', 'appointment_completed'),
        ('8_QUALIFIED_LEAD', 'qualified_lead_recorded'))
      ${insert}
      SELECT ${day}, 'funnel', 'step', '1_VISIT', count(*), count(*), now()
      FROM cohort
      UNION ALL
      SELECT ${day}, 'funnel', 'step', steps.step,
             count(DISTINCT ev.actor), count(DISTINCT ev.actor), now()
      FROM ev JOIN steps ON steps.name = ev.name
      WHERE ev.actor IN (SELECT actor FROM cohort)
      GROUP BY steps.step`,

    // Recherche : volumes, zéro résultat, ventilations par code.
    Prisma.sql`${eventsCte(range)},
      s AS (SELECT actor, properties FROM ev WHERE name = 'search_submitted')
      ${insert}
      SELECT ${day}, 'search.submitted', '', '', count(*), count(DISTINCT actor), now()
      FROM s HAVING count(*) > 0
      UNION ALL
      SELECT ${day}, 'search.zero_results', '', '', count(*), count(DISTINCT actor), now()
      FROM s WHERE (properties->>'resultCount')::int = 0 HAVING count(*) > 0
      UNION ALL
      SELECT ${day}, 'search.submitted', 'commune', properties->>'commune',
             count(*), count(DISTINCT actor), now()
      FROM s WHERE properties->>'commune' IS NOT NULL GROUP BY 4
      UNION ALL
      SELECT ${day}, 'search.zero_results', 'commune', properties->>'commune',
             count(*), count(DISTINCT actor), now()
      FROM s WHERE properties->>'commune' IS NOT NULL
        AND (properties->>'resultCount')::int = 0 GROUP BY 4
      UNION ALL
      SELECT ${day}, 'search.submitted', 'listing_type', properties->>'listingType',
             count(*), count(DISTINCT actor), now()
      FROM s WHERE properties->>'listingType' IS NOT NULL GROUP BY 4
      UNION ALL
      SELECT ${day}, 'search.submitted', 'property_type', properties->>'propertyType',
             count(*), count(DISTINCT actor), now()
      FROM s WHERE properties->>'propertyType' IS NOT NULL GROUP BY 4
      UNION ALL
      SELECT ${day}, 'search.submitted', 'budget', properties->>'budgetBucket',
             count(*), count(DISTINCT actor), now()
      FROM s WHERE properties->>'budgetBucket' IS NOT NULL GROUP BY 4
      UNION ALL
      SELECT ${day}, 'search.filter', 'filter', f.value,
             count(*), count(DISTINCT actor), now()
      FROM s CROSS JOIN LATERAL jsonb_array_elements_text(s.properties->'filters') AS f(value)
      GROUP BY f.value`,

    // Recommandation : génération, exposition, ouverture, conversion, retours.
    Prisma.sql`${eventsCte(range)},
      r AS (
        SELECT name, actor, properties, properties->>'algorithmVersion' AS algorithm
        FROM ev
        WHERE name IN ('recommendations_requested', 'recommendations_viewed',
                       'recommended_listing_opened', 'recommendation_converted',
                       'recommendation_dismissed', 'recommendation_feedback_submitted')
      )
      ${insert}
      SELECT ${day}, 'reco.requested', 'algorithm', algorithm,
             count(*), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommendations_requested' GROUP BY 4
      UNION ALL
      SELECT ${day}, 'reco.items_served', 'algorithm', algorithm,
             sum((properties->>'itemCount')::int), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommendations_requested' GROUP BY 4
      UNION ALL
      SELECT ${day}, 'reco.impressions', 'algorithm', algorithm,
             sum(jsonb_array_length(properties->'items')), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommendations_viewed' GROUP BY 4
      UNION ALL
      SELECT ${day}, 'reco.opens', 'algorithm', algorithm,
             count(*), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommended_listing_opened' GROUP BY 4
      UNION ALL
      SELECT ${day}, 'reco.conversions', 'algorithm', algorithm,
             count(*), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommendation_converted' GROUP BY 4
      UNION ALL
      SELECT ${day}, 'reco.dismissed', 'algorithm', algorithm,
             count(*), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommendation_dismissed' GROUP BY 4
      UNION ALL
      SELECT ${day}, 'reco.feedback', 'feedback', properties->>'feedback',
             count(*), count(DISTINCT actor), now()
      FROM r WHERE name = 'recommendation_feedback_submitted' GROUP BY 4`,

    // KPI métier : tables métier (sources de vérité), indépendants du consentement.
    Prisma.sql`${insert}
      SELECT ${day}, 'kpi.registrations', '', '', count(*), count(*), now()
      FROM users WHERE ${inRange("created_at")}
      UNION ALL
      SELECT ${day}, 'kpi.listings_created', '', '', count(*), count(DISTINCT created_by_id), now()
      FROM listings WHERE ${inRange("created_at")}
      UNION ALL
      SELECT ${day}, 'kpi.listings_published', '', '', count(*), count(DISTINCT listing_id), now()
      FROM listing_status_history
      WHERE new_status = 'PUBLISHED' AND ${inRange("created_at")}
      UNION ALL
      SELECT ${day}, 'kpi.contacts', '', '', count(*), count(DISTINCT requester_id), now()
      FROM conversations
      WHERE type = 'PROPERTY_INQUIRY' AND ${inRange("created_at")}
      UNION ALL
      SELECT ${day}, 'kpi.appointments_requested', '', '', count(*), count(DISTINCT user_id), now()
      FROM appointments WHERE ${inRange("created_at")}
      UNION ALL
      SELECT ${day}, 'kpi.appointments_confirmed', '', '', count(*), count(DISTINCT user_id), now()
      FROM appointments WHERE ${inRange("confirmed_at")}
      UNION ALL
      SELECT ${day}, 'kpi.appointments_completed', '', '', count(*), count(DISTINCT user_id), now()
      FROM appointments WHERE ${inRange("completed_at")}`,

    // Dérivés analytiques : leads qualifiés, délai médian de première réponse.
    Prisma.sql`${eventsCte(range)} ${insert}
      SELECT ${day}, 'kpi.qualified_leads', '', '', count(*), count(DISTINCT actor), now()
      FROM ev WHERE name = 'qualified_lead_recorded' HAVING count(*) > 0
      UNION ALL
      SELECT ${day}, 'kpi.reply_median_seconds', '', '',
             round(percentile_cont(0.5) WITHIN GROUP (
               ORDER BY (properties->>'responseSeconds')::int))::bigint,
             count(*), now()
      FROM ev WHERE name = 'message_reply_received' HAVING count(*) > 0`,
  ]
}

/** Statistiques par annonce : aucun identifiant de visiteur n'en sort. */
function listingDailyStatement(range: DayRange): Prisma.Sql {
  const inRange = (column: string) => Prisma.sql`
    ${Prisma.raw(column)} >= ${range.start}::timestamptz
    AND ${Prisma.raw(column)} < ${range.end}::timestamptz`
  return Prisma.sql`${eventsCte(range)}
    INSERT INTO analytics_listing_daily (
      listing_id, day, detail_views, unique_viewers, card_impressions, shares,
      contacts_started, contacts_submitted, appointments_requested,
      appointments_confirmed, appointments_completed, qualified_leads,
      recommendation_impressions, recommendation_opens, computed_at)
    SELECT listing_id, ${range.day}::date,
           sum(dv)::int, sum(uv)::int, sum(ci)::int, sum(sh)::int, sum(cs)::int,
           sum(cc)::int, sum(ar)::int, sum(ac)::int, sum(ad)::int, sum(ql)::int,
           sum(ri)::int, sum(ro)::int, now()
    FROM (
      SELECT listing_id,
             count(*) FILTER (WHERE name = 'listing_detail_viewed') AS dv,
             count(DISTINCT actor) FILTER (WHERE name = 'listing_detail_viewed') AS uv,
             count(*) FILTER (WHERE name = 'listing_card_viewed') AS ci,
             count(*) FILTER (WHERE name = 'listing_shared') AS sh,
             count(*) FILTER (WHERE name = 'listing_contact_started') AS cs,
             0 AS cc, 0 AS ar, 0 AS ac, 0 AS ad,
             count(*) FILTER (WHERE name = 'qualified_lead_recorded') AS ql,
             0 AS ri,
             count(*) FILTER (WHERE name = 'recommended_listing_opened') AS ro
      FROM ev WHERE listing_id IS NOT NULL GROUP BY listing_id
      UNION ALL
      SELECT l.id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, count(*), 0
      FROM ev
      CROSS JOIN LATERAL jsonb_array_elements(ev.properties->'items') AS item
      JOIN listings l ON l.public_id = (item->>'listingId')::uuid
      WHERE ev.name = 'recommendations_viewed'
      GROUP BY l.id
      UNION ALL
      SELECT listing_id, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0, 0
      FROM conversations
      WHERE type = 'PROPERTY_INQUIRY' AND ${inRange("created_at")}
      GROUP BY listing_id
      UNION ALL
      SELECT listing_id, 0, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0
      FROM appointments WHERE ${inRange("created_at")} GROUP BY listing_id
      UNION ALL
      SELECT listing_id, 0, 0, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0
      FROM appointments WHERE ${inRange("confirmed_at")} GROUP BY listing_id
      UNION ALL
      SELECT listing_id, 0, 0, 0, 0, 0, 0, 0, 0, count(*), 0, 0, 0
      FROM appointments WHERE ${inRange("completed_at")} GROUP BY listing_id
    ) AS parts
    GROUP BY listing_id`
}
