# 0010 — Messagerie et notifications

Date : 2026-10-13

## Contexte

Le schéma contenait déjà `inquiries` (demandes de contact et de visite, avec un texte libre), `appointments` (statuts sans report, annulation ni rappel), `notifications` (in-app, servie par un module Communication minimal créé pour Trust) et `media`. Il n'y avait ni conversation, ni message, ni canal externe, ni préférence, ni temps réel.

Il fallait permettre aux clients d'échanger avec les propriétaires, agents et agences, organiser des visites et notifier sur plusieurs canaux. Contraintes : aucune dépendance obligatoire à un fournisseur externe ou à Redis, aucun accès à une conversation par la seule connaissance de son identifiant, aucun contenu sensible hors de l'application, aucune livraison simulée.

## Décision

1. **Réutiliser `inquiries`** comme demande de contact (une demande par conversation, texte libre nul) plutôt que créer une seconde table ; compléter `appointments` et `notifications` ; réutiliser Media pour les pièces jointes (`purpose = MESSAGE`, privé) sans second stockage.
2. **Conversation à deux parties** : une par (annonce, demandeur). Le côté annonce est l'ensemble des gestionnaires **actuels** du bien, recalculé à chaque accès. Un ancien gestionnaire perd l'accès ; sa participation passe à `LEFT`. Pas de conversation de groupe.
3. **Ordre et idempotence en base** : `seq` attribué par un `UPDATE … RETURNING` sur la conversation (sans trou, refusé si elle est fermée) ; `client_message_id` unique par auteur et par conversation.
4. **Outbox en base** (`notification_deliveries`) servie par un worker dans l'API (`FOR UPDATE SKIP LOCKED`, bail, backoff exponentiel, essais bornés), plutôt qu'une file Redis/BullMQ : la notification est validée avec l'opération métier, et plusieurs instances se partagent la file sans infrastructure supplémentaire.
5. **Fournisseurs derrière une interface** (`ChannelProvider`) : SMTP (nodemailer) et passerelle SMS HTTP générique livrés ; push (FCM) et WhatsApp Business (API officielle) préparés sans adaptateur, donc indisponibles. Un canal sans fournisseur n'est jamais planifié.
6. **Repli explicite et différé** (`NOTIFICATION_FALLBACKS`) : le canal de repli n'est envoyé qu'après l'échec définitif du canal principal, sur un seul niveau, sans chaîne ni cycle.
7. **Temps réel Socket.IO** (`/realtime`) authentifié par l'access token, révocation revérifiée, une salle par utilisateur, adaptateur Redis facultatif. Le temps réel n'est qu'une notification : la vérité reste l'API REST (`after=`).
8. **Anti-abus compté en base** (débit, conversations par heure, texte répété) : refus du seul message en cause (429 avec `Retry-After`), jamais de blocage automatique de compte.
9. **Messages système** produits par le backend (code et données publiques, sans auteur), garantis par des CHECK et un trigger d'immutabilité.
10. **Modération par signalement** (module Trust) : extrait limité au signalement, fermeture tracée, aucun accès administrateur global aux conversations.

## Conséquences

- Communication dépend d'Identity et de Media ; Trust dépend de Communication (signalement et fermeture), jamais l'inverse.
- Les e-mails et SMS restent génériques (titre, lien) : l'utilisateur doit ouvrir l'application pour lire un message.
- Sans Redis, le temps réel ne fonctionne qu'au sein d'une instance ; le rattrapage REST compense.
- Une livraison s'arrête à `SENT` tant que les accusés des fournisseurs (webhooks signés) ne sont pas traités.
- Les codes OTP d'Identity ne sont pas encore servis par ces fournisseurs.
- La file en base suffit pour le volume attendu ; une file dédiée pourra la remplacer derrière la même interface si le débit l'exige.
