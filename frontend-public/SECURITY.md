# Politique de sécurité — KPI Tracker

## Versions supportées

| Version | Supportée |
| ------- | --------- |
| `0.1.x` | Oui |
| &lt; `0.1.0` | Non |

Prérequis runtime : **Node.js ≥ 20.9.0**.

## Signalement d’une vulnérabilité

Si vous découvrez une faille de sécurité :

1. **Ne l’ouvrez pas en issue publique** (ni PR détaillant l’exploit).
2. Contactez les mainteneurs du dépôt **en privé** (message direct aux owners GitHub, ou canal interne Appatam / équipe produit).
3. Incluez : description, impact, étapes de reproduction, environnement (navigateur, rôle utilisateur).

Réponse attendue sous **5 jours ouvrés**. Un correctif ou un plan d’atténuation sera communiqué avant toute divulgation publique.

## Contrôles déjà en place

### Authentification et session

- Session basée sur des cookies **HttpOnly**, **SameSite=Lax** (`auth_session`, `auth_role`, `must_change_password`, `mfa_pending`).
- Cookie `Secure` en production (`NODE_ENV=production`) ou via `COOKIE_SECURE=1`.
- Durée de session : **7 jours** ; cookie MFA en attente : **5 minutes**.
- Mots de passe hashés avec **bcrypt** (10 rounds).
- Obligation de changement de mot de passe au premier login (`mustChangePassword`) : le middleware / API bloquent l’usage normal jusqu’à `/reset-password`.
- Comptes mis à la corbeille (`deletedAt`) exclus de la connexion.

### MFA (double authentification)

- TOTP via **speakeasy** + QR code.
- Activation / désactivation depuis le profil (`/api/profile/mfa/*`).
- À la connexion, si MFA activé : cookie `mfa_pending` puis validation du code avant pose de la session (`/api/auth/mfa/verify-login`).

### Autorisation (RBAC)

- Middleware sur les pages : redirection vers `/login` si non authentifié ; pages `/users`, `/settings`, `/products-services`, `/corbeille` réservées admin / DG / rôles groupe.
- **Chaque route API sensible** doit appeler `getCurrentUser()` / `requireRole()` : le middleware **n’authentifie pas** `/api/*` à lui seul.
- Isolation multi-tenant par `companyId` ; rôles groupe (directrice commerciale, PDG, directrice opération) via `resolveGroupCompanyScope` / filtre `?companyId=`.
- Réponses **401** (non authentifié) et **403** (`Accès refusé`) en cas de droits insuffisants.

### Données et corbeille

- Soft delete (`deletedAt`) sur prospects, utilisateurs, objectifs, pièces jointes.
- Page corbeille et purge / restauration réservées aux managers, admins et rôles groupe.

### Validation et contenu

- Entrées API validées avec **Zod** (auth, leads, users, goals, activités, emails, etc.).
- Corps HTML des emails nettoyé avec **sanitize-html** avant envoi (balises et schémas d’URL limités).

### Uploads

- Pièces jointes leads et pièces email : taille max (~10 Mo), types MIME filtrés, noms assainis.
- Signature email profil : PNG/JPEG, taille et dimensions limitées, auth obligatoire.

### Audit

- Journal `UserActionLog` sur les **mutations** et événements d’auth (login, logout, MFA, CRUD métier, imports/exports, corbeille, envoi d’emails) — pas sur les GET.

### Secrets

- Ne jamais committer `.env` / `.env.local` (`DATABASE_URL`, identifiants SMTP, etc.).
- `/api/health` n’expose que l’état « base configurée », pas les secrets.

## Recommandations pour les déploiements

- Forcer HTTPS et cookies `Secure` en production.
- Restreindre l’accès à PostgreSQL et aux dossiers `uploads`.
- Limiter les comptes `ADMIN` ; activer la MFA pour les comptes sensibles.
- Garder Node, dépendances et migrations Prisma à jour (`npm audit`, `prisma migrate deploy`).

## Limites connues (transparence)

Ces points sont assumés en `0.1.x` et peuvent évoluer :

- Pas de **rate limiting** sur login / MFA.
- Pas de token **CSRF** applicatif (mitigation principale : cookies `SameSite=Lax` + HttpOnly).
- La session stocke l’identifiant utilisateur dans le cookie (pas de JWT signé).
- Le « mot de passe oublié » côté UI n’est pas encore couvert par un flux API de reset complet.

Merci de signaler toute divergence entre ce document et le comportement observé en production.
