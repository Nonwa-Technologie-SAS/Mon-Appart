# Confiance et vérification

Module `apps/api/src/modules/trust`. Il rend traçable ce que la plateforme a réellement examiné : identité, droit de publier un bien, documents, agence, cohérence d'une annonce. Il ne certifie rien juridiquement, ne garantit ni le bien ni la transaction, et ne conclut jamais seul à une fraude.

Décision d'architecture : [0009-trust-architecture.md](./decisions/0009-trust-architecture.md).

## Principes

- **Seul un humain décide.** Les dossiers ne passent `VERIFIED`, `REJECTED` ou `REVOKED` que par une route de relecture (`/admin/trust`), jamais par une route du déclarant ni par un traitement automatique.
- **Un fichier envoyé ne prouve rien.** Une pièce prête (`READY` côté Media) ne change pas le statut du dossier.
- **Les automatismes signalent, ils ne sanctionnent pas.** Précontrôles et règles de risque produisent des alertes et des priorités ; aucune suspension, aucun rejet, aucune révocation automatique. L'expiration d'une vérification arrivée à échéance est la seule transition automatique.
- **Séparation des rôles.** Le modérateur instruit, l'agent de confiance décide, l'administrateur technique n'accède pas aux pièces.
- **Rien d'interne vers l'utilisateur.** Notes internes, précontrôles, alertes et identité des relecteurs ne sortent jamais vers le déclarant, la cible d'un signalement ni le public.
- **Libellés factuels.** « Identité vérifiée », « Droit de publication vérifié », avec date et avertissement ; jamais « propriétaire garanti » ni « bien sans risque ».

## Modèle

Réutilise l'existant, complété par des migrations additives :

| Table                      | Rôle                                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verifications`            | Dossier (existante, complétée) : type, statut, cible (utilisateur, bien, annonce), rattachement revendiqué, déclaration minimale, motif, priorité, affectation, précontrôles, dates de soumission, décision, échéance |
| `verification_documents`   | Pièces d'un dossier : **référence** vers `media` (aucune copie de fichier ni de métadonnée de stockage), type de pièce, statut                                                                                        |
| `verification_events`      | Historique en ajout seul : transition, motif public, message au déclarant, note interne, acteur                                                                                                                       |
| `reports`, `report_events` | Signalements et leur historique en ajout seul                                                                                                                                                                         |
| `trust_signals`            | Alertes des règles de risque, dédupliquées tant qu'elles sont ouvertes                                                                                                                                                |
| `trust_scores`             | Score interne explicable (existante, complétée : facteurs, version, état « données insuffisantes »)                                                                                                                   |
| `notifications`            | Notifications in-app (existante, complétée d'un identifiant public)                                                                                                                                                   |
| `media`                    | Les pièces y sont rangées avec `purpose = VERIFICATION`, sans bien, privées, avec empreinte `content_sha256`                                                                                                          |

Les vérifications de téléphone et d'e-mail restent gérées par Identity (code à usage unique) dans la même table : il n'y a pas de seconde table de vérification.

Migrations : `20261012170000_trust_enum_values`, `20261012170100_trust_verification`, `20261012170200_trust_submitted_default`, `20261012170300_notification_public_id`, `20261012180000_trust_history_no_delete`. Détails dans [database.md](./database.md).

## Types de vérification

| Type                  | Cible       | Pièces obligatoires (au moins une par groupe)                                                                     | Prérequis         | Validité |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- | -------- |
| `IDENTITY`            | utilisateur | carte d'identité, passeport, titre de séjour ou carte consulaire                                                  | —                 | 730 j    |
| `PROPERTY_OWNERSHIP`  | bien        | titre foncier, ACD, lettre d'attribution, certificat foncier, acte de vente (+ permis de construire pour un bâti) | identité vérifiée | 365 j    |
| `OWNER_AUTHORIZATION` | bien        | mandat ou procuration                                                                                             | identité vérifiée | 365 j    |
| `PROPERTY_DOCUMENT`   | bien        | un titre ou un justificatif (facture, certificat de résidence)                                                    | —                 | 365 j    |
| `AGENCY`              | utilisateur | registre du commerce ou carte professionnelle                                                                     | identité vérifiée | 365 j    |
| `LISTING_CONSISTENCY` | annonce     | aucune (pièces facultatives)                                                                                      | —                 | 180 j    |

Un permis de construire ou une facture ne suffit pas à établir la propriété ; un terrain exige un titre foncier. `PROPERTY_OWNERSHIP` exige un rattachement revendiqué `SOLE`, `JOINT` ou `USUFRUCT` ; `OWNER_AUTHORIZATION`, `AGENT` ou `MANAGER`. À l'approbation, ce rattachement doit toujours être courant dans `property_ownerships`.

Un seul dossier ouvert par déclarant, type et cible. Un nouveau dossier pour un type déjà vérifié n'est accepté qu'à moins de 30 jours de l'échéance (renouvellement).

## Cycle de vie

```
DRAFT ──soumission──▶ PENDING ──prise en charge──▶ IN_REVIEW
                         │                            │
                         ├────────────┬───────────────┤
                         ▼            ▼               ▼
         NEEDS_MORE_INFORMATION    VERIFIED        REJECTED
              │ (nouvelle soumission)  ├──▶ REVOKED
              └──────▶ PENDING         └──▶ EXPIRED
