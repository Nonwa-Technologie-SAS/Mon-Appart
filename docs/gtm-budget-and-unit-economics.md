# Budgets pilotes et unit economics (hypothèses)

**Statut :** scénarios à valider · **Aucune dépense engagée par ce document** · **Date :** 2026-10-22  
Devise : XOF. Fourchettes = **estimations** (effort humain + outils), pas des devis fournisseurs.

---

## 1. Scénarios

### Scénario minimal — validation terrain

| Poste                                  | Fourchette mensuelle indicative (XOF) | Hypothèses                        |
| -------------------------------------- | ------------------------------------- | --------------------------------- |
| Prospection commerciale (temps équipe) | 0 cash / 0,5–1 FTE                    | Salaires déjà couverts hors scope |
| Vérification annonces                  | 0–200 000                             | Déplacements / data               |
| Contenus                               | 0–150 000                             | Guides légers                     |
| Outils (sheets, design)                | 0–50 000                              | Outils gratuits possibles         |
| Publicité                              | **0**                                 | Interdit sans OK                  |
| Support                                | Temps équipe                          | Heures bureau                     |
| Infra supplémentaire                   | 0–selon cloud                         | Hors GTM pur                      |
| **Total cash incrémental**             | **~0 – 400 000**                      | À approuver                       |

### Scénario intermédiaire — supply + soft demand

| Poste                           | Fourchette / mois (XOF)  | Notes                         |
| ------------------------------- | ------------------------ | ----------------------------- |
| Prospection / BD                | 300 000 – 1 200 000      | Honoraires freelance ou bonus |
| Vérification / photos assistées | 200 000 – 800 000        |                               |
| Contenus + design supports      | 100 000 – 400 000        |                               |
| Outils marketing                | 50 000 – 200 000         |                               |
| Publicité pilote Meta/Google    | 200 000 – 1 000 000      | **Autorisation requise**      |
| Support élargi                  | 100 000 – 400 000        |                               |
| **Total**                       | **~950 000 – 4 000 000** | Estimation large              |

### Scénario accéléré — scale prudent

| Poste                        | Fourchette / mois (XOF) | Condition                         |
| ---------------------------- | ----------------------- | --------------------------------- |
| Équipe commerciale renforcée | 1 500 000 – 5 000 000+  | Ops qualité OK                    |
| Pub                          | 1 000 000 – 5 000 000+  | CPA validé                        |
| Partenariats / events        | 500 000 – 2 000 000     |                                   |
| **Total**                    | **élevé**               | Seulement si Go pilote + staffing |

---

## 2. Modèles de calcul (formules)

Sans inventer de valeurs : utiliser dès que données réelles existent.

| Métrique                            | Formule                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Coût / prospect supply              | Dépenses prospection / prospects contactés                                                              |
| Coût / partenaire activé            | Dépenses prospection / partenaires avec ≥1 annonce live                                                 |
| Coût / annonce active vérifiée      | (Prospection + vérif) / annonces live contrôlées                                                        |
| Coût / utilisateur activé (demande) | Dépenses acquisition demande / seekers avec ≥1 recherche ou contact (déf. à figer)                      |
| Coût / contact qualifié             | Dépenses demande / contacts avec réponse annonceur ou critères match                                    |
| CAC client payant                   | Dépenses / premiers payeurs (post-monétisation)                                                         |
| Valeur partenaire dans le temps     | Σ (valeur attribuée leads − coûts service) sur période — **nécessite** tracking + hypothèse valeur lead |

**CAC campagne ≠ coût complet** (exclure temps équipe sous-estime).

---

## 3. Données manquantes

- Salaires / FTE réellement alloués.
- Coûts cloud incrémentaux.
- CPC/CPA locaux Meta/Google CI (à mesurer en micro-test).
- Import dépenses dans BI : **non implémenté** ([acquisition-channels.md](./acquisition-channels.md)).

---

## 4. Décision budgétaire requise

Choisir scénario + plafond mensuel + owner validation dépenses.
