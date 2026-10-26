# Onboarding agences

**Date :** 2026-10-22 · Complète [partner-onboarding.md](./partner-onboarding.md).

---

## Phase A — Inscription

Collecte minimale : nom commercial, représentant habilité, téléphone/e-mail pro, zones, types de biens, acceptation CGU.

Vérification : Trust type `AGENCY` si exigée par politique ; sinon identité contact + déclaration droits de publication.

Éviter documents sensibles systématiques si un niveau moindre suffit.

Compte : rôle `AGENCY` (inscription web ou admin `role:manage`).

---

## Phase B — Configuration

Selon produit actuel :

- Profil / coordonnées
- Zones (renseignées aussi sur `SupplyLead`)
- Gestion annonces (espace)
- Demandes reçues (messaging / inquiries)

Collaborateurs multi-user : **à confirmer** selon capacités comptes — ne pas promettre si non livré.

Isolation : une agence ne voit pas les données d’une autre (contrôle serveur Listing/Property).

---

## Phase C — Import / publication

| Méthode                   | État            | Usage                                           |
| ------------------------- | --------------- | ----------------------------------------------- |
| Saisie manuelle           | Opérationnelle  | Défaut pilote                                   |
| Import CSV validate       | Dry-run Partner | Prévisualiser ; **pas** d’écriture Listing auto |
| API machine               | Non             | Plus tard                                       |
| Import assisté commercial | Ops             | Opérateur autorisé + provenance                 |

CSV : voir [authorized-listing-imports.md](./authorized-listing-imports.md) et [partner-data-import-and-sync.md](./partner-data-import-and-sync.md).

Property ≠ Listing : créer le bien puis l’offre commerciale.

---

## Phase D — Activation (critères)

Agence **activée** si :

1. Compte configuré
2. ≥1 annonce `PUBLISHED` (qualité OK)
3. Contact fonctionnel testé
4. Disponibilité confirmée selon procédure
5. Capacité à traiter une demande (réponse ou ack)

Mettre à jour `SupplyLead` → `ACTIVATED` + `activeListings ≥ 1`.

---

## Phase E — Fidélisation

J+3 / J+14 / J+30 : aide, perf (vues/contacts **si** analytics dispo), MAJ annonces, feedback, réactivation `CHURN_RISK`.

Ne promettre dashboards pro que s’ils existent pour le rôle.
