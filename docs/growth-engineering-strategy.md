# Stratégie de croissance (Growth Engineering)

Fondations mesurables pour acquérir, activer, convertir et fidéliser sur le marché ivoirien. Complète [analytics-and-tracking.md](./analytics-and-tracking.md), [bi-metrics-catalog.md](./bi-metrics-catalog.md), [seo-performance-organic-growth.md](./seo-performance-organic-growth.md), [recommendation.md](./recommendation.md).

## Hypothèses (à vérifier, pas des faits)

1. Une part importante du trafic arrive via mobile et recherche locale (Abidjan + villes réellement indexées).
2. Les chercheurs et les annonceurs ont des parcours d’activation distincts.
3. La confiance (annonces vérifiées, anti-arnaque) influence la conversion plus que le volume brut d’annonces.
4. Les canaux payants ne sont utiles qu’après une mesure fiable des contacts qualifiés.

## Modèle AARRR adapté

| Étape | Objectif Mon Appart | Événements clés | Indicateurs |
| ----- | ------------------- | --------------- | ----------- |
| Acquisition | Visiteurs intéressés + annonceurs qualité | `acquisition_touch`, `page_viewed`, SEO | Canal, sessions consentantes |
| Activation chercheur | 1ʳᵉ recherche ou vue détail utile | `search_submitted`, `listing_detail_viewed` | `growth.activated_seeker` |
| Activation annonceur | 1ʳᵉ annonce publiée éligible | `listing_published` | `growth.activated_publisher` |
| Conversion | Contact / visite réelle (backend) | `listing_contact_started` → soumis / `appointment_*` | Taux contact, leads |
| Rétention | Retour via favoris / alertes / reco | Favoris web, reco `/pour-vous` | Cohortes 1/7/30 j (quand volume) |
| Recommandation | Partage naturel d’annonces | `listing_shared` | Partages, trafic SHARE |

## Architecture (sans doublon)

```
Web (consent) ──▶ Tracker @mon-appart/analytics ──▶ Nest Analytics
UTM / referrer ──▶ acquisition_touch (codes normalisés)
Favoris web    ──▶ PropertyFavorite (legacy) + Nest interactions (API)
SEO / BI / Reco / Billing ── modules existants (liens docs)
```

**Étape 1 (actuelle)** : mesure fiable + parcours conversion/rétention légers.  
**Pas encore** : Kafka, CDP, SDK ads, A/B à fort volume, import dépenses publicitaires.

## Priorisation

| Priorité | Action | Statut |
| -------- | ------ | ------ |
| P0 | Client analytics + consentement web | Implémenté |
| P0 | Attribution UTM / referrer (`acquisition_touch`) | Implémenté |
| P1 | Favoris + partage fiche | Implémenté (web legacy) |
| P1 | Empty state sans mutation silencieuse des critères | Implémenté |
| P2 | Alertes push/e-mail sur critères sauvegardés | Fondation locale seulement |
| P2 | Unifier contact/visite web → Nest | Non réalisé (double stack) |
| P3 | Expérimentation A/B | Protocole documenté, non activé |

## Limites

- Stack web legacy (Prisma) ≠ listings Nest : IDs et événements server ne se rejoignent pas encore.
- Pas de dépenses pub : pas de CAC / ROAS calculable.
- Tracker inactif sans `NEXT_PUBLIC_NEST_API_URL` ou sans consentement.
