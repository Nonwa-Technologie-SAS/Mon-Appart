# Imports d’annonces autorisés

**Date :** 2026-10-22 · Voir [partner-data-import-and-sync.md](./partner-data-import-and-sync.md)

---

## 1. Sources autorisées

- Soumission par le titulaire (owner / agence)
- Lot fourni par agence avec **mandat / accord** documenté
- Intégration contractuelle Partner
- Données dont les conditions d’usage le permettent
- Saisie manuelle assistée avec provenance notée

**Interdit :** import massif depuis concurrents, Facebook, WhatsApp sans droits ; contournement de protections.

---

## 2. CSV V1 (dry-run)

Endpoint : `POST /api/v1/admin/partners/:partnerId/imports/csv/validate`

Colonnes obligatoires :

```
externalListingId,title,listingType,propertyTypeCode,communeCode,amount,pricePeriod
```

Optionnelles : `bedrooms,surface,description`

Règles : XOF positifs ; SALE ⇒ period ONCE (adapter selon adapter) ; max 500 lignes ; doublons `externalListingId` rejetés ; **aucune** écriture Property/Listing en V1.

### Exemple (données fictives de démo interne)

```csv
externalListingId,title,listingType,propertyTypeCode,communeCode,amount,pricePeriod,bedrooms,surface,description
DEMO-EXT-001,Appartement 2 pièces fictif Cocody,RENT,APARTMENT,ABIDJAN_COCODY,250000,MONTH,2,75,Exemple interne — ne pas publier en production
```

---

## 3. Traçabilité lot

Conserver : partenaire, filename, rowCount, accepted/rejected, rapport JSON (`PartnerImportBatch`), responsable, date, preuve d’autorisation (hors DB si besoin — coffre ops).

Contestations : procédure de retrait lot + listings liés via `PartnerListingLink` (quand application live).

---

## 4. Application future (non livrée)

Créer/MAJ via services Property+Listing → Trust/modération → pas de suppression métier sur erreur sync temporaire.
