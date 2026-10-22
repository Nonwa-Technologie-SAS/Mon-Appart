# 0013 — Paiements et abonnements des services de la plateforme

Date : 2026-10-13

## Contexte

La plateforme doit pouvoir vendre ses propres services (abonnements donnant un quota d'annonces actives) sans jamais encaisser de loyer, de dépôt ni de prix de vente. Aucun compte marchand n'est encore ouvert. Aucun contrat de prestataire n'est signé. Aucune validation fiscale n'a été faite. Les prestataires usuels en Côte d'Ivoire passent surtout par le mobile money, où le prélèvement automatique est rarement disponible.

Choix du produit (questionnaire) : simulateur seulement, abonnements seulement (renouvellement manuel, sans promotion ni crédit), quota configurable mais désactivé par défaut, API complète avec back-office, sans interface d'achat côté client pour l'instant.

## Décision

1. **Module `billing` autonome**, source de vérité en PostgreSQL. Il dépend d'Identity (acteur, permissions) et de Communication (avis), et expose `entitlements.ts` sans module Nest pour que Listing applique le quota sans cycle d'import.
2. **Abstraction `PaymentProvider`** (checkout hébergé, interrogation, vérification de webhook, remboursement facultatif, `recurring: false`). Un seul prestataire actif, choisi par `PAYMENT_PROVIDER`. Seul le simulateur `mock` est implémenté, et il est refusé par la validation d'environnement hors développement et en `live`.
3. **Confirmation par le prestataire uniquement** : webhook signé (HMAC sur corps brut, horodatage, temps constant) ou interrogation authentifiée. La redirection du navigateur n'a aucune valeur. Le simulateur passe par le même webhook signé.
4. **Commande figée, paiement distinct.** La commande porte le montant fixé par le serveur, immuable (trigger). Les tentatives de paiement ont leur propre machine à états, et les états finaux ne régressent pas.
5. **Idempotence et concurrence portées par la base** : contraintes uniques (clé d'idempotence, événement prestataire, période par commande, tentative ouverte par commande, commande en attente par acheteur, abonnement courant par compte), verrous de ligne, et verrou consultatif pour le quota.
6. **Ajout seul.** Suppression interdite par trigger sur les tables financières. Les corrections passent par un remboursement, une révocation de période ou un incident clos, sans aucun solde modifiable.
7. **Remboursements à quatre yeux** : la personne qui décide est différente de celle qui demande, le montant est plafonné au remboursable, et le statut « effectué » n'est posé qu'après confirmation du prestataire.
8. **Back-office sans « marquer payé »** : diagnostic, interrogation du prestataire, décisions de remboursement et clôture d'incident avec justification. Aucun secret affiché, aucun revenu net calculé.
9. **Reçu de paiement, pas facture** : il est marqué `isTaxInvoice: false` en attendant une validation fiscale.

## Conséquences

- Aucun encaissement réel n'est possible tant qu'un adaptateur de prestataire n'a pas été écrit, configuré, testé en sandbox et validé contractuellement.
- Le renouvellement manuel impose des rappels (notifications) et une période de grâce. Le prélèvement automatique dépendra du prestataire retenu.
- Le changement de plan est refusé tant que les règles de prorata ne sont pas validées.
- Le plan par défaut reste illimité : activer un quota est une décision d'administration explicite, auditée.
- Les événements Analytics de facturation ne contiennent aucun montant. Les chiffres financiers viennent des tables de facturation, pas d'Analytics.
