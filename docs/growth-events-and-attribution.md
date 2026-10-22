# Événements de croissance et attribution

Complète le catalogue `packages/analytics/src/catalog.ts` et [analytics-and-tracking.md](./analytics-and-tracking.md). Helpers : `packages/analytics/src/acquisition.ts`.

## Événements growth (catalogue)

| Événement | Origine | Rôle growth |
| --------- | ------- | ----------- |
| `acquisition_touch` | client | Première / session attribution (UTM + referrer host) |
| `app_opened` / `page_viewed` | client | Visite / sessions (consent) |
| `search_submitted` | server | Recherche réelle |
| `search_results_viewed` | client | Résultats affichés |
| `listing_detail_viewed` | client | Consultation fiche |
| `listing_contact_started` | client | Intention (≠ lead) |
| `listing_contact_submitted` / `appointment_*` | server | Conversion backend |
| `listing_favorited` / `unfavorited` | server (Nest) | Favoris API Nest |
| `listing_shared` | client | Partage |
| `listing_published` / `registration_completed` | server | Activation annonceur / signup |
| `recommendations_*` | mixte | Rétention reco |

Noms SEO historiques (`organic_landing`, `listing_view`, …) : **ne pas créer** — mapper vers le tableau ci-dessus.

## Attribution

### Collecte

1. Lecture `utm_source`, `utm_medium`, `utm_campaign` + `document.referrer`.
2. Normalisation en codes `[A-Z0-9_]{1,40}` (`normalizeCampaignCode`).
3. Classification canal (`ORGANIC_SEARCH`, `PAID`, `SOCIAL`, …) — **hypothèse**, pas une API ads.
4. Émission `acquisition_touch` une fois par session navigateur après consentement.
5. First-touch conservé en localStorage (v1) ; session-touch en sessionStorage.

### Modèles

| Modèle | Définition | Limite |
| ------ | ---------- | ------ |
| First touch | Premier `acquisition_touch` FIRST stocké | Biais multi-appareils |
| Session | Touch de la visite courante | Pas de parcours multi-sessions |
| Last touch avant conversion | Non implémenté (nécessite jointure user + consent) | — |

**Association ≠ causalité.** Un dernier clic paid ne « cause » pas un contact.

### Consentement

Sans consentement analytique : aucun `acquisition_touch` / `page_viewed`. Pas de contournement.

## Qualité

- Idempotence `eventId` + anti-doublon client.
- Pas d’URL complète, pas de texte de recherche, pas de PII dans les props.
- Variantes orthographiques UTM fusionnées par normalisation.
