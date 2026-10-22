# Gestion des médias

Module `apps/api/src/modules/media`. Décision d'architecture : [ADR 0008](decisions/0008-media-architecture.md).

Photos, photos 360°, vidéos et documents des biens. **PostgreSQL ne contient que des métadonnées** (table `media` existante, enrichie, et `media_variants`). Les fichiers vivent dans un stockage objet : Cloudflare R2 ou Amazon S3, ou le disque local en développement et en test.

## Architecture

```text
Navigateur / mobile                    API (NestJS)                          Stockage objet
───────────────────                    ────────────                          ──────────────
1. POST /media/upload-sessions ───────► contrôle déclaration + droits
                                        ligne media PENDING_UPLOAD
                               ◄─────── URL PUT présignée (clé serveur)
2. PUT <url> (fichier) ──────────────────────────────────────────────────────► bucket privé o/ ou q/
3. POST .../complete ─────────────────► HEAD + lecture des 4 premiers Ko ◄──── objet réel
                                        taille exacte, signature binaire
                                        → UPLOADED (file de traitement)
                                        Worker (même processus) :
                                          SKIP LOCKED, bail, essais bornés
                                          Sharp / inspection vidéo / PDF
                                          variantes ─────────────────────────► bucket public v/ (CDN)
                                          → READY + property.media_changed
                                            → Search : annonces du bien seulement
```

| Couche         | Fichiers                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domaine (pur)  | `media-policy.ts`, `file-signature.ts`, `storage-keys.ts`, `media-status.ts`, `video-inspection.ts`, `pdf-inspection.ts`, `media-errors.ts`, `media-events.ts`                            |
| Application    | `upload.service.ts`, `media-processing.service.ts`, `media-job-runner.ts`, `media-cleanup.service.ts`, `property-media.service.ts`, `media-access.service.ts`, `media-document-access.ts` |
| Infrastructure | `storage/*` (S3/R2, local), `processing/*` (Sharp, vidéo, antivirus), `media.repository.ts`                                                                                               |
| Présentation   | `media-upload.controller.ts`, `property-media.controller.ts`, `local-storage.controller.ts` (hors Swagger), `dto/*`                                                                       |
| Exploitation   | `cli/media-cli.ts`                                                                                                                                                                        |

Réutilisé, non dupliqué : la table `media` et l'enum `StorageProvider` du schéma initial ; la configuration `S3_*` ; la politique d'accès des biens (`PropertyAccessService`) ; l'audit et les événements (`ActivityRecorder`) ; les lecteurs Property, Listing et Search, qui filtrent désormais avec `PUBLIC_MEDIA` et `COVER_MEDIA`.

## Types acceptés

Liste fermée, contrôlée trois fois : déclaration du client, signature binaire à la confirmation, décodage au traitement.

| Type        | Formats                    | Taille max (défaut) | Traitement                                                      |
| ----------- | -------------------------- | ------------------- | --------------------------------------------------------------- |
| `IMAGE`     | JPEG, PNG, WebP, AVIF      | 15 Mo, 50 Mpx       | 4 variantes WebP                                                |
| `IMAGE_360` | JPEG équirectangulaire 2:1 | 15 Mo, 50 Mpx       | 4 variantes WebP 2:1 (640 à 4096 px)                            |
| `VIDEO`     | MP4, MOV, WebM             | 200 Mo, 180 s       | Contrôle léger, copie de lecture                                |
| `DOCUMENT`  | PDF, JPEG, PNG             | 20 Mo               | Toujours privé, contrôle du contenu actif, antivirus branchable |

Refusés : HEIC, SVG, GIF, TIFF, tout autre type, une extension qui ne correspond pas au type MIME (`photo.php`, `a.png.exe`), une image animée, un fichier vide.

## Flux d'envoi

1. **`POST /api/v1/media/upload-sessions`** `{ propertyId, type, mimeType, size, filename?, visibility? }`
   - L'utilisateur doit gérer le bien (propriétaire, mandat, ou dérogation admin tracée). Le bien ne doit être ni archivé ni supprimé.
   - Limites : `MEDIA_MAX_PER_PROPERTY` médias par bien, `MEDIA_MAX_PENDING_UPLOADS` sessions ouvertes par utilisateur.
   - La clé est générée par le serveur : `o/{mediaId}/{32 hex}.{ext}` pour un original, `q/...` pour un document (quarantaine). Elle n'est jamais renvoyée au client.
   - La réponse contient `upload { url, method: "PUT", headers, contentLength, expiresAt }`. Le client doit envoyer exactement ces en-têtes et exactement `contentLength` octets.
