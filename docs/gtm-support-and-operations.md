# Support et opérations — lancement

**Statut :** procédures proposées · **Date :** 2026-10-22  
**Pas de promesse 24/7** sans staffing réel.

Réutilise : admin Nest, Trust reports, notifications, runbooks SRE existants.

---

## 1. Périmètre et limites

Mon Appart assiste sur : compte, publication, annonces, contact technique, signalements, données personnelles (process).

Mon Appart **ne tranche pas** les litiges contractuels propriétaire↔demandeur et **ne garantit pas** la légalité d’une vente/location.

---

## 2. Canaux (à confirmer)

| Canal             | Usage                    | Dispo proposée (hypothèse)         |
| ----------------- | ------------------------ | ---------------------------------- |
| E-mail support    | Tickets                  | Jours ouvrés 9h–18h Abidjan        |
| Formulaire in-app | Signalements / aide      | Idem                               |
| WhatsApp Business | Urgences fraude (option) | Heures définies — **si** ressource |

Horaires exacts : décision RH.

---

## 3. Catégories de tickets

| Code    | Catégorie                 | Priorité défaut                |
| ------- | ------------------------- | ------------------------------ |
| AUTH    | Connexion / OTP / reset   | P1                             |
| PUB     | Publication / médias      | P2                             |
| FIX     | Correction annonce        | P2                             |
| FRAUD   | Fraude / arnaque          | **P0**                         |
| REMOVE  | Retrait demandé           | P1                             |
| CONTACT | Contact ne fonctionne pas | P1                             |
| CLAIM   | Réclamation service       | P2                             |
| PRIV    | Données personnelles      | P1 (délais légaux à confirmer) |
| GEN     | Question générale         | P3                             |

---

## 4. Priorités et délais cibles (hypothèses staffing 1–2 personnes)

| Priorité | Première réponse cible | Exemples                     |
| -------- | ---------------------- | ---------------------------- |
| P0       | &lt; 4 h ouvrées       | Fraude active, faille sécu   |
| P1       | &lt; 1 jour ouvré      | Auth, retrait, contact cassé |
| P2       | &lt; 2 jours ouvrés    | Qualité annonce              |
| P3       | &lt; 5 jours ouvrés    | FAQ                          |

Si non tenable : réduire canaux, pas sur-promettre.

---

## 5. Escalade

1. Support L1 (réponses types).
2. Ops produit / modération Trust.
3. Tech on-call (incident prod) — runbooks SRE.
4. Direction (médiatique / juridique).

---

## 6. Réponses types (extraits)

**Fraude suspectée :**

> Merci. Nous masquons l’annonce le temps de vérifier. Ne versez aucun acompte hors circuit de confiance. Réf ticket #…

**Litige loyer :**

> Mon Appart met en relation mais n’est pas partie au contrat. Nous pouvons retirer une annonce abusive ; pour le litige, adressez-vous aux voies locales appropriées.

**Données personnelles :**

> Demande enregistrée. Nous reviendrons sous [délai à valider juridiquement].

---

## 7. Suivi problèmes récurrents

Tag ticket → revue hebdo → backlog produit si ≥ N occurrences / 14 j.

---

## 8. Conformité (points à faire vérifier — pas une certification)

| Sujet                               | Action                        |
| ----------------------------------- | ----------------------------- |
| Protection données (ARTCI / loi CI) | Revue juridique externe       |
| CGU / mentions légales              | Validation avocat             |
| Responsabilité annonceur            | Clauses claires               |
| Photos / droits                     | Attestation publish           |
| Pub / claims                        | Alignement messages marketing |
| Paiements                           | N/A live tant que mock        |

Sources officielles à consulter avec conseil : textes ARTCI / Code numérique le cas échéant — **confirmation professionnelle requise**.
