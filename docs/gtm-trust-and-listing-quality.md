# Confiance et qualité des annonces

**Statut :** politique opérationnelle proposée · **Date :** 2026-10-22  
Modules : Trust, Media, Admin listings, Reports. Docs billing/trust existantes du dépôt.

---

## 1. Principe

**La quantité d’annonces ne prime jamais sur la fiabilité.**  
Une identité vérifiée **ne prouve pas** la propriété du bien. Une annonce contrôlée **n’est pas** une garantie juridique de transaction.

---

## 2. Niveaux de vérification (communication publique)

| Niveau                        | Ce que ça garantit                                     | Ce que ça ne garantit pas                       | Support produit        |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------- | ---------------------- |
| Brouillon / non publié        | —                                                      | —                                               | Workflow listing       |
| Publié (contrôles de base)    | Champs obligatoires présents, format prix, photos min. | Existence physique, titre, disponibilité réelle | Checklist + modération |
| Identité vérifiée (annonceur) | Process Trust IDENTITY approuvé (humain)               | Propriété du bien, solvabilité                  | Trust verification     |
| Annonce signalée / sous revue | Investigation en cours                                 | Résultat                                        | Reports + admin        |
| Suspendu / retiré             | Non visible                                            | —                                               | Admin                  |

Copy UI : phrases courtes, sans « certifié authentique à 100 % ».

---

## 3. Contrôles avant publication (politique qualité)

| Contrôle                            | Obligatoire pilote ? | Notes                               |
| ----------------------------------- | -------------------- | ----------------------------------- |
| Coordonnées joignables              | Oui                  | Test smoke contact                  |
| Cohérence prix / typologie / zone   | Oui                  | Seuils heuristiques + revue         |
| Photos pertinentes (≥ N)            | Oui                  | Media module                        |
| Localisation (commune/quartier)     | Oui                  | Zones pilotes                       |
| Date disponibilité                  | Oui                  | —                                   |
| Droits de publication (déclaration) | Oui                  | CGU + attestation                   |
| Doublons                            | Oui                  | Hash / similarité manuelle au début |
| Documents titre / ACD               | Non systématique LD  | Obligatoire si push terrains        |
| Visite physique Mon Appart          | Non (coût)           | Option partenaire premium plus tard |

---

## 4. Signalements, suspension, recours

1. Utilisateur signale (motif : fraude, déjà loué, photos trompeuses…).
2. File admin Trust / listings.
3. Priorité : fraude &gt; données perso &gt; qualité.
4. Actions : masquer, demander correction, suspendre compte.
5. Recours : canal support + délai cible (voir [gtm-support-and-operations.md](./gtm-support-and-operations.md)).

---

## 5. Indicateurs qualité

| Indicateur               | Définition                                    | Source          | Fréquence | Objectif chiffré             |
| ------------------------ | --------------------------------------------- | --------------- | --------- | ---------------------------- |
| Completeness rate        | % annonces actives avec champs obligatoires   | DB listings     | Hebdo     | À fixer après capacité vérif |
| Controlled rate          | % passés contrôles pilote                     | Ops log         | Hebdo     | Idem                         |
| Duplicate rate           | Doublons détectés / soumis                    | Ops             | Hebdo     | Idem                         |
| Expired / stale rate     | Actives sans maj &gt; N jours ou dispo passée | DB              | Hebdo     | Idem                         |
| Report handling time     | Médiane délai 1ʳᵉ action                      | Admin           | Hebdo     | Selon staffing               |
| Advertiser response rate | % contacts avec réponse 48 h                  | Messaging / ops | Hebdo     | Critère Go pilote            |

---

## 6. Fraude — signaux d’alerte

- Prix anormalement bas vs typologie zone.
- Pression paiement hors plateforme.
- Photos banques d’images / incohérentes.
- Refus de visite / uniquement acompte immédiat.
- Multi-comptes même contact.

Action : formation support + playbook retrait rapide.

---

## 7. Lien produit

Réutiliser : `trust/verifications`, `trust/reports`, badges, admin listings.  
Ne pas inventer un second système de badges en marketing.
