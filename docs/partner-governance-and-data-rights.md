# Gouvernance et droits de diffusion

## Responsabilités

| Acteur | Responsabilité |
| ------ | -------------- |
| Partenaire | Exactitude des annonces fournies, mise à jour disponibilités |
| Mon Appart | Contrôles Trust/modération, diffusion selon droits, isolation données |
| Utilisateur final | Usage conforme CGU |

## Règles

- Pas de scraping concurrent.
- Pas de republication externe sans droits.
- Annonce partenaire soumise aux mêmes contrôles qu’une annonce interne.
- Fin de partenariat : suspendre intégrations (`SUSPENDED`/`RETIRED`), conserver historique livraisons/imports selon rétention.
- Secrets : rotation = nouvelle intégration webhook + révocation ancienne.
- Données analytiques partenaires : agrégats autorisés uniquement, pas de revente PII.

## Validation juridique

Prévoir revue ARTCI / conseil pour données personnelles, responsabilité annonces, et tout encaissement immobilier pour tiers (hors scope Billing plateforme).
