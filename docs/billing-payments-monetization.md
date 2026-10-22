# Paiements, abonnements et monétisation

Module `apps/api/src/modules/billing`, back-office `apps/admin` (onglet « Facturation »). Décision d'architecture : [0013-billing-architecture.md](./decisions/0013-billing-architecture.md).

> **Ce module n'est pas une solution réglementaire complète.** Il n'a fait l'objet d'aucune validation juridique, fiscale ni contractuelle. **Aucun prestataire de paiement réel n'est intégré** : seul un simulateur local existe, refusé au démarrage en staging, en production et avec `PAYMENT_ENVIRONMENT=live`.

## Périmètre

- **Services de la plateforme uniquement** : abonnements donnant droit à un quota d'annonces actives. Le module n'encaisse jamais de loyer, de dépôt de garantie, de frais d'agence ni de prix de vente : il n'existe aucun produit de ce type et le catalogue n'accepte que le genre `SUBSCRIPTION_PLAN`.
- Devise : XOF (franc CFA BCEAO, sans subdivision). Montants en entiers (`BIGINT` en base, chaîne décimale en JSON, jamais de flottant).
- Pas de promotions, de codes de réduction, de crédits ni de portefeuille. Il n'existe donc aucun champ `balance`.
- Pas de prélèvement automatique : le renouvellement est un nouvel achat déclenché par le client.

## Principes

1. **PostgreSQL est la source de vérité.** Le prestataire confirme ; la base enregistre l'état, avec l'historique et l'audit dans la même transaction.
2. **Seul le prestataire déclare un paiement réussi**, par notification signée (webhook) ou par interrogation authentifiée de son API. La redirection du navigateur vers une page de succès n'est jamais une preuve : le client doit appeler `POST /billing/payments/:id/refresh`, qui interroge le prestataire.
3. **Le serveur fixe les montants.** Le client n'envoie qu'un code de plan et une clé d'idempotence. Un champ `amount` est rejeté (400, `forbidNonWhitelisted`). Le contenu de la commande (montant, devise, durée, droits) est figé à sa création : une modification du catalogue ne la change pas, et des triggers refusent ces modifications en base.
4. **Idempotence partout** : commandes (`buyer_id, idempotency_key`), notifications (`provider, event_id`), remboursements (`payment_id, idempotency_key`), périodes d'abonnement (une seule par commande), tentatives (une seule ouverte par commande). Ce sont des contraintes d'unicité en base, pas seulement des vérifications applicatives.
5. **Pas de suppression.** Prix, commandes, transactions, notifications, remboursements, abonnements, périodes et incidents sont protégés par des triggers `BEFORE DELETE`. Les corrections passent par des écritures nouvelles (remboursement, révocation de période, incident clos).
6. **Aucune donnée de paiement sensible** : pas de numéro de carte, de CVV, de code OTP ni de mot de passe mobile money. La saisie se fait chez le prestataire. Les notifications ne gardent qu'une empreinte SHA-256 du corps et un résumé normalisé (statut, montant, devise, code d'erreur).

## Modèle de données

Migration `20261013150000_billing_subscriptions` (ajouts seulement, aucune table existante modifiée).

| Table                  | Rôle                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `billing_products`     | Plans (`DRAFT`, `ACTIVE`, `RETIRED`), quota d'annonces actives (`NULL` = illimité), un seul plan par défaut |
| `billing_prices`       | Tarifs historisés (`ACTIVE`, `ARCHIVED`), montant et durée immuables                                        |
| `billing_orders`       | Commande figée ; une seule `PENDING` par acheteur                                                           |
| `payment_transactions` | Tentatives de paiement (prestataire, environnement, référence, montant remboursé)                           |
| `payment_events`       | Trace des notifications reçues (empreinte, signature valide ou non, issue, nombre de réceptions)            |
| `payment_refunds`      | Remboursements rattachés à la transaction d'origine                                                         |
| `subscriptions`        | Abonnement courant ; un seul `ACTIVE`/`PAST_DUE` par compte                                                 |
| `subscription_periods` | Une période par commande payée, révocable                                                                   |
| `billing_incidents`    | Anomalies à examiner ; un seul incident ouvert par type et par transaction                                  |

Le plan par défaut `FREE` est créé par le seed de référence, **sans limite** : aucun compte existant n'est bridé tant qu'un administrateur ne fixe pas de quota.

## États