2. **`PUT <upload.url>`**, directement vers le stockage. L'URL est signée pour une clé, un type, une taille et une durée (`MEDIA_UPLOAD_URL_TTL_SECONDS`). L'en-tête `If-None-Match: *` interdit l'écrasement : une URL ne sert qu'une fois.
3. **`POST /api/v1/media/upload-sessions/:sessionId/complete`**, idempotent.
   - Le serveur relit l'objet réel. Objet absent → 409 `UPLOAD_NOT_RECEIVED`, session toujours ouverte. Taille différente → 422 `UPLOAD_SIZE_MISMATCH`. Signature binaire différente du type annoncé → 422 `UPLOAD_CONTENT_MISMATCH`. Dans ces deux cas, le média est refusé et l'objet purgé.
   - Passé l'échéance plus 10 minutes de grâce → 410 `UPLOAD_SESSION_EXPIRED`.
   - Sinon le média passe à `UPLOADED` et entre dans la file. **Un média n'est jamais `READY` sur la seule parole du client.**
4. **`GET /api/v1/media/upload-sessions/:sessionId`** : état de la session, et le média quand il est prêt. Réservé à l'auteur ou à un gestionnaire du bien ; 404 pour les autres.

Cycle de vie : `PENDING_UPLOAD → UPLOADED → PROCESSING → READY`, avec `REJECTED` (fichier non conforme, définitif) et `FAILED` (session expirée ou échecs répétés). La suppression est portée par `deleted_at`.

## Traitement

File durable portée par la table `media` (`next_attempt_at`, `processing_attempts`). Le worker tourne dans le processus de l'API (`MEDIA_WORKER_ENABLED`), sans Redis :

- prise des travaux par `UPDATE … FOR UPDATE SKIP LOCKED` : plusieurs instances ne traitent jamais le même média ;
- **bail** de 2 × `MEDIA_JOB_TIMEOUT_MS` : un worker arrêté en plein travail est relayé à l'expiration ;
- `processing_attempts` sert de jeton de propriété : un worker évincé ne peut plus rien écrire ;
- délai par travail (`MEDIA_JOB_TIMEOUT_MS`), essais bornés (`MEDIA_JOB_MAX_ATTEMPTS`) avec attente croissante de 30 s à 30 min ;
- idempotent : clés de variantes déterministes (`v/{mediaId}/{kind}.webp`), variantes remplacées dans une transaction ;
- erreur permanente (fichier illisible, format trompeur, vidéo trop longue) → `REJECTED` ; erreur transitoire → nouvel essai, puis `FAILED`.

**Photos (Sharp)** : décodage limité en pixels (`MEDIA_MAX_IMAGE_PIXELS`) ; orientation EXIF appliquée ; métadonnées EXIF, GPS, XMP et profils supprimés par réencodage ; conversion sRGB ; variantes WebP (qualité 80) sans agrandissement :

| Variante    | Boîte (photo) | Boîte (360°) | Usage                      |
| ----------- | ------------- | ------------ | -------------------------- |
| `THUMBNAIL` | 320 × 320     | 640 × 320    | Vignettes, listes          |
| `CARD`      | 640 × 640     | 1280 × 640   | Cartes, couverture (`url`) |
| `GALLERY`   | 1280 × 1280   | 2560 × 1280  | Galerie mobile             |
| `LARGE`     | 1920 × 1920   | 4096 × 2048  | Plein écran                |

**Vidéos (léger, sans FFmpeg)** : MP4 et MOV sont lus par plages (boîte `moov` seulement, 16 Mo au plus) pour la durée et les codecs. Codecs acceptés : H.264, H.265, AV1, VP9. Une vidéo qui contient une position GPS est **refusée** : sans transcodage, impossible de l'effacer. WebM : signature et taille seulement. La lecture se fait sur une copie publique (`PLAYBACK`). L'interface `VideoProcessor` permettra un transcodage FFmpeg dans un worker dédié, jamais dans une requête HTTP.

