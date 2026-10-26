# Playbook de modération Trust & Safety

À l’usage des rôles `MODERATOR` et `TRUST_OFFICER`. Les actions définitives suivent les permissions existantes.

## Traitement d’un signalement

1. Lire le motif et la description. Ne pas conclure.
2. Ouvrir la cible (annonce / compte) dans le back-office.
3. Consulter le niveau `listing-risk-v1` et les alertes ouvertes : ce sont des **indices**.
4. Si conversation : s’en tenir à l’extrait fourni.
5. En cas de conflit d’intérêts (bien géré, participant), l’API refuse (`CONFLICT_OF_INTEREST`).
6. Demander un complément via vérification si les faits manquent — ne pas inventer une pièce.
7. Décider `CONFIRMED` ou `DISMISSED` avec une note interne factuelle.
8. Choisir une mesure **proportionnée** et réversible quand elle est temporaire.

## Correspondance risque → action (aide, pas automate)

| Niveau             | Piste                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| LOW / MONITOR      | Classer, surveiller                                                                                       |
| MODERATE / REVIEW  | Assigner, éventuellement `VERIFICATION_REVIEW_REQUESTED`                                                  |
| HIGH / HOLD        | Ne pas publier davantage ; suspendre **seulement** si les faits humains le justifient (`listing:suspend`) |
| CRITICAL / PROTECT | Escalade TRUST_OFFICER ; mesures Listing / Identity existantes ; **pas** de contact autorités automatique |

## Faux positifs fréquents

- Plusieurs annonces d’une même agence (téléphone, photos, adresse).
- Variation de prix légitime (négociation, correction).
- Pic d’annonces après un mandat de portefeuille.
- Message « passe sur WhatsApp » sans autre signal.
- Lien court vers un plan de visite.

## Ce qu’il ne faut pas faire

- Suspendre sur le seul volume de signalements.
- Révoquer une vérification parce qu’un titre a changé.
- Copier un extrait de conversation hors de l’outil.
- Promettre à un utilisateur que le bien est « authentifié ».