WITHDRAWN : retrait par le déclarant avant décision.
```

Un brouillon est invisible des relecteurs. Les pièces ne s'ajoutent ou ne se retirent qu'en `DRAFT` ou `NEEDS_MORE_INFORMATION`. `REJECTED`, `REVOKED`, `EXPIRED` et `WITHDRAWN` sont définitifs : on ouvre un nouveau dossier.

## Parcours du déclarant

1. `POST /api/v1/trust/verifications` : type, cible, rattachement revendiqué, déclaration facultative (texte court, raison sociale pour une agence ; aucun numéro de pièce demandé).
2. `POST .../:id/documents` : ouvre une session d'envoi Media privée. Le client envoie le fichier par l'URL présignée puis confirme avec `POST /api/v1/media/upload-sessions/:sessionId/complete`. Media contrôle signature, taille et contenu actif des PDF.
3. `POST .../:id/submit` avec `{ "attestation": true }` (déclaration sur l'honneur). Refus si une pièce est encore en cours d'envoi ou de contrôle, si un groupe obligatoire manque, ou si l'identité préalable n'est pas vérifiée.
4. Suivi : `GET .../:id` (statut, pièces, exigences restantes, historique avec motifs publics et messages du relecteur) et notifications in-app.
5. `DELETE .../:id/documents/:documentId` et `POST .../:id/withdraw` tant qu'aucune décision n'est prise.

Le dossier d'un autre utilisateur répond 404, quelle que soit la route.

## Instruction et décision

| Action                                               | Permission                                                                     | Rôles                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| File, détail                                         | `verification:read`                                                            | MODERATOR, TRUST_OFFICER, ADMIN |
| Télécharger une pièce (lien court, audité)           | `verification:read` + `verification:documents`                                 | MODERATOR, TRUST_OFFICER        |
| Prendre en charge, demander un complément, escalader | `verification:review`                                                          | MODERATOR, TRUST_OFFICER, ADMIN |
| Approuver                                            | `verification:approve` (+ `verification:documents` si le dossier a des pièces) | TRUST_OFFICER                   |
| Rejeter (motif obligatoire)                          | `verification:reject` (+ `verification:documents` si pièces)                   | TRUST_OFFICER                   |
| Révoquer (motif obligatoire)                         | `verification:revoke`                                                          | TRUST_OFFICER                   |
| Score interne                                        | `trust_score:read`                                                             | TRUST_OFFICER, ADMIN            |

`SUPER_ADMIN` passe toutes les permissions. `ADMIN` a les permissions de décision mais pas `verification:documents` : il ne peut ni voir les pièces ni décider d'un dossier qui en contient.

Indépendance, contrôlée à chaque action : personne ne relit son propre dossier (`SELF_REVIEW_FORBIDDEN`), ni un dossier ou un signalement lié à un bien qu'il gère, ni un signalement dont il est l'auteur ou la cible (`CONFLICT_OF_INTEREST`). Les décisions verrouillent la ligne et vérifient la transition : une décision rendue ne se modifie plus.

Motifs normalisés (`reason-codes.ts`) : seul leur libellé neutre est montré au déclarant, avec le message libre du relecteur. La note interne reste dans `verification_events.internal_note`, visible des relecteurs seulement.

## Précontrôles et règles de risque

À la soumission (`PrecheckService`), sans décision :

| Contrôle                                          | Alerte                     | Sévérité |
| ------------------------------------------------- | -------------------------- | -------- |
| Même fichier (SHA-256) envoyé par un autre compte | `DUPLICATE_DOCUMENT`       | HIGH     |
| Rattachement revendiqué absent du bien            | `RELATION_NOT_ESTABLISHED` | MEDIUM   |
| Autre propriétaire `SOLE` vérifié sur le bien     | `CONFLICTING_OWNERSHIP`    | HIGH     |
| Pièces non analysées par un antivirus             | aucune (fait consigné)     | —        |

Ailleurs :

- `REPORT_THRESHOLD` (MEDIUM) : au moins `TRUST_REPORT_REVIEW_THRESHOLD` déclarants **distincts** ont un signalement ouvert sur la même cible. Effet : priorité haute, rien d'autre.
- `PRICE_CHANGE_ANOMALY` (MEDIUM) : prix d'une annonce publiée modifié de plus de `TRUST_PRICE_CHANGE_ALERT_RATIO` (50 %).
- `REPORT_REVIEW_REQUESTED` (HIGH) : un modérateur demande le réexamen d'une vérification après un signalement confirmé. Aucune révocation automatique.

Une alerte HIGH à la soumission passe le dossier en priorité haute. Les alertes se consultent (`GET /admin/trust/signals`) et se confirment ou s'écartent (`POST .../signals/:id/review`) avec `verification:review` ou `report:review`, sans effet automatique. Les détails d'alerte ne contiennent que des identifiants publics et des compteurs.

Aucune règle n'utilise de caractéristique sensible, l'ancienneté du compte, ni les vues, clics ou favoris.

## Signalements

- Réservés aux comptes connectés (`report:create`), limités par IP (`TRUST_REPORT_RATE_LIMIT` par minute) et par compte (`TRUST_REPORT_DAILY_LIMIT` par 24 h).
- Cibles : une annonce visible (ni brouillon ni en attente de modération) ou un utilisateur. On ne signale ni soi-même ni une annonce dont on gère le bien.
- Un seul signalement ouvert par cible et par déclarant (`REPORT_ALREADY_OPEN`).
- Le déclarant voit l'avancement (`OPEN`, `IN_REVIEW`, `RESOLVED`), jamais l'issue détaillée ni la note du modérateur. Le texte libre reste dans le signalement, pas dans l'audit.
- Clôture (`report:review`) : `CONFIRMED` ou `DISMISSED`. Une mesure exige `CONFIRMED` :
  - `LISTING_SUSPENDED` passe par le workflow des annonces (`ListingService.changeStatus`, qui exige `listing:suspend` et historise le changement) ;
  - `VERIFICATION_REVIEW_REQUESTED` ouvre une alerte HIGH pour les agents de confiance.

## Badges publics

`GET /api/v1/trust/users/:userId/badges` et `GET /api/v1/trust/listings/:listingId/badges`, publics, mis en cache 5 minutes (invalidés à chaque décision, expiration ou changement de prix).

- Un badge n'existe que pour une vérification `VERIFIED` et non échue (téléphone et e-mail : date de vérification Identity).
- « Droit de publication vérifié » : propriété ou mandat vérifié **et** rattachement toujours courant de la personne concernée.
- « Annonce contrôlée » : invalidé si le prix courant est postérieur au contrôle.
- `verificationInProgress` indique seulement qu'un dossier du bien est à l'examen, sans badge.
- Chaque réponse porte `disclaimer` : ni certification juridique du titre, ni garantie sur le bien ou la transaction.
- Compte suspendu, banni ou inactif, annonce non publiée : 404.

## Score interne

`trust-v1`, jamais public, consultation auditée (`TRUST_SCORE_VIEWED`) et refusée sur soi-même.

| Facteur                       | Points |
| ----------------------------- | ------ |
| Téléphone vérifié             | 10     |
| E-mail vérifié                | 5      |
| Identité (ou agence) vérifiée | 35     |
| Droit de publication vérifié  | 25     |
| Documents d'un bien vérifiés  | 15     |
| Aucune décision défavorable   | 10     |
| Par signalement confirmé      | −15    |
| Par révocation                | −20    |

Borné à 0–100. Tant qu'aucune vérification instruite n'a été approuvée, le score est nul et `isComplete = false` : un nouveau compte n'est ni noté ni pénalisé. Chaque facteur est renvoyé (`factors`), pour qu'un modérateur comprenne le résultat. Aucune donnée de transaction n'existe encore (`transactionScore = 0`).

## Règle de publication

`LISTING_PUBLICATION_REQUIREMENTS` (vide par défaut) liste les vérifications exigées avant `PUBLISHED` ou `PENDING_REVIEW` : `IDENTITY` (identité valide de l'auteur de l'annonce) et `PUBLICATION_RIGHT` (propriété ou mandat valide sur le bien, rattachement courant). Sinon `VERIFICATION_REQUIRED` (422), avec la liste des manques. Contrôlé dans la transaction de changement de statut de Listing, quel que soit l'acteur (gestionnaire ou modérateur). Les annonces déjà publiées ne sont pas dépubliées quand la règle est activée.

## Notifications

In-app, en base (`notifications`) : `GET /api/v1/notifications`, `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`. Envoyées à la soumission, à la demande de complément, à l'approbation, au rejet, à la révocation, à l'expiration, à la réception et à la clôture d'un signalement, et à l'auteur d'une annonce suspendue. Le corps ne contient que le libellé du motif et le message du relecteur. Ces notifications relèvent de la catégorie `ACCOUNT` (Trust) ou `REPORT` : elles peuvent partir par e-mail ou SMS si un fournisseur est configuré et si les préférences l'autorisent, avec un texte générique (jamais de note interne ni de détail antifraude). Voir [messaging-and-notifications.md](./messaging-and-notifications.md).

Une conversation ou un message se signale par `POST /api/v1/conversations/:conversationId/report` (participant uniquement). Le relecteur voit un extrait limité aux messages proches du signalement, jamais la conversation entière ; une mesure `CONVERSATION_CLOSED` ferme la conversation par un message système.

## Audit et événements

Chaque action écrit `audit_logs` (`VERIFICATION_*`, `REPORT_*`, `TRUST_SIGNAL_REVIEWED`, `TRUST_SCORE_VIEWED`) dans la transaction : statut, motif, type de pièce, identifiants publics. Jamais le contenu d'une pièce, sa clé de stockage, la note interne ni le texte d'un signalement. Consultation du détail d'un dossier et de chaque pièce auditée.

`verification_events` et `report_events` refusent `UPDATE`, `DELETE` et `TRUNCATE` (triggers), sauf l'anonymisation d'un acteur supprimé.

Événements de domaine (`trust.*`) : création, soumission, décisions, signalements, alertes, et `trust.changed` qui déclenche le recalcul du score et l'invalidation du cache des badges.

## Maintenance

`TrustMaintenanceService`, dans le processus de l'API toutes les `TRUST_MAINTENANCE_INTERVAL_MINUTES` (0 : désactivé), ou à la demande :

```bash
pnpm --filter @mon-appart/api trust:maintenance
```

- Expiration : `VERIFIED` échues → `EXPIRED`, notification, audit (acteur système).
- Rétention : pièces des dossiers décidés depuis plus de `TRUST_DOCUMENT_RETENTION_DAYS` → `REMOVED`, puis suppression Media (la purge physique suit la rétention Media).

Traitement par lots, avec verrou de ligne et relecture de l'état : relançable sans effet double.

## Configuration

| Variable                               | Défaut | Rôle                                      |
| -------------------------------------- | ------ | ----------------------------------------- |
| `TRUST_IDENTITY_VALIDITY_DAYS`         | 730    | Validité d'une identité vérifiée          |
| `TRUST_PROPERTY_VALIDITY_DAYS`         | 365    | Propriété, mandat, documents du bien      |
| `TRUST_AGENCY_VALIDITY_DAYS`           | 365    | Agence                                    |
| `TRUST_LISTING_CHECK_VALIDITY_DAYS`    | 180    | Contrôle d'annonce                        |
| `TRUST_DOCUMENT_RETENTION_DAYS`        | 365    | Conservation des pièces après décision    |
| `TRUST_MAX_DOCUMENTS_PER_VERIFICATION` | 10     | Pièces par dossier                        |
| `TRUST_REPORT_REVIEW_THRESHOLD`        | 3      | Déclarants distincts avant priorité haute |
| `TRUST_PRICE_CHANGE_ALERT_RATIO`       | 0.5    | Variation de prix signalée                |
| `TRUST_REPORT_DAILY_LIMIT`             | 20     | Signalements par compte et par 24 h       |
| `TRUST_REPORT_RATE_LIMIT`              | 10     | Signalements par minute et par IP         |
| `TRUST_MUTATION_RATE_LIMIT`            | 30     | Actions Trust par minute et par IP        |
| `TRUST_MAINTENANCE_INTERVAL_MINUTES`   | 60     | Maintenance en processus (0 : désactivée) |
| `LISTING_PUBLICATION_REQUIREMENTS`     | vide   | `IDENTITY`, `PUBLICATION_RIGHT`           |

## Tests

- Unitaires (`trust-domain.spec.ts`, 29 cas) : transitions, exigences de pièces, échéances, badges, score, règles de risque, séparation des rôles et indépendance, règle de publication, contenu des notifications.
- Intégration (`test/trust/trust.db-spec.ts`, 34 cas, base `*_test`, stockage local) : parcours complet, refus d'auto-approbation et de conflit d'intérêts, cloisonnement (404), modérateur sans décision, administrateur sans pièces, notes internes jamais renvoyées, pièces hors galerie et hors de portée des co-gestionnaires, doublon de fichier, signalements (auto-signalement, doublon, seuil sans suspension, suspension confirmée), règle de publication, alertes de prix, score, révocation, expiration et rétention, historiques en ajout seul, notifications.

Toutes les pièces de test sont des PDF synthétiques générés à la volée : aucune pièce réelle, aucune donnée personnelle.

## Limites connues

- **Aucune analyse automatique d'authenticité** : pas d'OCR, pas de lecture de MRZ, pas de contrôle auprès d'un registre foncier ou d'un service d'identité. L'examen est entièrement humain.
- **Pas d'antivirus** : les pièces sont marquées `NOT_SCANNED`, ce que voit le relecteur.
- La comparaison de doublons ne détecte que des fichiers identiques à l'octet près (pas une photo refaite de la même pièce).
- Si la suppression Media échoue après le passage d'une pièce en `REMOVED`, l'objet reste jusqu'au nettoyage Media suivant (orphelins) ; aucune donnée n'est exposée entre-temps.
- Notifications externes génériques seulement (e-mail et SMS si configurés), sans accusé de réception des fournisseurs.
- Pas d'interface d'administration (`apps/admin`) pour la file : API seulement.
- Pas de procédure de contestation dédiée : le déclarant ouvre un nouveau dossier.
