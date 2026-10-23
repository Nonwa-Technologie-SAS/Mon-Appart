# Checklist Go / No-Go — lancement public Mon Appart

**Statut :** outil de décision · **Date :** 2026-10-22  
Les seuils quantitatifs marqués **(H)** sont des hypothèses à figer avec données pilote + capacité ops.

Légende : **B** bloquant · **I** important · **P** post-lancement

---

## A. Préparation produit

| #   | Critère                               | Classe | Comment vérifier             | Statut dépôt (2026-10)                 |
| --- | ------------------------------------- | ------ | ---------------------------- | -------------------------------------- |
| A1  | Search → résultats utiles zone pilote | B      | Smoke staging + données seed | Code OK — données seed absentes        |
| A2  | Fiche annonce fiable                  | B      | QA                           | Code OK                                |
| A3  | Publication OWNER/AGENCY              | B      | E2E                          | Code OK                                |
| A4  | Contact fonctionne bout-en-bout       | B      | 10 tests réels               | À prouver ops                          |
| A5  | Auth / reset / OTP                    | B      | E2E ; providers notif        | Partiel / config                       |
| A6  | Modération minimale + signalements    | I      | Admin workflow               | Socle                                  |
| A7  | Sécurité / confidentialité revue      | B      | Checklists sécu              | Doc ; audit externe ?                  |
| A8  | Monitoring + alertes canal humain     | B      | SRE checklist                | Métrique code ; canal externe manquant |
| A9  | Backups + restore testé               | B      | Restore drill                | Doc ; restore non fait                 |
| A10 | Support organisé                      | I      | Canaux + owners              | À définir                              |
| A11 | CGU / mentions validées               | B      | Juridique                    | Validation externe requise             |
| A12 | Paiements live                        | P      | —                            | **Ne pas activer**                     |
| A13 | Assistant / reco                      | P      | Flags                        | Non bloquant                           |

---

## B. Préparation commerciale

| #   | Critère                          | Classe      | Seuil indicatif (H)                                                 |
| --- | -------------------------------- | ----------- | ------------------------------------------------------------------- |
| B1  | PV testée (entretiens / actions) | B           | H1–H4 décidées                                                      |
| B2  | Segments prioritaires figés      | B           | Location LD + supply                                                |
| B3  | Offre initiale pertinente        | B           | Densité permettant scénarios budget types sans zero-result dominant |
| B4  | Partenaires / owners activés     | I           | ≥ seuil ops (ex. 10+ annonceurs actifs) **(H)**                     |
| B5  | Canaux acquisition préparés      | I           | Organique prêt ; payant optionnel                                   |
| B6  | Budget approuvé                  | B si payant | Plafond signé                                                       |
| B7  | Suivi conversions opérationnel   | B           | War room hebdo                                                      |

---

## C. Préparation opérationnelle

| #   | Critère                         | Classe |
| --- | ------------------------------- | ------ |
| C1  | Incidents / rollback            | B      |
| C2  | Retrait annonces problématiques | B      |
| C3  | Suivi tickets                   | I      |
| C4  | Responsables nommés             | B      |
| C5  | Plan com lancement              | I      |
| C6  | Plan retour arrière acquisition | I      |

---

## D. Seuils marketplace (à calibrer après 2–4 semaines pilote)

| Indicateur                          | Proposition initiale (H) | Donnée requise avant figer |
| ----------------------------------- | ------------------------ | -------------------------- |
| Taux réponse annonceur 48 h         | ≥ 40 %                   | Mesure pilote              |
| Zero-result rate recherches ciblées | ≤ 25 %                   | Logs search zone           |
| Signalements ouverts P0             | 0 non traités &gt; 24 h  | Support                    |
| Annonces stale                      | ≤ 15 % actives           | Ops                        |

Si données insuffisantes → **No-Go public** ; prolonger pilote.

---

## E. Décision

| Issue                     | Condition                                                                       |
| ------------------------- | ------------------------------------------------------------------------------- |
| **GO public progressif**  | Tous B verts ; I acceptés avec plan ; seuils D atteints ou explicitement waivés |
| **PROLONGER pilote**      | Matching prometteur mais seuils incomplets                                      |
| **NO-GO / repositionner** | Contact cassé, offre vide, confiance cassée, ou juridique bloquant              |

Signature : Product · Growth · Tech · Ops · Direction — date ____
