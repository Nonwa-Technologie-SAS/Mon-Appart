# Sécurité

## En place

- Helmet (`Cross-Origin-Resource-Policy: same-site`)
- CORS limité à `CORS_ORIGINS`, `WEB_APP_URL` et `ADMIN_APP_URL` (liste explicite, `*` ignoré, credentials autorisés)
- Rate limiting global, et limites par palier sur l'authentification
- Validation et rejet des champs inconnus
- Journaux structurés avec masquage des mots de passe, jetons, codes OTP, cookies et secrets
- `X-Request-ID` borné à un jeu de caractères sûr (pas de retour ligne dans l'en-tête)
- Hash de mot de passe Argon2id (`@node-rs/argon2`, réglable, défauts 19 MiB, 2 itérations, parallélisme 1)
- Authentification complète : access JWT 15 min, refresh token rotatif haché avec détection de réutilisation, OTP hachés, réinitialisation par jeton haché ([identity.md](./identity.md))
- Toutes les routes authentifiées par défaut ; `@Public()`, `@Roles()`, `@Permissions()` appliqués par des gardes globaux
- Cookie HttpOnly + CSRF double soumission pour le web, Bearer pour le mobile
- Audit persistant des opérations d'identité, des biens et des annonces (`audit_logs`, append-only)
- Biens et annonces : propriétaire déduit du jeton, jamais de la requête ; relation au bien relue en base ; 404 pour une ressource non publique d'un tiers ; dérogation admin tracée (`adminOverride`) ; adresse et coordonnées exactes masquées selon `locationVisibility` ([property-listing.md](./property-listing.md))
- Prix modifiés sous verrou de ligne, historique jamais écrasé
- Recherche publique ([search.md](./search.md)) : paramètres validés en objet valeur, SQL uniquement en paramètres liés (jamais `$queryRawUnsafe`), texte réduit à des mots `[a-z0-9]` avant `to_tsquery` ou OpenSearch, aucun DSL accepté du client ; statut non filtrable (champ refusé), visibilité relue en base pour chaque résultat ; position publiée seulement (arrondie ou masquée, y compris pour le rayon et la distance) ; curseur lié aux filtres et validé strictement ; limites de débit dédiées ; erreurs OpenSearch jamais renvoyées au client
- Recommandations ([recommendation.md](./recommendation.md)) :
  - utilisateur, préférences et exclusions déduits du jeton, jamais de la requête ; préférences et retours authentifiés ;
  - retour sur la recommandation d'un autre utilisateur : 404 ;
  - listes personnalisées mises en cache sous une clé propre à l'utilisateur ;
  - réponses sans identifiant interne ni détail du score ;
  - aucune caractéristique sensible déduite du comportement ;
  - aucun recalcul global déclenchable par l'API ; limites de débit dédiées ;
  - le service ML éventuel ne reçoit aucune identité.
- Confiance et vérification ([trust-and-verification.md](./trust-and-verification.md)) :
  - décisions réservées aux routes de relecture ; aucune route du déclarant ni aucun traitement automatique n'approuve, ne rejette ou ne révoque ;
  - séparation instruire (`MODERATOR`) / décider (`TRUST_OFFICER`) ; `ADMIN` sans `verification:documents`, donc sans accès aux pièces ni décision sur pièces ;
  - ni auto-relecture, ni relecture d'un bien auquel on est rattaché, ni traitement d'un signalement dont on est l'auteur ou la cible ;
  - dossier ou signalement d'autrui : 404 ;
  - notes internes, précontrôles, alertes et identité des relecteurs jamais renvoyés au déclarant, à la cible ni dans les notifications ;
  - historiques `verification_events` et `report_events` en ajout seul (triggers contre `UPDATE`, `DELETE`, `TRUNCATE`) ;
  - audit sans contenu de pièce, clé de stockage, note interne ni texte de signalement ;
  - signalements authentifiés, limités par IP et par compte, un seul ouvert par cible et par personne ; aucune sanction automatique ;
  - badges factuels avec avertissement, jamais de « garantie » ; score interne jamais public, consultation auditée.
- Messagerie et notifications ([messaging-and-notifications.md](./messaging-and-notifications.md)) :
  - accès à une conversation recalculé à chaque requête (demandeur ou gestionnaire actuel du bien), 404 sinon ; l'identifiant d'une conversation n'est jamais une preuve d'autorisation ;
  - expéditeur, type de message et destinataires déduits du serveur ; messages système non falsifiables (CHECK et trigger d'immutabilité) ;
  - aucun accès administrateur global aux conversations : extrait limité au signalement, fermeture tracée ;
  - anti-spam compté en base, refus du seul message en cause, jamais de blocage automatique ;
  - e-mails, SMS et push sans contenu de message, note de visite, document ni jeton ; envoi vers des contacts vérifiés seulement ; canal non configuré jamais planifié ni simulé ;
  - aucun appel fournisseur dans les contrôleurs (file en base) ; réponse complète des fournisseurs jamais conservée ;
  - temps réel authentifié par l'access token, révocation revérifiée, salle personnelle uniquement, événements entrants validés et limités ;
  - jetons push jamais renvoyés, journalisés ni audités ; pièces jointes privées, lien signé court réservé aux participants.
- Analytics ([analytics-and-tracking.md](./analytics-and-tracking.md)) :
  - catalogue fermé : propriétés typées, clés sensibles refusées (mot de passe, token, OTP, e-mail, téléphone, message, adresse, coordonnées, URL, IP…), routes normalisées, 4 Ko au plus ; ni contenu de message, ni texte de recherche, ni élément de vérification ;
  - navigation conservée seulement avec consentement (version de politique vérifiée, retrait avec effacement, changements audités) ; identifiant anonyme aléatoire, jamais rapproché du compte, pas de fingerprinting ;
  - faits métier produits par le backend après l'action ; un client ne peut pas les déclarer ;
  - statistiques des gestionnaires limitées à leurs annonces (404 sinon), sur agrégats seulement, sans identité ni comportement de visiteur ; petits groupes fusionnés dans les vues d'administration ;
  - collecte limitée par IP, lots bornés, idempotente ; une panne d'Analytics ne bloque aucune action.
- Back-office ([admin-backoffice-moderation.md](./admin-backoffice-moderation.md)) :
  - `admin:access` et permission de la route relus en base à chaque requête (`AdminAccessGuard`) : rôle retiré ou compte bloqué, accès coupé à la requête suivante ; l'interface ne fait que refléter les droits ;
  - pas d'action sur soi, `ADMIN`/`SUPER_ADMIN` gérés par `SUPER_ADMIN` seul, comptes de l'équipe gérés avec `role:manage`, dernier `SUPER_ADMIN` actif protégé sous verrou consultatif ; changements de rôle audités, retrait de rôle et sanction révoquent les sessions ;
  - support sans changement de rôle, de statut ni d'identifiant de connexion ;
  - coordonnées masquées sauf `user:pii`, chaque consultation auditée et limitée en débit ;
  - décisions motivées, verrou optimiste (`expectedStatus`, 409), passage par la machine à états Listing et par Identity, jamais d'écriture directe ;
  - notes internes en ajout seul, jamais notifiées ; journal d'audit expurgé à la lecture ; aucun export de masse ;
  - frontend même origine (relais Next) : refresh token en cookie HttpOnly, CSRF double soumission, jeton d'accès en mémoire seulement, `X-Frame-Options: DENY`, `no-store`.
- Facturation ([billing-payments-monetization.md](./billing-payments-monetization.md)) :
  - paiement réputé réussi seulement sur webhook signé (HMAC sur corps brut, horodatage, comparaison à temps constant) ou interrogation du prestataire, jamais sur redirection du navigateur ;
  - montants fixés par le serveur, commande figée par trigger, idempotence et concurrence garanties par contraintes uniques et verrous ;
  - simulateur refusé au démarrage en staging, production et `live` ; secret du simulateur jamais exposé ; en-têtes de signature expurgés des logs ;
  - aucune donnée de carte, CVV ni code d'authentification de paiement ; seule l'empreinte SHA-256 des notifications est conservée ;
  - remboursement décidé par une autre personne que le demandeur, effectif seulement après confirmation du prestataire ; aucune action « marquer payé » ; tables financières sans suppression.
- Secrets uniquement via l'environnement

## Ajouts récents (durcissement)

- `GET /metrics` protégé par `METRICS_SCRAPE_TOKEN` (Bearer) dès que `METRICS_ENABLED=true`
- Purge des artefacts Identity : CLI `pnpm --filter @mon-appart/api identity:purge-artifacts` et option `IDENTITY_RETENTION_*`
- Signal antifraude `ACCOUNT_BURST_ACTIVITY` (pic de création d'annonces → revue Trust)
- Headers navigateur (CSP, nosniff, frame deny, HSTS en prod) sur `apps/web` et renforcement admin
- `trustedOrigins` better-auth : localhost uniquement hors production
- Module d'ancrage `apps/api/src/modules/security/` + docs [security-architecture.md](./security-architecture.md), [anti-fraud.md](./anti-fraud.md), [data-protection.md](./data-protection.md), [security-incident-response.md](./security-incident-response.md), [security-hardening-checklist.md](./security-hardening-checklist.md)

## Pas encore en place

- Prestataire de paiement réel (compte marchand, secrets de production, tests sandbox, revue contractuelle) et validation fiscale des reçus

- Rotation des clés JWT et HMAC sans coupure
- MFA, Google, Apple (feuille de route seulement — **non activés**)
- Codes OTP par e-mail et SMS réels : les fournisseurs SMTP et SMS des notifications ne servent pas encore Identity ; en staging et production, aucun code n'est envoyé (avertissement au démarrage)
- Accusés de réception des fournisseurs (webhooks signés), push FCM et WhatsApp Business
- Antivirus des documents (`DocumentScanner` sans implémentation réelle : `NOT_SCANNED`) et purge CDN après suppression d'un média

- Contrôle automatique d'authenticité des pièces (OCR, MRZ, registre foncier) : l'examen est humain
- Validation juridique (ARTCI) de l'intérêt légitime pour les événements métier pseudonymisés, et bandeau de consentement sur les frontends (client de suivi non branché)

- Réauthentification récente et MFA du personnel avant les actions sensibles du back-office

Rôles : `CUSTOMER`, `OWNER`, `AGENT`, `AGENCY`, `MODERATOR`, `TRUST_OFFICER`, `SUPPORT`, `ANALYST`, `ADMIN`, `SUPER_ADMIN`. `SUPER_ADMIN` passe les gardes de rôle et de permission.

## Derrière un proxy

`TRUST_PROXY` doit refléter le nombre de proxys de confiance. Vide sans proxy : sinon `X-Forwarded-For` serait falsifiable et contournerait les limites par IP.

Le back-office relaie `/api/*` par son serveur Next : l'API voit alors l'IP de ce serveur. Régler `TRUST_PROXY` en conséquence (par exemple `loopback` si Next et l'API partagent la machine), sans quoi toutes les requêtes du back-office partagent une même limite par IP et l'audit enregistre l'IP du relais.

## Journaux

Un log peut contenir l'horodatage, le niveau, le service, `request_id`, `user_id` si un utilisateur est déjà attaché à la requête, la route, le statut et la durée (pino-http). Il ne contient pas le mot de passe, le JWT, le refresh token, ni le secret.

Les URL `postgresql://` et `redis://` sont retirées des messages d'erreur renvoyés aux logs de santé, ainsi que les identifiants d'une URL HTTP (`https://user:pass@…`, nœud OpenSearch).

Les logs de recherche contiennent le texte normalisé (tronqué à 120 caractères) mais seulement les noms des filtres : ni coordonnées, ni prix, ni identifiants internes. L'événement `search.performed` ne contient pas le texte.

Les logs de recommandation ne contiennent ni identifiant d'utilisateur, ni préférence, ni lieu : contexte, niveau, algorithme, statut du cache, latence et nombre de résultats seulement.

Les logs d'Analytics contiennent le nom de l'événement, des compteurs et un message d'erreur court : jamais les propriétés d'un événement ni un identifiant de visiteur. Les métriques Prometheus n'ont que des labels de faible cardinalité (source, issue, motif, tâche).

Les logs de messagerie et de notification contiennent des identifiants publics, le canal et un code d'erreur court : jamais le corps d'un message, une adresse e-mail, un numéro de téléphone, un jeton push ni une URL signée.

## Fichiers

Détails dans [media-management.md](./media-management.md). Les images, vidéos et documents sont dans un stockage S3 compatible (R2 ou AWS), ou sur disque en développement. PostgreSQL ne stocke que les métadonnées.

- Envoi direct par URL présignée, limitée en durée, clé, type et taille exacte, sans écrasement possible (`If-None-Match: *`). La clé est toujours générée par le serveur.
- Type et taille déclarés revérifiés sur l'objet stocké (signature binaire), puis au décodage. Liste fermée de formats.
- Photos réencodées : EXIF, GPS et XMP supprimés ; décodage limité en pixels. Vidéos géolocalisées refusées. PDF à contenu actif refusés.
- Bucket privé pour les originaux et documents ; bucket public réservé aux variantes traitées des médias publics. Un document n'est jamais public : lien présigné court, réservé au gestionnaire du bien ou à `verification:read`, chaque accès audité. Une pièce de vérification n'a pas de bien : seul son auteur et les relecteurs Trust (`verification:documents`) y accèdent, jamais les co-gestionnaires.
- Ni identifiants du fournisseur, ni clé de stockage, ni chemin interne renvoyés au client. URL signées masquées dans les logs et messages d'erreur.
- Purge seulement après rétention, et jamais d'un justificatif cité par une vérification ; détection d'orphelins en simulation par défaut.

## Swagger

Désactivé en staging et en production, sauf activation explicite.
