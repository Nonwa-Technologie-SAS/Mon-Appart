# Club Mon Appart — fidélisation (lot mobile 24)

Document de conception. Le programme **n'est pas ouvert**. Aucun partenaire, aucun barème et aucune récompense ne sont en production.

## Nom

| Piste                 | Lecture                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| Mon Appart Rewards    | Suggère une monnaie. Écarté.                                                           |
| Mon Appart Privilèges | Suggère des avantages déjà accordés. Écarté.                                           |
| Communauté Mon Appart | Décrit un espace social qui n'existe pas. Écarté pour le nom principal.                |
| **Club Mon Appart**   | Court, mémorisable, n'annonce pas d'argent. Retenu comme nom, pas comme produit lancé. |

## Audit

| Domaine       | État réel                                                                                     | Réutilisable                                           | Besoin                                                 |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Profil        | `AuthUser`, préférences, recherches enregistrées, confidentialité                             | Écran Compte, Design System                            | Aucun champ de points                                  |
| Parrainage    | Absent du schéma Prisma et des routes                                                         | `share_plus`, `PUBLIC_WEB_HOST`, schéma `monappart://` | Code, qualification, ledger. Pas de deferred deep link |
| Récompenses   | Absentes                                                                                      | —                                                      | Catalogue réel uniquement après accord                 |
| Analytics     | Web : `POST /api/v1/analytics/events`. Mobile : télémétrie technique locale. `UserEvent` Nest | Ne pas traiter un événement analytics comme preuve     | Qualification serveur                                  |
| Notifications | Boîte et préférences Nest. Push non opérationnel (pas de FCM/APNs)                            | Préférences                                            | Pas de catégorie Club tant que le ledger n'existe pas  |
| Abonnements   | `Subscription` / `SubscriptionPeriod` : services de plateforme, jamais le loyer               | —                                                      | Pas de réduction inventée                              |
| Partenariats  | Aucun acteur nommé dans le dépôt                                                              | —                                                      | Accord écrit avant tout affichage                      |
| Back-office   | Application admin existante, aucun écran Club vérifié                                         | Journal d'audit à concevoir avec le ledger             | Règles versionnées, ajustements justifiés              |

Les badges `GET /trust/listings/:id/badges` décrivent un examen de pièces. Ils ne sont pas des badges de gamification.

## Ce que l'application fait

- Une entrée **Club Mon Appart** dans l'espace personnel (pas un onglet de navigation).
- Un écran qui dit que le programme n'est pas ouvert : pas de solde, pas de catalogue, pas de code.
- Un partage de l'adresse `https://{PUBLIC_WEB_HOST}` seulement si l'hôte est configuré. Le texte précise qu'il n'y a ni code ni récompense.
- Aucun calcul de points côté Flutter. `ClubProgram.launched` vaut `false`.

## Ce qui n'est pas construit

Ledger de points, catalogue, rédemption, codes de parrainage, qualification de filleul, badges de progression, classements, communauté, ambassadeurs, campagnes, notifications Club, administration des règles.

## Barème proposé (non validé, non appliqué)

Valeurs indicatives pour une discussion produit. Elles ne créditent personne.

| Identifiant          | Conditions                                                                                           | Points                                 | Plafond      | Délai                           | Annulation                                                | Fraude | Validation                |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------ | ------------------------------- | --------------------------------------------------------- | ------ | ------------------------- |
| `profile.completed`  | Nom et moyen de contact vérifié déjà présents sur `User`                                             | 20                                     | 1 fois       | Immédiat après écriture serveur | Profil vidé                                               | Faible | Serveur                   |
| `search.saved`       | Recherche enregistrée distincte, compte vérifié                                                      | 5                                      | 3 / 30 jours | Immédiat                        | Recherche supprimée sous 24 h                             | Moyen  | Serveur                   |
| `referral.qualified` | Filleul vérifié **et** action réelle (recherche enregistrée ou annonce conforme), pas l'installation | 50 parrain, avantage filleul à définir | 10 / an      | 7 jours                         | Compte lié, même appareil non suffisant seul, signal fort | Élevé  | Serveur + revue si signal |
| `listing.quality`    | Annonce conforme aux règles de publication existantes, pas un doublon                                | 15                                     | 1 / annonce  | Après contrôles déjà prévus     | Retrait ou rejet                                          | Élevé  | Serveur                   |
| `lead.answered`      | Première réponse humaine traçable dans le délai produit                                              | 10                                     | 1 / prospect | Après le message persisté       | Message automatique ou prospect lié                       | Élevé  | Serveur                   |

Ne pas récompenser : installation, inscription non vérifiée, clics, consultations, messages en masse, annonces dupliquées, contacts fictifs, visites non réalisées, avis non authentiques.

Expiration éventuelle : 18 mois d'inactivité du compte, annoncée 30 jours avant, par opération compensatoire traçable. Non appliquée.

