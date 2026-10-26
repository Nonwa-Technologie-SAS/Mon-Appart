# Onboarding propriétaires particuliers

**Date :** 2026-10-22

---

## Parcours cible

1. Découverte (prospection / bouche-à-oreille / organique)
2. Compréhension du service (script terrain)
3. Création compte OWNER (`/inscription` propriétaire)
4. Vérification profil / identité selon politique Trust
5. Création Property + Listing
6. Photos (Media)
7. Prix + périodicité (loyer ≠ caution — distinguer clairement)
8. Localisation (référentiel communes)
9. Confirmation droits de publication
10. Soumission (`PENDING_REVIEW` si modération requise)
11. Publication après approbation
12. Gestion disponibilité + demandes

Assistance : guide pas-à-pas, formulaire `/espace/publier`, aide humaine, démo, messagerie **si** providers configurés, import assisté opérateur.

**UX :** pas de faux succès si publication en attente ou en erreur ; états loading / reprise.

---

## Funnel d’activation (mesure)

| Étape          | Signal                            | Source        |
| -------------- | --------------------------------- | ------------- |
| Inscription    | Compte OWNER                      | Identity      |
| Début création | Property/Listing DRAFT            | Listing       |
| Soumission     | PENDING_REVIEW ou publish attempt | Listing       |
| Validation     | Approuvé modération / qualité     | Admin         |
| Publication    | PUBLISHED                         | Listing       |
| 1ʳᵉ demande    | Inquiry / conversation            | Communication |
| Réponse        | Message / statut                  | Messaging     |
| MAJ annonce    | updatedAt / status                | Listing       |

Réutiliser Growth / Analytics existants — pas de second tracker.

Abandons typiques à surveiller : photos, localisation précise, prix, OTP/notif.

---

## Lien SupplyLead

À l’inscription terrain : stage `REGISTERED` → après 1ʳᵉ publish `FIRST_PUBLISHED` → `ACTIVATED`.
