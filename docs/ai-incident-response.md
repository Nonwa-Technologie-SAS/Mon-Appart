# Réponse aux incidents IA

Pas de table d’incidents IA dédiée. Utiliser Sentry, logs JSON (`action=assistant_turn|recommendation_fallback|recommendation_shadow`) et le runbook déploiement.

| Scénario                   | Symptômes                               | Gravité  | Action immédiate                                           | Fallback                      |
| -------------------------- | --------------------------------------- | -------- | ---------------------------------------------------------- | ----------------------------- |
| Pertinence en berne        | baisse contacts attribués, hausse empty | élevée   | confirmer sur Analytics Reco ; ne pas conclure sur un jour | `RECOMMENDATION_ENGINE=rules` |
| Biens indisponibles        | listings non PUBLISHED dans une liste   | élevée   | Search filtre déjà PUBLISHED ; vérifier hydratation        | cache reco TTL                |
| Hallucination              | prix / id inventé                       | élevée   | `AI_ASSISTANT_PROVIDER=rules`                              | sanitize + Search             |
| Fuite PII dans une réponse | email / téléphone                       | critique | couper OpenAI, conserver logs sans recopier le contenu     | rules                         |
| Latence                    | p95 assistant/reco                      | moyenne  | timeout remote déjà borné                                  | rules                         |
| Coût OpenAI                | facture fournisseur (externe)           | moyenne  | provider=rules                                             | —                             |
| Injection                  | `assistant_injection_suspected_total`   | moyenne  | ne pas bloquer auto (faux positifs) ; revue                | NLU ignore le jailbreak       |
| Remote down                | fallback_total                          | moyenne  | déjà repli rules                                           | rules                         |
| Trust faux positifs        | signal vs annonces légitimes            | élevée   | revue humaine, pas de ban auto                             | —                             |

Postmortem : impact utilisateurs réel, pas seulement HTTP 500. Ne pas diffuser de traces conversationnelles.
