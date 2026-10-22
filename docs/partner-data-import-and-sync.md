# Import et synchronisation partenaires

## Mode V1 : validation CSV (dry-run)

Adaptateur `CsvPropertyFeedAdapter` (`PropertyFeedAdapter`).

Colonnes obligatoires :

`externalListingId,title,listingType,propertyTypeCode,communeCode,amount,pricePeriod`

Optionnelles : `bedrooms,surface,description`.

Règles :

- Montants XOF positifs.
- `SALE` ⇒ `pricePeriod=ONCE` ; location ⇒ pas `ONCE`.
- Doublons d’`externalListingId` dans le fichier rejetés.
- Max 500 lignes.
- Fichier invalide → lot `REJECTED` / `PARTIAL` journalisé ; **aucune** écriture Listing/Property.

Endpoint : `POST /api/v1/admin/partners/:id/imports/csv/validate`.

## Application future

1. Rapprocher `externalListingId` via `PartnerListingLink`.
2. Créer/mettre à jour via services Listing + Property.
3. Passer Trust / modération (partenaire connu ≠ annonce exacte).
4. Ne pas supprimer une annonce métier sur une seule erreur sync temporaire (`syncStatus`).

## Synchronisation

Outbox `PartnerDelivery` pour **événements sortants** Mon Appart → partenaire.  
Import périodique / webhooks entrants partenaires : stubs de kind seulement.
