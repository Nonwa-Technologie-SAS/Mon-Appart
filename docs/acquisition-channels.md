# Canaux d’acquisition et mesure

## Canaux reconnus (`acquisition_touch.channel`)

| Canal | Signaux typiques |
| ----- | ---------------- |
| `ORGANIC_SEARCH` | utm_medium ORGANIC, referrer Google/Bing… |
| `PAID` | utm_medium CPC/PPC/PAID |
| `SOCIAL` | medium SOCIAL ou host Facebook/Instagram… |
| `EMAIL` | medium EMAIL |
| `MESSAGING` | medium SMS/WHATSAPP |
| `PARTNER` | medium PARTNER / AFFILIATE |
| `REFERRAL` | referrer host non classé |
| `DIRECT` | aucun UTM ni referrer |
| `UNKNOWN` | UTM présents mais non classables |

SEO organique pages : [seo-performance-organic-growth.md](./seo-performance-organic-growth.md), [seo-keyword-strategy.md](./seo-keyword-strategy.md). Mesure Search Console : **uniquement si configurée** — non affirmée ici.

## Taxonomie campagnes (recommandée)

`utm_source` = plateforme (GOOGLE, META…), `utm_medium` = levier (CPC, SOCIAL…), `utm_campaign` = nom normalisé (ABIDJAN_Q4…).

Toujours via `normalizeCampaignCode` avant analyse.

## Publicité payante

Bases prêtes (UTM + conversions backend). **Aucune campagne déployée, aucun pixel ads, aucun identifiant fictif.** Avant investissement : petit test mesurant contacts qualifiés, pas seulement clics.

## Coûts

Import dépenses non implémenté → pas de CAC / ROAS dans le BI.
