# Support mobile (lot 23)

## Audit

| Domaine       | État existant                                                                                      | Réutilisable                                     | Manquant                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Centre d'aide | Aucun CMS, aucun article Nest                                                                      | Design System, navigation Compte                 | Contenus administrables                                                  |
| Assistant IA  | `POST /ai-assistant/search` : recherche d'annonces publiées                                        | Écran assistant existant                         | Base documentaire de support, escalade humaine                           |
| Messagerie    | Conversations Nest, signalement `POST /conversations/:id/report`                                   | Fil et feuille de signalement                    | Boîte conseiller unifiée                                                 |
| Tickets       | Pas de ticket général                                                                              | —                                                | Création, réponses, pièces, réouverture                                  |
| Réclamations  | `Report` : annonce, compte, message, conversation. Statuts publics `OPEN`, `IN_REVIEW`, `RESOLVED` | `GET/POST /trust/reports`, file admin `/reports` | Description et historique non renvoyés au déclarant                      |
| WhatsApp      | Fournisseur de notification `NOTIFICATION_WHATSAPP_PROVIDER` branché sur `null`                    | Lien `wa.me` si un numéro est compilé            | WhatsApp Business Platform, webhooks, modèles                            |
| Téléphone     | Aucun numéro dans le dépôt                                                                         | `url_launcher` déjà utilisé pour les cartes      | Numéro officiel, horaires, enregistrement d'appel                        |
| Notifications | Inbox. Type `REPORT` : « Signalement reçu » puis « Signalement examiné »                           | Libellé déjà connu                               | Le mobile n'ouvre pas le dossier : le payload `reportId` n'est pas routé |
| Back-office   | File de signalements et résolution modérateur                                                      | Notes internes déjà cachées au déclarant         | Pas de CRM, pas de présence conseiller                                   |

Un lien `wa.me` n'est pas WhatsApp Business. Le fournisseur de notification est explicitement `null`. Aucun conseiller n'est marqué disponible.

## Réalisé

- Écran **Centre d'aide** depuis le compte : recherche locale, articles qui décrivent l'application réelle, accès à l'assistant de recherche et à Mes signalements.
- **Signaler cette annonce** sur la fiche : `POST /trust/reports` avec `targetType: LISTING`. Pas de priorité choisie par l'utilisateur. Le texte rappelle qu'il n'y a ni suspension automatique ni mot de passe à saisir.
- **Mes signalements** : `GET /trust/reports`. `RESOLVED` est affiché « Examiné », sans dire si le motif a été retenu. `CONFIRMED` n'est pas un statut public et est rejeté au parsing.
- Téléphone et WhatsApp uniquement si `SUPPORT_PHONE` ou `SUPPORT_WHATSAPP` est un E.164 compilé. Le message WhatsApp est fixe et sans donnée personnelle. L'écran dit que ces échanges ne sont pas recopiés dans les signalements.

## Non réalisé

Ticket général, chatbot de support, RAG, transfert à un humain, horaires, email de support, pièces jointes de réclamation, deep link vers un dossier, synchronisation WhatsApp, tableau de bord conseiller supplémentaire.

## API utilisées

Déjà présentes, non inventées :

- `POST /api/v1/trust/reports` — session, permission `report:create`. Corps `{ targetType, listingId, reason, description? }`. 409 si un signalement est déjà ouvert sur la cible, 429 au-delà de la limite quotidienne.
- `GET /api/v1/trust/reports` — les siens, 100 derniers, sans pagination par curseur.
- `GET /api/v1/trust/reports/:reportId` — non branché : la liste suffit, la réponse ne contient ni description ni historique.
- `POST /api/v1/conversations/:id/report` — déjà utilisé dans la messagerie.

## API absente

Un ticket d'assistance (sujet, catégorie hors confiance, réponses visibles, pièces, réouverture) n'existe pas. Le documenter avant de l'ajouter. Ne pas le simuler dans Flutter.

## Sécurité

Le déclarant ne reçoit pas `resolutionNote` ni `internalNote`. Le client refuse un statut hors `OPEN | IN_REVIEW | RESOLVED`. Les liens externes acceptés sont `tel:` E.164 et `https://wa.me/` avec le texte fixe. Aucun secret dans les defines : un numéro de support est public par nature.

## Limites

Pas de numéro configuré dans les exemples du dépôt. Pas de test sur appareil. Pas de compilation iOS depuis Windows. La publication store reste NO-GO (lot 20).
