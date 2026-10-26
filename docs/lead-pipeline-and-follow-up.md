# Pipeline leads supply et relances

**Date :** 2026-10-22 · API : `GET/POST/PATCH /api/v1/admin/supply-leads` · UI admin : `/supply-leads`

---

## 1. Stages (enum produit)

`IDENTIFIED` → `TO_CONTACT` → `CONTACTED` → `QUALIFIED` → `DEMO` → `REGISTERED` → `LISTINGS_SUBMITTED` → `VERIFICATION` → `FIRST_PUBLISHED` → `ACTIVATED` → `NURTURE`  
Alternatives : `REFUSED`, `CHURN_RISK`

Transitions invalidées côté domaine (`supply-lead-pipeline.ts`).  
`ACTIVATED` refuse si `activeListings < 1`.  
`REFUSED` exige `refusalReason`.

---

## 2. Distinction Partner

| Objet        | Rôle                                   |
| ------------ | -------------------------------------- |
| `SupplyLead` | CRM terrain (owners + agences)         |
| `Partner`    | Registre intégrations / CSV / webhooks |

Lien optionnel `partnerPublicId` après formalisation.  
Partner `commercialStatus` : PROSPECT/ACTIVE/SUSPENDED/ENDED — **ne remplace pas** le pipeline fin.

---

## 3. Interactions

Kinds : CALL, WHATSAPP, EMAIL, VISIT, DEMO, NOTE, STATUS_CHANGE.  
Journal via `POST .../interactions`.  
Relances : renseigner `nextAction` + `nextActionAt` ; filtrer stage dans l’admin.

---

## 4. Cadence de relance (hypothèse ops)

| Stage                   | Relance si silence             |
| ----------------------- | ------------------------------ |
| TO_CONTACT              | J+2, J+7 puis REFUSED ou pause |
| DEMO                    | J+2                            |
| REGISTERED sans listing | J+3, J+10                      |
| CHURN_RISK              | J+7 offre aide MAJ             |

Pas de spam WhatsApp ; respecter refus de contact.

---

## 5. Compteurs annonces sur le lead

`submittedListings` / `approvedListings` / `activeListings` — saisie ops (V1) ; synchronisation auto Listing↔Lead = **non implémentée** (amélioration future).