## Catalogue

Aucun article. Les pistes (mise en avant d'annonce, mois d'abonnement, accompagnement à la publication) ne s'affichent que lorsqu'une offre interne ou un partenaire a un stock, une validité et un responsable. Aucun nom d'entreprise ivoirienne n'est un partenaire.

## Parrainage proposé

1. Lien `https://{PUBLIC_WEB_HOST}/rejoindre?code=` seulement quand Nest émet le code.
2. L'application conserve le code reçu sur un lien HTTPS de confiance, comme les autres liens publics. Le schéma `monappart://` ne transporte pas de secret.
3. Pas de deferred deep link : un passage store peut perdre le code. Le dire dans l'écran.
4. Qualification par segment (chercheur, propriétaire, agence) définie côté serveur. L'installation ne qualifie pas.
5. Le parrain ne voit pas le téléphone ni l'e-mail du filleul.
6. Unicité, plafond, interdiction d'auto-parrainage, annulation par opération compensatoire, contestation manuelle. Pas de blocage automatique sur un signal faible.

## Gamification proposée

Niveaux (Découverte, Membre actif, Membre engagé, Ambassadeur, Expert) seulement après des faits serveur. Pas de classement public au lancement. Les badges de confiance des annonces restent distincts.

## Propriétaires et agences

Même ledger, règles séparées : qualité d'annonce, fraîcheur, réponse aux prospects. Pas de niveau gagné par volume, faux prospects ou comptes liés. Aucune remise d'abonnement tant qu'elle n'est pas une offre billing réelle.

## Communauté

Pas de réseau social dans cette version. Les contenus utiles (guides, anti-arnaque) relèvent d'un éditorial modéré, juridique relu par une personne compétente, hors de ce lot.

## Ambassadeurs

Candidature, charte et retrait à définir. Un ambassadeur ne promet pas d'avantage et ne représente pas Mon Appart sans mandat. Non ouvert.

## API manquante (ne pas l'inventer dans l'application)

| Route                   | Méthode | Auth    | Rôle                                                                              |
| ----------------------- | ------- | ------- | --------------------------------------------------------------------------------- |
| `/loyalty/account`      | GET     | session | Solde, en attente, niveau. Pagination absente (un compte).                        |
| `/loyalty/transactions` | GET     | session | Historique immuable, `cursor`.                                                    |
| `/loyalty/rewards`      | GET     | session | Catalogue publié, stock réel.                                                     |
| `/loyalty/redemptions`  | POST    | session | Corps `{rewardId}`, en-tête `Idempotency-Key`. 409 si stock ou solde insuffisant. |
| `/referrals/me`         | GET     | session | Code et lien, sans coordonnées des filleuls.                                      |
| `/referrals`            | POST    | session | Associe un code au compte courant. 409 si déjà associé ou auto-parrainage.        |

Erreurs : 401, 403, 404, 409, 422. Le client affiche l'échec et ne marque rien comme acquis. PostgreSQL reste la source de vérité. Ajustement admin = transaction compensatoire + motif, jamais un UPDATE silencieux du solde.

## Anti-fraude

Plafonds, déduplication par clé métier, délai sur le parrainage, revue manuelle des cas sensibles, contestation. Un événement analytics n'est pas une preuve. Pas de collecte d'identifiant publicitaire pour ce programme.

## Transparence

Les points ne sont pas une monnaie, un dépôt ou un instrument financier. Conditions à faire relire (Côte d'Ivoire, données personnelles, prospection) avant toute ouverture. Ce document n'est pas cette validation.

## Mesure (quand le ledger existera)

Rétention, parrainages qualifiés (pas les installations), points émis / utilisés / expirés, coût réel des avantages, fraude annulée. Distinguer corrélation et effet. Une expérimentation contrôlée est préférable à un lancement général.

## Phases

| Phase        | Contenu                             | Dépendance                              | Critère                          |
| ------------ | ----------------------------------- | --------------------------------------- | -------------------------------- |
| 1 Fondations | Ce document, écran honnête          | —                                       | Aucun solde affiché              |
| 2 Parrainage | Code et qualification serveur       | API                                     | Installation non récompensée     |
| 3 Points     | Ledger, historique, badges de faits | Phase 2 si le parrainage paie en points | Tests de concurrence verts       |
| 4 Catalogue  | Avantages réels seulement           | Accord ou offre interne                 | Stock atomique                   |
| 5 Communauté | Guides modérés                      | Décision produit                        | Pas de petites annonces sauvages |
| 6 Mesure     | Segmentation, expérimentation       | Phases 2–4                              | Coût par acquisition qualifiée   |

Durées : non estimées. Pas de calendrier inventé.

## Limites

Pas de partenaires, pas de push Club, pas de back-office Club, pas de couverture iOS compilée depuis Windows, publication store toujours NO-GO (lot 20).
