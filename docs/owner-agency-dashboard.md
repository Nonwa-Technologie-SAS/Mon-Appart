# Tableau de bord propriétaire / agence

Route UI : `/espace`. API : `GET /api/v1/inquiries/dashboard`.

Les indicateurs sont calculés sur les biens dont l’utilisateur est gestionnaire **courant**. Aucun chiffre de démonstration.

| Indicateur               | Définition                                                        | Fenêtre |
| ------------------------ | ----------------------------------------------------------------- | ------- |
| Nouveaux contacts        | Inquiries créées                                                  | 7 jours |
| Non traitées             | `status = OPEN` et `firstRespondedAt` nul                         | stock   |
| Actions échues           | `nextActionAt ≤ maintenant`, hors LOST/ARCHIVED/CONVERTED         | stock   |
| Visites à confirmer      | Appointments `PENDING`                                            | stock   |
| Visites à venir          | `CONFIRMED` et `scheduledAt ≥ maintenant`                         | stock   |
| Visites réalisées        | `COMPLETED`                                                       | cumul   |
| Taux de réponse          | `firstRespondedAt` non nul / total inquiries                      | cumul   |
| Délai médian 1ʳᵉ réponse | médiane des délais, 200 derniers répondus                         | —       |
| Contacts → visite        | inquiries avec au moins une visite CONFIRMED ou COMPLETED / total | cumul   |
| Top annonces             | volume de contacts, 5 premières                                   | cumul   |

Dénominateur d’un taux : total des demandes accessibles, pas une cohorte lissée. Un petit volume ne doit pas être interprété comme une tendance.

Une visite réalisée **n’est pas** une transaction.
