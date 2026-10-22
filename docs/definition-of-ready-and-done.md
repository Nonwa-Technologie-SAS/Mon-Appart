# Definition of Ready / Done

## Definition of Ready (prêt à développer)

Applicable aux features à risque moyen/élevé :

- [ ] Problème utilisateur formulé
- [ ] Segment identifié
- [ ] Règles métier essentielles connues
- [ ] Critères d’acceptation testables
- [ ] Dépendances listées (API, DB, flags, providers)
- [ ] Risques connus (sécu, migration, perf)
- [ ] Effort estimé + **niveau de confiance** explicite

Petites fixes : ticket clair + critère de vérif suffisent.

## Definition of Done

Selon le périmètre :

- [ ] Implémentation
- [ ] Revue (processus équipe)
- [ ] Tests pertinents exécutés
- [ ] Critères d’acceptation vérifiés
- [ ] Erreurs / empty states gérés
- [ ] Sécu / auth vérifiées si applicable
- [ ] Docs mises à jour si besoin
- [ ] Tracking si mesure prévue
- [ ] Flag documenté si utilisé
- [ ] Plan deploy/rollback si risque élevé

### Niveaux de « terminé »

| Niveau | Signification |
| --- | --- |
| Dev done | Mergeable, CI verte |
| Staging validated | Smoke + parcours critiques staging |
| Production live | Déployé + monitoring OK |

Ne pas confondre les trois.
