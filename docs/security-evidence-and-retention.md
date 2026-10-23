# Preuves, médias sensibles et conservation

## Séparation des stockages

- Photos d’annonce : Media `purpose = PROPERTY`, variantes WebP publiques après traitement.
- Pièces de vérification : Media `purpose = VERIFICATION`, bucket **privé**, jamais d’URL permanente. Accès : URL signée courte, permission `verification:documents`, audit.
- Pièces jointes de message : Media `purpose = MESSAGE`, accès participants.
- Pas de binaire dans PostgreSQL.

## Contrôles fichiers (déjà en place)

- Types et tailles limités, extensions contrôlées, clé serveur (renommage).
- Images : conversion WebP + `rotate()` Sharp, **EXIF retiré** (test `media-infrastructure.spec`).
- Documents : contrôle de contenu PDF ; antivirus branchable, non obligatoire.
- Identifiants de pièces : 404 uniforme si hors droit.

## Preuves d’incident

Conservées dans :

- `reports` / `report_events` (allégation + décision).
- `trust_signals` (faits : ids publics, compteurs — pas de PII, pas de corps de message).
- Extraordinaire conversationnel : extrait **à la consultation**, pas d’archive complète dédiée antifraude.
- Journal d’audit Identity / Trust / Listing.

Les historiques Trust sont en **ajout seul** (pas de suppression d’événement).

## Durées (pratiques techniques, pas un avis juridique)

| Donnée            | Pratique actuelle                       | Commentaire                                  |
| ----------------- | --------------------------------------- | -------------------------------------------- |
| Signalements      | Durée de vie du compte / de la cible    | Pas de TTL dédié ; à valider juridiquement   |
| Alertes           | Tant qu’ouvertes puis historisées       | Dédup tant que `OPEN`                        |
| Analytics         | `ANALYTICS_RETENTION_DAYS` (défaut 395) | Pas de texte de conversation                 |
| Pièces d’identité | Cycle Media + dossier vérification      | Ne pas conserver indéfiniment hors procédure |
| Messages          | Politique Communication existante       | Pas de copie antifraude supplémentaire       |

## Cadre ivoirien

La loi 2013-450 relative à la protection des données à caractère personnel et le rôle de l’ARTCI s’appliquent **en principe** à un responsable établi ou ciblant des personnes en Côte d’Ivoire. **Cette phrase n’est pas un avis juridique.** Distinguer :

- **Implémenté** : minimisation des alertes, accès par rôle, pas d’exposition du déclarant à la cible, 404 uniforme.
- **Bonne pratique** : durées de conservation écrites, registre des traitements, procédures d’accès / rectification / suppression.
- **À valider par un conseil** : bases légales du scoring interne, durée des pièces d’identité, communication d’un signalement à un tiers, obligations sectorielles immobilières.

Une vérification Mon Appart n’est **pas** une authentification juridique du bien.
