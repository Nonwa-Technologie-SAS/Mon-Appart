# Catalogue des événements métier

Les noms ci-dessous sont ceux **effectivement émis** dans le dépôt. La version de schéma est `event_version` (défaut 1), pas un suffixe `.v1`.

Charges utiles : identifiants publics et codes. Jamais de mot de passe, jeton, pièce d’identité, IBAN ni conversation complète.

## Identité

| Nom                                      | Producteur | Consommateurs | Quand                | Payload            | Reprise          |
| ---------------------------------------- | ---------- | ------------- | -------------------- | ------------------ | ---------------- |
| `identity.user_registered`               | identity   | analytics     | Inscription commitée | `channels`, `role` | Outbox           |
| `identity.account_status_changed`        | identity   | —             | Décision admin       | `from`, `to`       | Outbox           |
| `identity.user_logged_in` / `logged_out` | identity   | —             | Session              | ids publics        | emit hors outbox |

## Propriétés et annonces

| Nom                                                            | Producteur | Consommateurs                     | Quand                                                | Payload                                  |
| -------------------------------------------------------------- | ---------- | --------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `property.created` / `updated` / `deleted`                     | property   | search, reco                      | TX métier                                            | `propertyId`, `changedFields?`           |
| `property.media_changed`                                       | media      | search, reco                      | Après ordre / primaire / suppression publique        | `propertyId`, `reason`                   |
| `listing.created`                                              | listing    | search, analytics, trust          | TX création                                          | `listingId`, `propertyId`, `listingType` |
| `listing.updated`                                              | listing    | search, analytics                 | Champs réellement modifiés                           | `listingId`, `changedFields`             |
| `listing.published` / `paused` / `expired` / `sold` / `rented` | listing    | search, reco, analytics, partners | Transition de statut                                 | `listingId`, `propertyId`, `from`, `to`  |
| `listing.status_changed`                                       | listing    | search                            | Autres statuts (SUSPENDED, ARCHIVED, PENDING_REVIEW) | idem                                     |
| `listing.price_changed`                                        | listing    | search, reco                      | Nouveau prix courant                                 | montants en texte, `currency`, `period`  |
| `listing.deleted`                                              | listing    | search, reco                      | Archivage logique                                    | `listingId`, `previousStatus`            |

`listing.expired` est aussi produit par `ListingExpiryRunner` (worker).

## Leads et visites

| Nom                                  | Producteur    | Consommateurs     | Quand                            |
| ------------------------------------ | ------------- | ----------------- | -------------------------------- |
| `conversation.created`               | communication | analytics, trust  | Premier contact                  |
| `appointment.changed`                | communication | analytics         | Demande ou transition de visite  |
| `message.sent`                       | communication | analytics, safety | Après commit (emit, hors outbox) |
| `inquiry.stage_changed` / `assigned` | communication | analytics         | Pipeline CRM                     |

## Paiements

Uniquement après confirmation prestataire persistée. Jamais depuis une redirection navigateur.

| Nom                                                    | Producteur | Consommateurs | Idempotence                      |
| ------------------------------------------------------ | ---------- | ------------- | -------------------------------- |
| `billing.payment_succeeded` / `failed`                 | billing    | analytics     | Statut unique + incidents        |
| `billing.subscription_started` / `renewed`             | billing    | analytics     | `fulfillment` ALREADY / CONFLICT |
| `billing.checkout_started`, tentatives, remboursements | billing    | —             | emit ou outbox selon le flux     |

## Trust

`trust.report_created`, `trust.report_resolved`, `trust.signal_raised` : emit après commit (file métier Trust inchangée).

## Analytics / recherche / reco

Consommateurs, pas producteurs de faits métier. `search.performed` ne contient pas le texte saisi.

## Compatibilité

- Ajout de champ facultatif : `event_version` inchangé.
- Changement sémantique : incrémenter `event_version` et adapter les consommateurs.
- Ne pas retirer un champ obligatoire sans version.

Confidentialité : les logs d’outbox portent `event_id`, `event_type`, `aggregate_id`, `correlation_id` — pas le payload.
