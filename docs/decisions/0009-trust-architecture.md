# 0009 — Confiance et vérification

Date : 2026-10-12

## Contexte

Le schéma contenait déjà `verifications` (utilisée par Identity pour le téléphone et l'e-mail, avec un ancien champ de justificatif unique), `trust_scores` (jamais alimentée), `notifications` (sans API) et `audit_logs`. Media savait stocker des documents privés rattachés à un bien, lisibles par tous ses gestionnaires. Il n'existait ni rôle dédié à la décision, ni permission propre à la consultation des pièces.

Il fallait des vérifications traçables (identité, droit de publier, documents, agence, annonce), des signalements, des badges publics honnêtes et un score interne, sans promettre une garantie que l'examen ne peut pas établir, sans dupliquer de table ni de stockage, et sans exposer les pièces au-delà de leur auteur et des relecteurs.

## Décision

1. **Compléter `verifications`** plutôt que créer une seconde table : nouveaux types et statuts (brouillon, instruction, complément, révocation, retrait), cible annonce, rattachement revendiqué, déclaration minimale, précontrôles, priorité, affectation, dates de cycle de vie. Les vérifications de contact d'Identity y restent.
2. **Pièces dans Media**, référencées par `verification_documents` (aucune copie) : `purpose = VERIFICATION`, sans bien, privées, empreinte SHA-256. Lisibles par leur auteur et, via `MediaDocumentAccess`, par les relecteurs Trust seulement ; jamais dans une galerie ni par un co-gestionnaire du bien.
3. **Rôle `TRUST_OFFICER`** et permissions fines : `MODERATOR` instruit, `TRUST_OFFICER` décide et voit les pièces, la nouvelle permission `verification:documents` n'est pas accordée à `ADMIN`, qui ne peut donc pas décider sur pièces. Indépendance contrôlée côté service (ni soi-même, ni un bien auquel on est rattaché).
4. **Historiques en ajout seul** (`verification_events`, `report_events`) protégés par triggers contre `UPDATE`, `DELETE` et `TRUNCATE` ; motifs normalisés au libellé neutre pour le déclarant ; notes internes séparées. `audit_logs` reçoit les faits (statut, motif, type de pièce), jamais de contenu.
5. **Règles de risque déterministes** produisant des alertes dédupliquées (`trust_signals`) et des priorités, jamais une sanction. Aucune révocation ni suspension automatique ; une suspension d'annonce décidée sur signalement passe par le workflow Listing.
6. **Score interne explicable** (`trust-v1`) : uniquement des vérifications et des décisions humaines, chaque facteur exposé, nul tant qu'aucune vérification instruite n'a été approuvée (pas de pénalité pour un nouveau compte), jamais public.
7. **Badges publics factuels**, calculés à la lecture à partir des vérifications valides et des rattachements courants, mis en cache avec invalidation par génération, accompagnés d'un avertissement explicite.
8. **Règle de publication configurable** (`LISTING_PUBLICATION_REQUIREMENTS`, vide par défaut), évaluée dans la transaction de Listing via un point d'entrée Trust sans module Nest (`trust/publication.ts`) pour éviter un cycle de dépendances.
9. **Notifications in-app** via un module Communication minimal sur la table existante (identifiant public ajouté).
10. **Maintenance** (expiration, rétention des pièces) en processus et en CLI, idempotente.

## Conséquences

- Aucun contrôle automatique d'authenticité n'est prétendu : pas d'OCR, de MRZ, de registre foncier ni d'antivirus. L'examen est humain et les pièces non analysées sont signalées comme telles.
- `ADMIN` ne voit pas les pièces ; un `SUPER_ADMIN` le peut (il passe toutes les permissions). Le seed n'accorde que les associations manquantes : un retrait de droit sur une base existante passe par une migration de données explicite.
- Un dossier et son historique ne peuvent pas être supprimés (clés étrangères `RESTRICT`, triggers) : l'effacement de données personnelles d'un compte devra passer par une anonymisation dédiée.
- L'activation de la règle de publication ne dépublie pas les annonces existantes.
- Pas d'interface d'administration ni de canal e-mail ou SMS pour l'instant.
