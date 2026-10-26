# Intake annonces et contrôle qualité

**Date :** 2026-10-22 · Statuts Listing : `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` → `PAUSED` / `SUSPENDED` / `EXPIRED` / `RENTED` / `SOLD` / `ARCHIVED`

Complète [gtm-trust-and-listing-quality.md](./gtm-trust-and-listing-quality.md).

---

## 1. Données à vérifier (selon risque)

| Champ                         | Location                         | Vente              | Terrain               |
| ----------------------------- | -------------------------------- | ------------------ | --------------------- |
| Nature du bien                | Oui                              | Oui                | Oui                   |
| Type d’opération              | RENT / …                         | SALE               | SALE                  |
| Prix + périodicité            | Loyer (MONTH…) ≠ caution / frais | Prix total ≠ frais | Prix total            |
| Localisation                  | Oui                              | Oui                | Oui + précision       |
| Caractéristiques              | Pièces, surface…                 | Idem               | Superficie            |
| Photos + droits               | Oui                              | Oui                | Oui                   |
| Contact annonceur             | Test smoke                       | Idem               | Idem                  |
| Droits publication            | Déclaration                      | Idem               | Idem + docs si requis |
| Disponibilité                 | Date + confirmation              | Idem               | Idem                  |
| Dates collecte / confirmation | Ops                              | Ops                | Ops                   |
| Doublons                      | Oui                              | Oui                | Oui                   |
| Justificatifs                 | Selon Trust                      | Selon Trust        | Escalade si doute     |

**Interdit :** inventer une info manquante pour « remplir » l’annonce.  
Identité vérifiée ≠ propriété juridique du bien.

---

## 2. Checklist d’approbation

- [ ] Complet (champs obligatoires)
- [ ] Cohérent (prix / typologie / zone)
- [ ] Médias OK (≥ N photos pertinentes)
- [ ] Localisation vérifiable
- [ ] Prix cohérent avec l’opération
- [ ] Contact fonctionnel
- [ ] Droits de publication
- [ ] Disponibilité confirmée (procédure)
- [ ] Pas de doublon évident
- [ ] Pas de signal fraude ouvert

Terrains : pièces / escalade personne compétente ; **pas** de claim « garanti juridiquement ».

---

## 3. Workflow aligné produit

`Soumise (DRAFT)` → `En vérification (PENDING_REVIEW)` → `Approuvée/publiée (PUBLISHED)` → `À reconfirmer (process ops + expiresAt)` → `EXPIRED / SUSPENDED / retirée`

Score de risque Trust : **priorise** la file, ne déclare pas automatiquement une personne fraudeuse.
