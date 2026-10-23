# Politique de vérification propriétaires et agences

Source de vérité : [trust-and-verification.md](./trust-and-verification.md). Ce document précise la **proportionnalité** pour le marché ivoirien. Il ne crée pas de second dossier d’identité.

## Niveaux (lecture produit, pas un enum public)

| Niveau produit                 | Faits techniques                                                     |
| ------------------------------ | -------------------------------------------------------------------- |
| Compte créé                    | Utilisateur Identity actif                                           |
| Coordonnées confirmées         | `PHONE` / `EMAIL` via OTP Identity                                   |
| Profil professionnel renseigné | Rôles OWNER / AGENCY / AGENT + fiche                                 |
| Identité examinée              | `IDENTITY` VERIFIED, non échu                                        |
| Organisation examinée          | `AGENCY` VERIFIED (RCCM / carte pro)                                 |
| Mandat / autorisation examiné  | `OWNER_AUTHORIZATION` VERIFIED + relation `AGENT`/`MANAGER` courante |
| Propriété déclarée examinée    | `PROPERTY_OWNERSHIP` VERIFIED + relation `SOLE`/`JOINT`/`USUFRUCT`   |
| Cohérence d’annonce examinée   | `LISTING_CONSISTENCY` VERIFIED                                       |
| Complément requis              | `NEEDS_MORE_INFORMATION`                                             |
| Refusée / expirée / révoquée   | `REJECTED` / `EXPIRED` / `REVOKED`                                   |

## Ce qu’une vérification ne prouve pas

- Un e-mail confirmé ne prouve pas l’identité.
- Une identité examinée ne prouve pas la propriété d’un terrain ou d’un logement.
- Un mandat examiné n’est pas un titre foncier.
- Un dossier `VERIFIED` n’est pas une garantie juridique Mon Appart.

## Exigences proportionnées

- Publication courante : exigences Listing existantes (`missingPublicationRequirements`), pas une pièce d’identité pour chaque annonce.
- Terrain : un permis de construire ne suffit pas ; un titre / ACD / lettre d’attribution selon les groupes documentaires déjà codés.
- Agence : RCCM ou carte professionnelle, **après** identité.
- Pièces facultatives pour `LISTING_CONSISTENCY`.

Ne pas demander systématiquement un titre foncier à un particulier qui publie une location simple si la politique Listing en vigueur ne l’exige pas.

## Modification après vérification

Champs notables : titre, description, type d’offre, photos, localisation, contact. Une modification notable **ouvre une alerte** `MATERIAL_CHANGE_AFTER_VERIFICATION` et demande une réévaluation. Elle **ne révoque pas** le dossier. Un changement d’échéance n’est pas notable.

## Libellés publics

Utiliser les badges existants (`BADGE_LABELS`, `BADGE_DISCLAIMER`) : « Identité vérifiée », « Droit de publication vérifié », avec date et avertissement. Jamais « propriétaire garanti » ni « bien sans risque ».
