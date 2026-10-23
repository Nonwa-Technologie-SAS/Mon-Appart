# Stratégie Trust & Safety — Mon Appart

Complète [trust-and-verification.md](./trust-and-verification.md), [anti-fraud.md](./anti-fraud.md) et [admin-backoffice-moderation.md](./admin-backoffice-moderation.md). Aucun second système d’identité, de CRM d’enquête ou de workflow d’annonces n’est créé.

## Objectif

Réduire la publication d’annonces trompeuses et les tentatives d’escroquerie, tout en préservant les parcours légitimes de publication et de contact. **Une détection automatique déclenche une évaluation de risque, jamais une preuve de fraude ni une sanction.**

## Distinctions obligatoires

| Notion                                       | Ce qu’elle n’est pas                       |
| -------------------------------------------- | ------------------------------------------ |
| Score / niveau de risque (`listing-risk-v1`) | Statut public de l’annonce                 |
| Vérification (`VERIFIED`)                    | Preuve de propriété juridique              |
| Signalement (`Report`)                       | Preuve, ni motif automatique de suspension |
| Alerte (`TrustSignal`)                       | Décision de modération                     |
| E-mail ou téléphone confirmé                 | Identité de la personne                    |
| Identité examinée                            | Existence juridique d’une agence           |
| Mandat examiné                               | Titre de propriété du bien                 |

## Principes

1. Réutiliser Trust, Listing, Communication, Media, Identity, Analytics.
2. Décision humaine pour toute mesure préjudiciable (suspension, révocation, fermeture de conversation).
3. Proportionnalité : un signal isolé, même HIGH, ne bloque rien.
4. Minimisation : pas de fingerprinting, pas de conservation du corps des messages dans les alertes.
5. Traçabilité : `report_events`, `verification_events`, `trust_signals`, journal d’audit.
6. Équité : aucune règle ne s’appuie sur un quartier, une nationalité, une langue, un genre ou un revenu supposé.
7. Transparence limitée : l’utilisateur voit un statut d’avancement et des conseils ; pas les règles internes de détection.

## Couches

1. **Prévention** : conseils sur la fiche, guide « éviter les arnaques », messages de conversation contextualisés.
2. **Détection** : règles déterministes versionnées (`listing-risk-v1`, `message-safety-v1`).
3. **Signalement** : `POST /trust/reports` et `POST /conversations/:id/report`.
4. **Instruction** : file admin `/reports`, fiche avec extraits bornés, alertes liées, niveau de risque.
5. **Décision** : workflows Listing (suspension) et Trust (vérification), jamais un CRM parallèle.
6. **Apprentissage** : labels issus des dossiers examinés (`CONFIRMED` / `DISMISSED`), pas des signalements bruts.

## Périmètre Côte d’Ivoire

Le produit cible le marché ivoirien (XOF, fuseau Africa/Abidjan). Les règles de détection tiennent compte de pratiques locales (acompte, Orange Money / Wave, déport WhatsApp) **sans les assimiler automatiquement à une fraude**. La conformité à la loi 2013-450 et aux textes ARTCI n’est pas garantie par le seul code : voir [security-evidence-and-retention.md](./security-evidence-and-retention.md).
