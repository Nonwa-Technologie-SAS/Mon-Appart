# Priorisation des leads

Source : `apps/api/src/modules/communication/inquiries/domain/inquiry-priority.ts`.  
Règles explicites, testables. **Pas de machine learning.** Pas de scoring sur des caractéristiques sensibles. Un budget n’implique pas une solvabilité.

## Points (ordre d’affichage HIGH ≥ 45, MEDIUM ≥ 25)

| Critère                                            | Points | Explication affichée                  |
| -------------------------------------------------- | ------ | ------------------------------------- |
| Visite en attente de confirmation                  | +40    | Une visite attend une confirmation    |
| Visite confirmée                                   | +20    | Une visite est confirmée              |
| Demande OPEN sans première réponse                 | +25    | Demande sans réponse                  |
| Sans réponse depuis plus de 24 h                   | +20    | Sans réponse depuis plus de 24 h      |
| Prochaine action échue                             | +18    | Prochaine action échue                |
| Budget déclaré entre 80 % et 125 % du prix affiché | +12    | Budget déclaré proche du prix affiché |
| Contact récent (< 6 h) encore OPEN                 | +8     | Contact récent                        |

Les stages `CONVERTED` / `ARCHIVED` sont plafonnés à 10 ; `LOST` à 5.

## Action suggérée

Priorité à confirmer une visite, puis répondre, puis qualifier, puis relancer après visite.
