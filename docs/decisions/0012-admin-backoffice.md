# 0012 — Back-office d'administration et de modération

Date : 2026-10-13

## Contexte

`apps/admin` n'était qu'un squelette et le module API `admin` était vide. Les règles métier existaient déjà ailleurs : comptes, rôles et permissions dans Identity (RBAC `ressource:action`, gardes globaux), machine à états des annonces dans Listing, dossiers, signalements et alertes dans Trust (avec leurs routes `/admin/trust`), notifications dans Communication, indicateurs dans Analytics. Les rôles `MODERATOR`, `TRUST_OFFICER`, `ADMIN` et `SUPER_ADMIN` étaient en place.

Il fallait un back-office sûr et traçable sans créer une seconde source de vérité ni une seconde machine à états, sans contourner les validations métier, et sans qu'un rôle de support puisse changer des rôles ou des identifiants.

## Décision

1. **Module d'orchestration.** `modules/admin` ne modifie aucune table métier directement : il appelle `AccountAdminService` (Identity) pour statuts, rôles et sessions, `ListingService.changeStatus` pour les annonces, `NotificationService` pour les avis. Il ne possède que `moderation_reasons` et `admin_notes`. Vérifications, signalements et alertes restent servis par Trust.
2. **RBAC existant réutilisé.** Codes `ressource:action` conservés ; ajout des permissions manquantes (`admin:access`, `user:pii`, `user:ban`, `user:reactivate`, `user:revoke_sessions`, `admin_note:create`, `role:read`, `role:manage`, `audit_log:read`, `settings:manage`) et des rôles `SUPPORT` et `ANALYST`, par le seed (ajout seul). `AdminAccessGuard` relit l'acteur en base à chaque requête au lieu de se fier aux rôles du JWT.
3. **Anti-escalade dans le domaine.** Pas d'action sur soi ; `ADMIN`/`SUPER_ADMIN` gérés par `SUPER_ADMIN` seul ; comptes de l'équipe gérés avec `role:manage` ; dernier `SUPER_ADMIN` actif protégé sous verrou consultatif PostgreSQL pris avant le verrou de ligne (évite l'interblocage et la double rétrogradation concurrente).
4. **Décisions d'annonce = transitions Listing.** Chaque décision est une transition déjà autorisée au modérateur par `transitionActors`, appliquée avec `expectedStatus` (verrou optimiste) ; historique, note, audit et notification dans la même transaction via un rappel transactionnel.
5. **Motifs en table** (`moderation_reasons`), modifiables avec `settings:manage`, code et type immuables, désactivation plutôt que suppression, message destiné à l'annonceur séparé de la note interne.
6. **Notes internes en ajout seul** (`admin_notes`, trigger contre `UPDATE`), jamais exposées au titulaire.
7. **Frontend derrière un relais même origine.** Next.js réécrit `/api/*` vers l'API : réutilisation des cookies HttpOnly et du CSRF existants, jeton d'accès en mémoire seulement, aucun stockage local, pas de CORS à ouvrir.
8. **Périmètre restreint.** Pas d'export de masse, pas de levée automatique de suspension, pas de paramètres système ni de secrets dans l'interface.

## Conséquences

- Une seule vérité par domaine ; une règle métier modifiée dans Listing ou Identity s'applique aussi au back-office. Un test vérifie que les décisions de modération restent des transitions autorisées.
- Une relecture en base par requête d'administration : coût négligeable au volume d'un back-office, révocation immédiate des droits.
- Derrière le relais Next, `TRUST_PROXY` doit être réglé pour que les limites par IP et l'audit voient l'IP du client.
- En local, le cookie de session est partagé entre le site et le back-office (même hôte `localhost`) ; en production, sous-domaines distincts.
- Restent à faire : réauthentification récente et MFA du personnel avant les actions sensibles, anonymisation compatible avec les tables en ajout seul avant toute purge physique de compte.
