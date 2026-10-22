# Notifications push — état et plan

## Backend (déjà présent)

Module Communication Nest :

- Notifications persistées + préférences utilisateur.
- Canaux email / SMS / push via providers configurables.
- `PushDeviceService` + routes `POST/GET/DELETE /api/v1/push-devices`.
- Delivery runner avec retries et déduplication.

**Web Push / FCM ne sont opérationnels que si** les providers et secrets sont configurés dans l’environnement (voir `.env.example` côté API). Aucune clé privée ne doit vivre dans `apps/web` ou `apps/mobile`.

## Web PWA (ce lot)

- **Non activé** : pas d’abonnement `PushManager`, pas de demande de permission au démarrage.
- Prérequis restants :
  1. Clés VAPID (ou fournisseur choisi) côté serveur.
  2. Endpoint d’enregistrement aligné sur `push-devices`.
  3. Handler `push` dans le service worker.
  4. UX consentement contextualisée (après une action utile).

## Expo / Flutter

- Expo : évaluer `expo-notifications` une fois l’API Nest unifiée.
- Flutter : FCM / APNs via configuration store — hors scope tant que Flutter n’existe pas.

## Principes produit

- Pas de spam ; préférences respectées.
- L’événement métier est la source de vérité ; la livraison push n’est pas garantie.
- Pas de contenu de conversation ni de documents d’identité dans le payload push.