Commande (`billing_orders.status`) : `PENDING` → `PAID` → (`REFUNDED` après remboursement intégral) ; `PENDING` → `CANCELLED` (client) ou `EXPIRED` (délai `BILLING_ORDER_TTL_MINUTES`).

Paiement (`payment_transactions.status`), distinct de la commande : `CREATED` → `PENDING` → `SUCCEEDED` | `FAILED` | `CANCELLED` | `EXPIRED`. Les états finaux ne régressent jamais : une notification « en attente » reçue après un succès est ignorée et tracée. Un succès tardif sur une commande expirée ou annulée est appliqué (l'argent a été pris) et ouvre un incident `LATE_SUCCESS`.

Abonnement : `ACTIVE`, `PAST_DUE` (grâce, droits conservés), `CANCELLED`, `EXPIRED`. « Résiliation à l'échéance » n'est pas un statut : c'est `ACTIVE` avec `cancelAtPeriodEnd = true`.

Remboursement : `REQUESTED` → `REJECTED`, ou `PROCESSING` (envoyé au prestataire) → `SUCCEEDED` | `FAILED`.

## Parcours de paiement

1. `GET /billing/plans` : plans en vente et tarif courant.
2. `POST /billing/orders` `{ productCode, idempotencyKey }` : commande `PENDING`, montant fixé par le serveur.
3. `POST /billing/orders/:id/payments` : tentative ouverte chez le prestataire (ou tentative existante renvoyée). La réponse contient éventuellement une `redirectUrl`.
4. Le client paie chez le prestataire.
5. Le prestataire notifie `POST /billing/webhooks/:provider`. La notification est vérifiée, dédupliquée, comparée à la transaction (référence, montant, devise), puis appliquée.
6. Au retour du navigateur, `POST /billing/payments/:id/refresh` interroge le prestataire. Seul ce résultat ou le webhook fait foi.
7. Une fois le paiement `SUCCEEDED`, `FulfillmentService` crée la période d'abonnement dans la transaction, une seule fois par commande.

Avec le simulateur, l'étape 4 se joue par `POST /billing/mock/payments/:id/simulate` `{ outcome }`. Cette route est réservée au titulaire de la tentative et renvoie 404 si le simulateur n'est pas actif. Le résultat passe par le **même webhook signé** que celui d'un prestataire réel : le simulateur ne peut pas marquer une commande payée en dehors de ce circuit.

## Webhooks

`POST /api/v1/billing/webhooks/:provider`. La route est publique : un prestataire ne s'authentifie pas avec un JWT. Elle est limitée par IP (`BILLING_WEBHOOK_RATE_LIMIT`) et absente de Swagger.

- **Signature HMAC sur le corps brut** (`rawBody: true` dans `main.ts`), avec horodatage et tolérance (`PAYMENT_WEBHOOK_TOLERANCE_SECONDS`) contre le rejeu, et comparaison à temps constant. Une URL difficile à deviner n'est pas considérée comme une protection.
- Signature invalide ou absente : 401, trace `REJECTED` sans effet. Prestataire inconnu ou inactif : 404.
- **Déduplication** par `(provider, event_id)` : `INSERT … ON CONFLICT DO UPDATE attempts = attempts + 1`. Une même notification reçue N fois n'accorde le droit qu'une fois (vérifié avec 4 envois parallèles).
- **Ordre quelconque** : la transaction est verrouillée (`FOR UPDATE`) et relue ; seules les transitions autorisées par `payment-rules` s'appliquent.
- **Incohérence** (montant ou devise différents, référence inconnue) : rien n'est accordé, un incident est ouvert.
- Les en-têtes `x-mock-signature` et `x-webhook-signature` sont expurgés des logs. Aucun corps brut n'est journalisé ni stocké.

## Réconciliation

`ReconciliationService` tourne dans l'API toutes les `BILLING_WORKER_INTERVAL_MINUTES` minutes (0 la désactive), ou par `pnpm --filter @mon-appart/api billing:reconcile`. Chaque passage est idempotent et sûr en multi-instance (lignes verrouillées puis relues) :

- expiration des commandes échues ;
- interrogation des tentatives sans réponse (au plus une fois toutes les 2 minutes ; au-delà de 24 h sans réponse, clôture locale en `EXPIRED`) ;
- reprise de l'attribution des droits pour une commande payée mais non servie ;
- échéances d'abonnement et rappels de renouvellement ;
- suivi des remboursements en cours chez le prestataire.

Les administrateurs disposent de « Interroger le prestataire » (`billing:reconcile`). Cette action relit l'état chez le prestataire et **ne peut pas** déclarer un paiement réussi.

## Abonnements

- **Souscription** : achat d'un plan `ACTIVE` non par défaut. Les droits (quota, durée) sont ceux figés dans la commande.
- **Renouvellement manuel** : ouvert dans les `BILLING_RENEWAL_WINDOW_DAYS` jours avant l'échéance, ou pendant la grâce. Un renouvellement anticipé prolonge à partir de la fin de période (aucun jour payé n'est perdu). Après l'échéance, la nouvelle période part du paiement : les jours de grâce ne sont pas facturés.
- **Échéance** sans renouvellement : `PAST_DUE` pendant `BILLING_GRACE_DAYS` jours (droits conservés), puis `EXPIRED`. Un abonnement résilié passe à `CANCELLED` à l'échéance.
- **Résiliation** : `POST /billing/me/subscriptions/:id/cancel`. Les droits restent acquis jusqu'à la fin de la période payée, sans remboursement automatique.
- **Changement de plan : non pris en charge** (`PLAN_CHANGE_NOT_SUPPORTED`, 409). Pour changer de plan, il faut laisser expirer ou résilier l'abonnement en cours, puis souscrire. Le prorata et la montée de gamme immédiate sont reportés : ils demandent des règles de calcul validées (arrondi XOF, avoir, remboursement partiel).

