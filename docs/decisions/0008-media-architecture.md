# 0008 — Gestion des médias

Date : 2026-10-09

## Contexte

Le schéma initial prévoyait une table `media` (clé de stockage, type, taille, statut) et un enum `StorageProvider`, mais aucun module ne l'alimentait. Les lecteurs Property, Listing et Search exposaient déjà une couverture `READY` sans notion de visibilité. Il fallait :

- des photos de biens rapides à afficher sur mobile, sans métadonnées privées (GPS) ;
- des vidéos courtes, sans infrastructure de transcodage ;
- des documents (titres fonciers, pièces) strictement privés, consultables par la modération Trust ;
- aucun binaire dans PostgreSQL, aucun secret côté navigateur, aucune dépendance obligatoire à un service cloud pour développer ou tester.

## Décision

1. **Réutiliser `media`**, enrichie par migration additive (`visibility`, auteur, échéances, file, purge, `metadata`), plus `media_variants` pour les fichiers dérivés. Pas de seconde table média. Contraintes : document toujours privé, média privé sans URL, purge seulement après suppression.
2. **Envoi direct présigné** vers le stockage, avec une clé générée par le serveur, une taille exacte et `If-None-Match: *`. La confirmation relit l'objet réel (taille, signature binaire) : le client n'est jamais cru sur parole.
3. **Abstraction `ObjectStorage`** : S3 et R2 (même client AWS SDK v3), et stockage local signé par HMAC pour le développement et les tests, refusé en staging et en production.
4. **Deux buckets** : privé pour les originaux, documents et quarantaine ; public (CDN) pour les seules variantes traitées des médias publics. Sans bucket public : URL présignées courtes, jamais stockées.
5. **File durable en base** (`next_attempt_at`, `processing_attempts`), prise par `SKIP LOCKED` avec bail, servie par un worker dans le processus de l'API. Pas de Redis requis ; remplaçable par un worker BullMQ dédié sans changer le modèle.
6. **Sharp** pour les photos : orientation appliquée, métadonnées supprimées, variantes WebP 320/640/1280/1920 sans agrandissement, limite de pixels.
7. **Vidéo légère** : lecture de la boîte `moov` (durée, codecs, position) sans FFmpeg ; une vidéo géolocalisée est refusée. Interface `VideoProcessor` pour un transcodage futur hors requête HTTP.
8. **Documents dans Media**, exposés au futur module Trust par l'interface `MediaDocumentAccess` (description, lien de revue audité). Une référence de vérification bloque la purge.
9. **Intégration par événement** `property.media_changed` : Search resynchronise les annonces du bien concerné, Recommendation invalide son cache. Pas de réindexation globale.

## Conséquences

- Coût : pas de proxy de fichiers dans l'API, CDN pour les images publiques, originaux privés non servis.
- Sans bucket public, les couvertures du catalogue sont nulles (URL présignées seulement dans les vues de médias).
- Antivirus et transcodage restent à brancher (`DocumentScanner`, `VideoProcessor`).
- Le travail a révélé que `@OnEvent([...])` d'EventEmitter2 (sans wildcard) n'enregistrait qu'un nom composite : les listeners Search et Recommendation ne se déclenchaient pas. Corrigé par `OnEvents`, qui enregistre un listener par événement, et couvert par un test.