**Documents** : toujours privés, en quarantaine (`q/`). Un PDF doit être complet (`%PDF-` … `%%EOF`) et sans contenu actif (`/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, y compris échappés). Une image doit se décoder. L'antivirus se branche derrière `DocumentScanner` (ClamAV, service managé) ; l'implémentation par défaut `NoopDocumentScanner` enregistre `scan: NOT_SCANNED` dans `metadata`.

## Exposition et livraison

- **Bucket privé** (`S3_BUCKET`) : originaux, documents, quarantaine. Jamais public.
- **Bucket public** (`S3_PUBLIC_BUCKET` + `MEDIA_PUBLIC_BASE_URL`, CDN) : uniquement les variantes traitées des médias publics. URL permanentes, `Cache-Control: public, max-age=604800`.
- **Sans bucket public** : aucune URL permanente. Les vues de médias reçoivent des URL présignées courtes (`MEDIA_DOWNLOAD_URL_TTL_SECONDS`), générées à la lecture et jamais stockées. Limite : `coverUrl` des biens, annonces et résultats de recherche reste alors `null`.

Seuls les médias `READY`, `PUBLIC` et non supprimés sont exposés (`PUBLIC_MEDIA`). La couverture (`COVER_MEDIA`) est la première photo publique prête, dans l'ordre du bien.

| Méthode | Chemin                                                   | Accès                                                                         |
| ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GET     | `/api/v1/properties/:propertyId/media`                   | Public (bien actif : médias publics prêts) ; gestionnaire : tout, avec statut |
| PATCH   | `/api/v1/properties/:propertyId/media/order`             | Gestionnaire. Liste exacte des médias, sans doublon                           |
| PATCH   | `/api/v1/properties/:propertyId/media/:mediaId`          | Gestionnaire. `{ "isPrimary": true }` : la photo passe en tête                |
| DELETE  | `/api/v1/properties/:propertyId/media/:mediaId`          | Gestionnaire. 204                                                             |
| GET     | `/api/v1/properties/:propertyId/media/:mediaId/download` | Gestionnaire, ou `verification:read` pour un document. Lien court, audité     |

Un changement d'image principale, d'ordre, une suppression ou un média devenu prêt émet `property.media_changed`. Search resynchronise **les annonces de ce bien seulement**, et Recommendation invalide son cache. Aucune réindexation globale.

**Documents et module Trust** : `MEDIA_DOCUMENT_ACCESS` (interface `MediaDocumentAccess`) est le seul accès de Trust aux fichiers :

- `createVerificationUpload` ouvre l'envoi d'une pièce de vérification (`purpose = VERIFICATION`, sans bien, toujours privée, clé en quarantaine `q/`) et la rattache au dossier dans la même transaction. Seul son auteur lit et confirme la session ; elle n'apparaît dans aucune galerie et aucun co-gestionnaire de bien n'y accède ;
- `describe` et `describeMany` donnent l'état, le type, la taille, le résultat d'analyse (`NOT_SCANNED`) et l'empreinte SHA-256 calculée au traitement ;
- `otherUploadersOfSameContent` repère un fichier identique envoyé par un autre compte ;
- `createReviewLink` produit un lien court pour un relecteur dont Trust a vérifié les droits, audité ;
- `retire` masque la pièce et planifie sa purge (retrait par le déclarant, rétention échue).

Une clé citée par `verifications.document_reference` (ancien modèle) ou par une pièce de dossier non retirée **empêche la purge** et n'est jamais traitée comme orpheline. Détails : [trust-and-verification.md](./trust-and-verification.md).

**Pièces jointes de messagerie** : Communication ouvre l'envoi par le même service (`purpose = MESSAGE`, sans bien, toujours privé, quarantaine et traitement identiques). `message_attachments` ne contient qu'une référence vers `media` (`RESTRICT`) : aucun binaire en base, aucun second stockage. Seul l'auteur confirme l'envoi ; la pièce n'est attachée qu'une fois `READY`, et seuls les participants actifs obtiennent un lien signé court. Détails : [messaging-and-notifications.md](./messaging-and-notifications.md).

## Suppression, rétention, nettoyage

- **Suppression** : masquage immédiat, variantes publiques retirées du bucket public, original conservé `MEDIA_DELETED_RETENTION_DAYS` jours. Une copie déjà en cache CDN peut rester servie jusqu'à son expiration : il faut purger le CDN si le retrait doit être immédiat.
- **Purge** (`purge_after` échu) : suppression de l'original et de toutes les variantes possibles, puis `purged_at`. Ignorée, et reportée, si une vérification cite la clé.
- **Sessions abandonnées** : passées à `FAILED` (`UPLOAD_EXPIRED`), objet purgé.
- **Orphelins** : objets sans média vivant (clé inconnue ou média purgé). Ne sont jamais concernés : les objets de moins de 24 h, et ceux cités par une vérification. La détection est **en simulation par défaut**.

Le worker exécute l'expiration et la purge toutes les `MEDIA_CLEANUP_INTERVAL_MINUTES`. La détection d'orphelins est manuelle :

```bash
pnpm --filter @mon-appart/api media:orphans                 # simulation : compte seulement
pnpm --filter @mon-appart/api run build && node apps/api/dist/modules/media/cli/media-cli.js orphans --apply
pnpm --filter @mon-appart/api media:cleanup                 # expiration + purge échue
pnpm --filter @mon-appart/api media:process                 # vider la file (--max=<n>)
```

La CLI désactive le worker intégré et n'affiche ni clé, ni URL signée, ni configuration.

## Sécurité

- Le client ne choisit jamais une clé ni un chemin (champ refusé). Les clés suivent `^(o|q|v)/<uuid>/[a-z0-9]{1,64}\.[a-z0-9]{2,5}$`, revérifiée avant chaque accès. Le stockage local confine en plus le chemin à sa racine.
- Le type MIME et la taille déclarés ne sont pas des preuves : ils sont revérifiés sur l'objet stocké, puis par décodage.
- Pas d'écrasement : `If-None-Match: *` (S3/R2), écriture exclusive (`wx` puis `link`) en local.
- Rien de secret n'est renvoyé au navigateur : ni identifiants du fournisseur, ni clé de stockage, ni chemin interne.
- Les logs ne contiennent ni URL présignée, ni jeton, ni contenu : identifiants publics, types, tailles et codes seulement. Les URL signées sont masquées dans les messages d'erreur (`safeErrorMessage`) et dans les journaux HTTP (`redactUrl`).
- Limites de débit : `MEDIA_UPLOAD_RATE_LIMIT` (sessions et confirmations) et `MEDIA_MUTATION_RATE_LIMIT` (ordre, image principale, suppression, liens).
- Le stockage local est refusé en staging et en production (validation de configuration).

## Configuration du stockage

Variables détaillées dans `.env.example`. En production, avec R2 :

1. Deux buckets : un privé (`S3_BUCKET`) et un public (`S3_PUBLIC_BUCKET`), ce dernier relié à un domaine CDN (`MEDIA_PUBLIC_BASE_URL`).
2. Un jeton API limité à ces deux buckets (lecture, écriture, suppression).
3. CORS sur le bucket privé : origines de `WEB_APP_URL`, méthode `PUT`, en-têtes `Content-Type` et `If-None-Match`.

N'ajoutez pas de règle de cycle de vie qui supprime `o/` ou `q/` : le fournisseur ignore les références en base et effacerait des justificatifs cités par une vérification.

Le stockage local (`MEDIA_STORAGE_PROVIDER=local`) émule ces garanties : liens HMAC signés servis par l'API sous `/api/v1/media/local/*` (hors Swagger), espaces `private/` et `public/` séparés.

## Observabilité

Métriques Prometheus (`/metrics`) :

- `media_upload_sessions_total`, `media_uploads_completed_total`, `media_upload_bytes` ;
- `media_rejected_total{type,reason}`, `media_processing_total{type,outcome}`, `media_processing_duration_ms` ;
- `media_jobs_pending`, `media_storage_errors_total{operation}`, `media_purged_total`, `media_orphan_objects`.

Logs JSON : `media.upload_started`, `media.uploaded`, `media.ready`, `media.rejected`, `media.failed`, `media.processing_retry`, `media.deleted`, `media.purged`, `media.purge_retained`, `media.orphan_scan`, `media.storage_error`. Audit : `MEDIA_UPLOAD_STARTED`, `MEDIA_REORDERED`, `MEDIA_PRIMARY_CHANGED`, `MEDIA_DELETED`, `MEDIA_DOCUMENT_ACCESSED`.

## Tests

- Unitaires (`src/modules/media/**/*.spec.ts`) : signatures binaires, politique, clés et traversée de chemin, cycle de vie, lecteur MP4, contrôle PDF ; Sharp (EXIF et GPS supprimés, orientation, pas d'agrandissement, limite de pixels) ; stockage local (jetons altérés ou expirés, taille, non-écrasement) ; présignature S3 hors réseau.
- Intégration (`test/media/media.db-spec.ts`, base `_test`, stockage local temporaire, worker désactivé, `runOnce`) : flux complet, confirmation idempotente, faux MIME, taille, réutilisation d'URL, droits, session expirée, documents privés, vidéos, ordre et image principale, réindexation ciblée, nouveaux essais et bail, purge et orphelins.

Aucun test n'utilise de compte Cloudflare ou AWS.

## Limites connues

- Pas de transcodage vidéo, ni de vignette vidéo, ni de vérification de durée WebM (FFmpeg prévu dans un worker dédié).
- Antivirus non branché par défaut (`NOT_SCANNED`).
- Sans bucket public, les couvertures du catalogue sont `null`.
- Purge CDN non automatisée après suppression.
- Pas de reprise d'envoi par morceaux (multipart) : un fichier de 200 Mo s'envoie en une fois.
