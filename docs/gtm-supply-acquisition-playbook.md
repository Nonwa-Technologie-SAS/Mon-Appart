# Playbook d’acquisition de l’offre immobilière

**Statut :** playbook opérationnel · **Aucun partenaire signé** · **Date :** 2026-10-22  
Outils : CRM léger `SupplyLead` (admin **Acquisition offre**) + tableur offline si besoin. Module partners : [partner-onboarding.md](./partner-onboarding.md). Détail ops : [supply-acquisition-strategy.md](./supply-acquisition-strategy.md), [field-sales-playbook.md](./field-sales-playbook.md), [lead-pipeline-and-follow-up.md](./lead-pipeline-and-follow-up.md).

---

## 1. Objectif

Constituer un **stock initial d’annonces actives, complètes et contrôlées** dans les zones pilotes (Cocody, Marcory) avant d’amplifier la demande.

Hypothèse de volume (à valider ops) : viser d’abord la **densité utile** (plusieurs biens par typologie/budget) plutôt qu’un chiffre arbitraire national.

---

## 2. Segments à approcher

| Segment                    | Priorité  | Pourquoi                           | Risque                 |
| -------------------------- | --------- | ---------------------------------- | ---------------------- |
| Propriétaires particuliers | P1        | Offre rapide, stories authentiques | Qualité photos / dispo |
| Petites agences            | P1        | Volume + professionnalisme         | Multi-portails         |
| Agences établies           | P2        | Portefeuille large                 | Négociation lente      |
| Gestionnaires de biens     | P2        | Stock récurrent                    | Process contrat        |
| Promoteurs                 | P3        | Neuf                               | Cycles longs           |
| Spécialistes terrains      | Plus tard | Risque confiance                   | Vérif docs             |

---

## 3. Canaux d’acquisition offre

| Canal                                 | Coût                  | Effort | Délai | Conversion (H) | Qualité annonces (H) | Priorité démarrage            |
| ------------------------------------- | --------------------- | ------ | ----- | -------------- | -------------------- | ----------------------------- |
| Prospection directe (tél. / visite)   | Bas cash / haut temps | Élevé  | Court | Moyen          | Haute si accompagné  | **Oui**                       |
| Réseaux pro / intros                  | Bas                   | Moyen  | Moyen | Haute          | Haute                | **Oui**                       |
| Parrainage propriétaire→propriétaire  | Bas                   | Faible | Moyen | Moyen          | Variable             | Oui après 10 succès           |
| Partenariats agences formels          | Moyen                 | Élevé  | Long  | Variable       | Haute si SLA         | Pilote                        |
| Démos produit                         | Bas                   | Moyen  | Court | Moyen          | —                    | Oui                           |
| Campagnes Meta « publiez votre bien » | Cash                  | Moyen  | Court | Inconnu        | Variable             | **Après autorisation**        |
| Communautés / événements              | Moyen                 | Moyen  | Moyen | Faible–moyen   | Variable             | Sélectif                      |
| Import partenaires CSV                | Tech                  | Élevé  | Moyen | —              | Dépend source        | Fondations V1 ; droits requis |

---

## 4. Processus de recrutement (11 étapes)

1. **Identification** — listing prospects (nom, zone, nb biens, canal source).
2. **Premier contact** — WhatsApp/appel (script ci-dessous).
3. **Présentation** — 5 min bénéfices + démo mobile.
4. **Qualification** — droits de publier ? biens dans zone pilote ? photos ?
5. **Vérification droits** — déclaration + docs identity Trust si process actif.
6. **Collecte infos biens** — checklist champs obligatoires.
7. **Contrôle qualité** — [gtm-trust-and-listing-quality.md](./gtm-trust-and-listing-quality.md).
8. **Publication** — statut actif seulement si OK.
9. **Onboarding** — comment répondre aux contacts.
10. **Suivi perf** — vues / contacts / réponse 48 h (hebdo).
11. **Fidélisation** — rappel renouvellement, aide photos, parrainage.

---

## 5. Tableau de suivi (colonnes minimales)

`prospect_id | type | zone | contact | source | stage | next_action | biens_estimés | annonces_publiées | date_dernier_contact | owner_interne | notes`

Stages : `IDENTIFIED → CONTACTED → DEMO → QUALIFIED → VERIFY → DRAFT → LIVE → NURTURE → CHURN_RISK`

---

## 6. Supports commerciaux (modèles)

### 6.1 Message WhatsApp prospection (propriétaire)

> Bonjour [Prénom], je suis [Nom] de Mon Appart, une plateforme pour louer [type] à [quartier] avec des contacts plus ciblés. On aide les propriétaires à publier clairement budget/localisation. Seriez-vous disponible 10 minutes cette semaine pour voir comment publier votre bien ? Sans engagement.

### 6.2 Script appel (3 min)

1. Accroche + permission.
2. Douleur : contacts peu sérieux / multi-canal.
3. Offre : publication accompagnée, zones Cocody/Marcory, gratuit au démarrage (si validé).
4. Qualif : bien dispo ? photos ?
5. RDV démo ou collecte infos.

### 6.3 Pitch agence (1 slide mental)

- Audience demandeurs zones pilotes
- Leads suivis (définition contact qualifié)
- Effort publish réduit
- Pas de frais plateforme au pilote (hypothèse pricing)
- Sortie facile si pas de valeur

### 6.4 Fiche partenaire (1 page)

Voir modèle dans [gtm-partnership-distribution-plan.md](./gtm-partnership-distribution-plan.md).

### 6.5 Guide publication

Checklist champs + photos (min. 4), prix FCFA, disponibilité, quartier précis, règles anti-doublon.

---

## 7. KPI supply (définitions)

Voir [gtm-kpis-and-dashboard.md](./gtm-kpis-and-dashboard.md) — section Acquisition offre.

---

## 8. Interdits

- Promettre un volume de leads garanti.
- Importer des annonces d’autres sites sans droits.
- Signer mentalement des partenariats non confirmés.
- Publier hors critères qualité pour « faire du volume ».
