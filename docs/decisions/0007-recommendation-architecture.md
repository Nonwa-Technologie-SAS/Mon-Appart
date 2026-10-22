# 0007 — Moteur de recommandation

Date : 2026-10-09

## Contexte

Le schéma prévoyait les tables de recommandation (`user_preferences` et ses tables `user_preferred_*`, `user_behavior_profiles`, `recommendations`), mais aucun module ne les utilisait. Il fallait des recommandations utiles dès maintenant :

- page d'accueil personnalisée et annonces similaires ;
- moteur fiable, explicable et testable ;
- fonctionnement sur PostgreSQL seul, sans dépendre d'un service ML qui n'existe pas encore ;
- respect strict du budget déclaré et de la confidentialité.

Le schéma existant présentait trois limites :

- `recommendations` visait un bien et non une annonce, sans identifiant public ni rang ;
- aucune table ne recevait les retours de l'utilisateur ;
- `user_preferences` ne savait pas exprimer la période ni la tolérance du budget, la taille ou un point de référence.

Les signaux d'activité existent déjà (`favorites`, `property_views`, `inquiries`, `appointments`, `searches`, `user_events`), sans API de collecte dédiée.

## Décision

1. **Module `recommendation` séparé**, consommateur de Search, Property et Identity. Il ne réimplémente pas la visibilité : `publicConditions()` est extrait de la requête de recherche et partagé, et l'hydratation des cartes passe par `SearchHydrator`, qui revérifie la visibilité et masque la position.
2. **Moteur à règles déterministe** (`RuleBasedRecommendationEngine`, version `rules-v1`). Le score est une moyenne pondérée sur les seules dimensions disponibles : budget, lieu, type, taille, équipements, comportement, qualité. Les poids sont configurables (`RECOMMENDATION_WEIGHTS`, somme 100, validés au démarrage). Chaque recommandation porte au plus 3 raisons codées, avec des libellés français partagés (`@mon-appart/types`). Les scores par dimension sont persistés mais jamais exposés.
3. **Budget inviolable.**
   - Il est stocké tel que saisi ; une période absente est déduite à la lecture, ou exigée si elle est ambiguë (`BUDGET_PERIOD_REQUIRED`).
   - Le maximum est strict, sauf tolérance explicite de 0 à 30 %.
   - Aucune conversion de devise ni de période : un budget inapplicable au type d'offre demandé est ignoré.
4. **Pool de candidats borné en une requête SQL** (`ListingCandidateSource`, dans le module Search).
   - Filtres stricts de la requête et du budget, exclusions de l'utilisateur, aucun bien publié par lui-même.
   - Pré-classement par fraîcheur, qualité et proximité des lieux préférés ; les équipements et la popularité sont joints sans N+1.
   - Le classement fin et la diversification se font ensuite en mémoire sur ce pool (`RECOMMENDATION_CANDIDATE_POOL`).
5. **Comportement lu dans les tables existantes**, sans nouvelle API de collecte.
   - Les poids dépendent de l'engagement. Une décroissance exponentielle s'applique sur une fenêtre glissante.
   - Les consultations brèves sont ignorées, les répétitions plafonnées, les événements futurs rejetés et l'activité sur ses propres biens écartée.
   - Le profil (`user_behavior_profiles`, `behavior-v1`) est recalculé paresseusement, à la lecture, s'il est absent, trop ancien ou marqué après un retour.
6. **Diversification MMR** :
   - dédoublonnage par bien ;
   - quasi-doublons du même publieur pénalisés ;
   - plafond par publieur (les annonces en excès passent en fin de liste) ;
   - compromis pertinence/diversité configurable.

   Elle n'enlève jamais une annonce pour un autre motif : elle ne peut pas violer un filtre strict.

7. **Interface `RecommendationEngine`** et `RecommendationRanker` avec repli.
   - Le client `RemoteRecommendationEngine` (`POST /v1/rank` vers `services/recommendation`) ne reçoit aucune identité. Il est soumis à un délai court et à une validation stricte du contrat : l'annonce doit appartenir au pool et le score être dans [0, 1].
   - Toute erreur bascule sur les règles (`meta.degraded`, métrique `recommendation_fallback_total`).
   - Par défaut, `RECOMMENDATION_ENGINE=rules`.
8. **Persistance des pages servies** pour les comptes connectés.
   - Écriture par un seul upsert par page. L'identifiant public (UUID) sert aux retours ; leur propriété est vérifiée en base (404 sinon).
   - Les retours sont idempotents (un par type et par recommandation). Les retours négatifs excluent l'annonce.
   - Les visiteurs reçoivent une liste générique, non persistée.
9. **Cache Redis de la liste classée complète**, paginée ensuite par curseur.
   - La clé est propre à l'utilisateur (identifiant public) ou `guest`, avec l'empreinte des filtres et la version d'algorithme.
   - L'invalidation se fait par compteurs : une génération globale incrémentée par les événements `listing.*` et `property.*` (anti-rebond 1 s), et une version par utilisateur pour les préférences et les retours.
   - Le curseur porte la date de calcul, ce qui stabilise le classement d'une page à l'autre.
10. **Traitements asynchrones dans le processus** : EventEmitter, anti-rebond et recalcul paresseux. Aucun job planifié n'est requis pour fonctionner. BullMQ viendra avec le worker.

Migration `20261009200000_recommendation` :

- `recommendations` passe à l'annonce : `listing_id` avec clé étrangère composite vers `listings(id, property_id)`, `public_id`, `context`, `rank`, nouvelle unicité ;
- table `recommendation_feedback` ;
- colonnes et CHECK nommés sur `user_preferences`.

Elle s'interrompt si `recommendations` contient déjà des lignes, au lieu de supprimer ou de deviner des données.

## Alternatives écartées

- **ML dès maintenant (filtrage collaboratif, embeddings)** : pas assez d'historique, résultats non explicables, dépendance à un service inexistant.
- **Score calculé entièrement en SQL** : règles difficiles à tester et à expliquer, et diversification impossible.
- **Recalcul planifié de toutes les recommandations** : coûteux et majoritairement inutile (la plupart des utilisateurs ne reviennent pas avant l'expiration) ; la fraîcheur du catalogue serait moins bonne.
- **Nouvelle API d'interactions** : les tables existantes suffisent. Une API de collecte sera ajoutée quand le front l'exigera.
- **Conversion automatique du budget** (mensuel ↔ total, devises) : elle modifierait silencieusement l'intention de l'utilisateur.
- **Cache par requête HTTP** : une clé partagée risquerait de servir une réponse personnalisée à un autre utilisateur.

## Conséquences

- Les recommandations restent cohérentes avec la recherche, puisque les règles de visibilité sont communes. Une modification de ces règles s'applique aux deux modules.
- Le score dépend de l'instant de calcul (fraîcheur). Les tests figent cet instant ou comparent des ordres relatifs.
- L'anti-rebond vit dans le processus : avec plusieurs instances, chacune incrémente la génération partagée dans Redis, et une invalidation en attente est perdue si l'instance s'arrête. L'outbox et BullMQ corrigeront ce point.
- Le worker devra prendre en charge la purge des recommandations expirées (`expires_at`) et un éventuel rafraîchissement des profils inactifs.
- Le contrat `POST /v1/rank` est versionné (`remote-v1`). Un modèle ML pourra être introduit derrière `RECOMMENDATION_ENGINE=remote` sans changer l'API publique.