## Droits et quota

`EntitlementService` est implémenté dans `billing/entitlements.ts` (sans module Nest, pour être utilisable par Listing sans cycle d'import). Le droit effectif est, dans l'ordre :

1. l'abonnement en cours (échéance + grâce non dépassées) ;
2. sinon le plan par défaut ;
3. sinon illimité.

`GET /billing/me/entitlements` renvoie la source, le plan, la limite et la consommation.

Le quota compte les annonces `PENDING_REVIEW`, `PUBLISHED` et `PAUSED` du publieur. Il est vérifié dans la transaction de mise en ligne, sous verrou consultatif par publieur : deux mises en ligne simultanées ne dépassent pas la limite (vérifié : limite 1, requêtes parallèles, un seul succès). Le refus renvoie 409 et incrémente `billing_listing_quota_rejections_total`.

## Remboursements

- Demande par le client (`POST /billing/payments/:id/refund-requests`, son propre paiement uniquement) ou par l'équipe (`billing:refund_request`). Un motif est obligatoire, ainsi qu'une clé d'idempotence.
- Montant plafonné au remboursable : encaissé − remboursé − demandes ouvertes. Plusieurs remboursements partiels sont possibles.
- **Décision par une autre personne que le demandeur** (`billing:refund`), avec une note obligatoire. La note de décision n'est pas montrée au client.
- Exécution chez le prestataire. Le remboursement n'est marqué `SUCCEEDED` **qu'après sa confirmation**. Un échec reste `FAILED` et ouvre un incident `REFUND_FAILED`.
- Un remboursement intégral passe la commande à `REFUNDED` et révoque la période accordée. L'échéance de l'abonnement recule d'autant ; s'il ne reste plus de droit, l'abonnement se termine. Un remboursement partiel ne retire aucun droit.
- Le simulateur prend en charge les remboursements. Un prestataire réel sans API de remboursement imposera une procédure manuelle hors plateforme, à documenter avec lui, sans jamais marquer un remboursement effectué sans preuve.

## Reçus

`GET /billing/orders/:id/receipt` (acheteur uniquement) renvoie un **reçu de paiement** au format JSON : produit, durée, montant, montant remboursé, prestataire, environnement et date de confirmation. Il est disponible seulement après confirmation du paiement ; sinon la route répond 409. Le document porte `isTaxInvoice: false` et la mention : « Ce document n'est pas une facture et n'a pas de valeur fiscale. »

Il ne s'agit **pas** d'une facture : il ne comporte ni numérotation fiscale continue, ni identification fiscale du vendeur et de l'acheteur, ni TVA. Une facture conforme exige une validation par un expert-comptable ou un fiscaliste (mentions légales ivoiriennes, TVA sur services numériques, éventuelle facture normalisée).

## Back-office

Route `/billing` de `apps/admin`, visible avec `billing:read`. Toutes les permissions sont revérifiées en base par l'API (`AdminAccessGuard`) : masquer un bouton n'est pas un contrôle.

| Onglet         | Contenu                                                                                         | Action (permission)                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Synthèse       | Encaissé brut et remboursé par devise et environnement, statuts, incidents, demandes en attente | —                                                                                                     |
| Commandes      | Liste filtrable, lien vers le diagnostic                                                        | —                                                                                                     |
| Diagnostic     | Commande figée, tentatives, notifications reçues, remboursements, incidents, période accordée   | Interroger le prestataire (`billing:reconcile`), demander un remboursement (`billing:refund_request`) |
| Paiements      | Tentatives, codes d'échec, vérifications                                                        | —                                                                                                     |
| Abonnements    | Statut, échéance, fin de grâce, quota                                                           | —                                                                                                     |
| Remboursements | File des demandes                                                                               | Valider ou refuser avec note (`billing:refund`)                                                       |
| Incidents      | Détail de l'anomalie                                                                            | Clore avec résolution obligatoire (`billing:reconcile`)                                               |
| Notifications  | Trace minimale des webhooks (identifiant, signature, issue, réceptions)                         | —                                                                                                     |
| Catalogue      | Plans et tarifs                                                                                 | Créer, publier, retirer, ajouter ou archiver un tarif (`billing:catalog`)                             |

**Absent par conception** : aucun bouton ni aucune route « marquer payé » (un test vérifie que ces routes répondent 404), aucune modification de montant, aucun affichage de clé ou de secret, aucun revenu net. Les frais du prestataire ne sont pas connus, le net n'est donc pas calculé. La synthèse signale explicitement un prestataire simulé ou un environnement de test.

Rôles par défaut (seed, ajout seul) : `OWNER`, `AGENT` et `AGENCY` reçoivent `billing:purchase` ; `SUPPORT` reçoit `billing:read` et `billing:refund_request` ; `ADMIN` et `SUPER_ADMIN` reçoivent toutes les permissions `billing:*`. La séparation des tâches entre demandeur et décideur d'un remboursement est imposée par le domaine, quel que soit le rôle.

## Audit, événements et métriques

- **Audit** (`audit_logs`) : création de commande, application d'un paiement, attribution et révocation de droits, résiliation, demande et décision de remboursement, incidents, modifications du catalogue. Les entrées sont écrites dans la même transaction que le changement d'état.
- **Analytics** (événements serveur, catalogue `billing`) : `checkout_started`, `payment_attempt_created`, `payment_succeeded`, `payment_failed`, `subscription_started`, `subscription_renewed`, `subscription_cancelled`, `refund_requested`, `refund_completed`. Ils ne contiennent ni montant ni donnée de paiement. Le listener relit la base avant d'émettre : `payment_succeeded` exige `SUCCEEDED` et une date de succès, `refund_completed` exige `SUCCEEDED` et une date d'exécution. Analytics ne remplace pas l'audit.
- **Prometheus** : `billing_orders_created_total{kind}`, `billing_payment_attempts_total{provider,outcome}`, `billing_payment_results_total{provider,status}`, `billing_webhooks_total{provider,outcome}`, `billing_provider_errors_total{provider,operation}`, `billing_incidents_total{kind}`, `billing_refunds_total{status}`, `billing_subscription_changes_total{change}`, `billing_listing_quota_rejections_total`, `billing_job_runs_total{outcome}`. Les labels sont de faible cardinalité, sans identifiant, montant ni secret.

## Prestataires

`PaymentProvider` (`infrastructure/providers/payment-provider.ts`) définit : `createCheckout`, `fetchStatus`, `verifyWebhook`, ainsi que `refund` et `fetchRefundStatus` en option. Les capacités sont déclarées (`refunds`, `recurring: false`). `PaymentProviderRegistry` active au plus un prestataire selon `PAYMENT_PROVIDER`.

| Prestataire (Côte d'Ivoire)      | Moyens                                     | État dans le projet | Prérequis avant intégration                                                   |
| -------------------------------- | ------------------------------------------ | ------------------- | ----------------------------------------------------------------------------- |
| Simulateur `mock`                | aucun (local)                              | **Implémenté**      | Développement et tests uniquement                                             |
| CinetPay                         | Orange Money, MTN MoMo, Moov, Wave, cartes | Non implémenté      | Compte marchand, KYC entreprise, clés API, URL de notification, tests sandbox |
| PayDunya                         | Mobile money, cartes                       | Non implémenté      | Idem                                                                          |
| Wave Business (API Checkout)     | Wave                                       | Non implémenté      | Compte Wave Business, accès API, secret de webhook                            |
| Orange Money / MTN MoMo (direct) | Opérateur unique                           | Non implémenté      | Contrat opérateur par opérateur                                               |
| Stripe                           | Cartes                                     | Non implémenté      | Disponibilité du pays de l'entité juridique à vérifier                        |

Ce tableau est un repère, pas une recommandation contractuelle. Moyens proposés, frais, délais de reversement, remboursements par API et format de signature des webhooks **doivent être vérifiés auprès de chaque prestataire** avant de choisir.

Ajouter un prestataire réel :

1. implémenter `PaymentProvider` : vérification de signature selon sa documentation, corps brut, tolérance d'horodatage, comparaison à temps constant ;
2. ajouter sa valeur à `PAYMENT_PROVIDER` et ses variables (secrets uniquement par l'environnement ou un gestionnaire de secrets) ;
3. écrire des tests avec des notifications enregistrées depuis son sandbox ;
4. valider en sandbox : succès, échec, abandon, double notification, notification tardive, remboursement ;
5. ne passer en `live` qu'après revue du contrat et de la sécurité.

## Variables d'environnement

Voir `.env.example` : `PAYMENT_PROVIDER` (`none` | `mock`), `PAYMENT_ENVIRONMENT` (`test` | `live`), `PAYMENT_MOCK_WEBHOOK_SECRET` (32 caractères minimum, requis avec `mock`, jamais committé), `PAYMENT_WEBHOOK_TOLERANCE_SECONDS`, `BILLING_ORDER_TTL_MINUTES`, `BILLING_MAX_ATTEMPTS_PER_ORDER`, `BILLING_GRACE_DAYS`, `BILLING_RENEWAL_WINDOW_DAYS`, `BILLING_RENEWAL_REMINDER_DAYS`, `BILLING_WORKER_INTERVAL_MINUTES`, `BILLING_RATE_LIMIT` et `BILLING_WEBHOOK_RATE_LIMIT`.

`parseApiEnv` refuse `mock` quand `APP_ENV` vaut `staging` ou `production`, quand `NODE_ENV=production`, et avec `PAYMENT_ENVIRONMENT=live`.

## Tests

- Domaine (`billing-domain.spec.ts`) : montants, machine à états, commandes, abonnements, remboursements, signatures.
- Simulateur (`mock-payment.provider.spec.ts`) : signature, altération, rejeu, schéma strict (un champ `card_number` est refusé), secret absent des sorties.
- Intégration (`test/billing/billing.db-spec.ts`, base `mon_appart_test`) : idempotence, concurrence (commandes, tentatives, webhooks, quota), signatures, ordre des événements, incidents, remboursements avec séparation des tâches, réconciliation, reçu, back-office sans secret ni « marquer payé ».
- Back-office (`apps/admin`) : synthèse sans revenu net et avec avertissement de simulation, absence d'action « marquer payé », actions masquées sans permission.

## Risques juridiques, fiscaux et contractuels (à valider par des professionnels)

- Statut de la plateforme : vendre ses propres services est distinct de collecter des fonds pour le compte de tiers, ce qui relève des établissements de paiement (BCEAO). Le module ne collecte pas de fonds de tiers et ne doit pas évoluer dans ce sens sans agrément ni partenaire agréé.
- Fiscalité : TVA sur les services numériques, mentions et numérotation des factures, éventuelle facture normalisée (FNE) ; régime de l'entité.
- Protection des données (loi ivoirienne 2013-450, ARTCI) : durée de conservation des transactions et de l'audit, information des clients.
- Conditions générales de vente : durée, renouvellement manuel, résiliation, politique de remboursement, droit applicable, réclamations.
- Contrat du prestataire : frais, délais de reversement, rétrofacturations, obligations de sécurité, responsabilité en cas de fraude.

## Reporté

- Intégration d'un prestataire réel (voir plus haut).
- Interface d'achat côté client (`apps/web`, mobile) : l'API est prête, avec ce parcours : plans, commande, tentative, redirection, retour, `refresh`, reçu.
- Changement de plan avec prorata, promotions, crédits, essais gratuits.
- Factures conformes et export comptable.
- Prélèvement automatique (selon les capacités du prestataire retenu).
- Rétrofacturations et litiges, rapprochement avec les relevés de reversement du prestataire.
- Réauthentification et MFA du personnel avant les décisions de remboursement.
