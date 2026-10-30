/// Référentiels de filtres issus du seed Nest
/// `apps/api/prisma/seed/reference-data.ts`.
///
/// `GET /api/v1/property-types` et `GET /api/v1/amenities` (tableaux JSON)
/// sont lus via `getJsonList` pour la publication. Le catalogue statique
/// reste le repli (recherche / filtres) aligné sur le seed Nest.
class CatalogEntry {
  const CatalogEntry({required this.code, required this.name});

  final String code;
  final String name;
}

class CommuneEntry {
  const CommuneEntry({
    required this.code,
    required this.name,
    required this.neighborhoods,
  });

  final String code;
  final String name;
  final List<CatalogEntry> neighborhoods;
}

abstract final class SearchCatalog {
  static const listingTypes = <CatalogEntry>[
    CatalogEntry(code: 'RENT', name: 'À louer'),
    CatalogEntry(code: 'SALE', name: 'À vendre'),
    CatalogEntry(code: 'SHORT_TERM_RENT', name: 'Meublé'),
    CatalogEntry(code: 'LEASE_TO_OWN', name: 'Location-vente'),
  ];

  static const propertyTypes = <CatalogEntry>[
    CatalogEntry(code: 'APARTMENT', name: 'Appartement'),
    CatalogEntry(code: 'STUDIO', name: 'Studio'),
    CatalogEntry(code: 'HOUSE', name: 'Maison'),
    CatalogEntry(code: 'VILLA', name: 'Villa'),
    CatalogEntry(code: 'DUPLEX', name: 'Duplex'),
    CatalogEntry(code: 'RESIDENCE', name: 'Résidence meublée'),
    CatalogEntry(code: 'LAND', name: 'Terrain'),
    CatalogEntry(code: 'OFFICE', name: 'Bureau'),
    CatalogEntry(code: 'SHOP', name: 'Magasin'),
    CatalogEntry(code: 'WAREHOUSE', name: 'Entrepôt'),
    CatalogEntry(code: 'BUILDING', name: 'Immeuble'),
  ];

  static const amenities = <CatalogEntry>[
    CatalogEntry(code: 'PARKING', name: 'Parking'),
    CatalogEntry(code: 'SWIMMING_POOL', name: 'Piscine'),
    CatalogEntry(code: 'SECURITY', name: 'Gardiennage'),
    CatalogEntry(code: 'AIR_CONDITIONING', name: 'Climatisation'),
    CatalogEntry(code: 'GARDEN', name: 'Jardin'),
    CatalogEntry(code: 'GENERATOR', name: 'Groupe électrogène'),
    CatalogEntry(code: 'WATER_TANK', name: 'Réserve d\'eau'),
    CatalogEntry(code: 'ELEVATOR', name: 'Ascenseur'),
    CatalogEntry(code: 'BALCONY', name: 'Balcon'),
    CatalogEntry(code: 'FURNISHED', name: 'Meublé'),
    CatalogEntry(code: 'WIFI', name: 'Wi-Fi'),
    CatalogEntry(code: 'FITTED_KITCHEN', name: 'Cuisine équipée'),
  ];

  static const city = CatalogEntry(code: 'ABIDJAN', name: 'Abidjan');

  static const communes = <CommuneEntry>[
    CommuneEntry(
      code: 'COCODY',
      name: 'Cocody',
      neighborhoods: [
        CatalogEntry(code: 'RIVIERA', name: 'Riviera'),
        CatalogEntry(code: 'ANGRE', name: 'Angré'),
        CatalogEntry(code: 'DEUX_PLATEAUX', name: 'Deux Plateaux'),
        CatalogEntry(code: 'BLOCKHAUS', name: 'Blockhaus'),
      ],
    ),
    CommuneEntry(
      code: 'MARCORY',
      name: 'Marcory',
      neighborhoods: [
        CatalogEntry(code: 'ZONE_4', name: 'Zone 4'),
        CatalogEntry(code: 'BIETRY', name: 'Biétry'),
        CatalogEntry(code: 'ANOUMABO', name: 'Anoumabo'),
      ],
    ),
    CommuneEntry(
      code: 'YOPOUGON',
      name: 'Yopougon',
      neighborhoods: [
        CatalogEntry(code: 'NIANGON', name: 'Niangon'),
        CatalogEntry(code: 'SELMER', name: 'Selmer'),
        CatalogEntry(code: 'TOITS_ROUGES', name: 'Toits Rouges'),
      ],
    ),
    CommuneEntry(
      code: 'ABOBO',
      name: 'Abobo',
      neighborhoods: [
        CatalogEntry(code: 'AVOCATIER', name: 'Avocatier'),
        CatalogEntry(code: 'PK18', name: 'PK 18'),
      ],
    ),
    CommuneEntry(
      code: 'PLATEAU',
      name: 'Plateau',
      neighborhoods: [
        CatalogEntry(code: 'CENTRE_AFFAIRES', name: 'Centre des affaires'),
        CatalogEntry(code: 'PLATEAU_DOKUI', name: 'Plateau Dokui'),
      ],
    ),
    CommuneEntry(
      code: 'TREICHVILLE',
      name: 'Treichville',
      neighborhoods: [
        CatalogEntry(code: 'ARRAS', name: 'Arras'),
        CatalogEntry(code: 'BIAFRA', name: 'Biafra'),
      ],
    ),
    CommuneEntry(
      code: 'ADJAME',
      name: 'Adjamé',
      neighborhoods: [
        CatalogEntry(code: 'WILLIAMSVILLE', name: 'Williamsville'),
        CatalogEntry(code: 'BRACODI', name: 'Bracodi'),
      ],
    ),
    CommuneEntry(
      code: 'PORT_BOUET',
      name: 'Port-Bouët',
      neighborhoods: [
        CatalogEntry(code: 'VRIDI', name: 'Vridi'),
        CatalogEntry(code: 'GONZAGUEVILLE', name: 'Gonzagueville'),
      ],
    ),
    CommuneEntry(
      code: 'KOUMASSI',
      name: 'Koumassi',
      neighborhoods: [
        CatalogEntry(code: 'REMBLAIS', name: 'Remblais'),
        CatalogEntry(code: 'SOPIM', name: 'Sopim'),
      ],
    ),
    CommuneEntry(
      code: 'ATTECOUBE',
      name: 'Attécoubé',
      neighborhoods: [
        CatalogEntry(code: 'LOCODJORO', name: 'Locodjoro'),
        CatalogEntry(code: 'SANTE', name: 'Santé'),
      ],
    ),
    CommuneEntry(
      code: 'ANYAMA',
      name: 'Anyama',
      neighborhoods: [
        CatalogEntry(code: 'ANYAMA_CENTRE', name: 'Anyama Centre'),
      ],
    ),
    CommuneEntry(
      code: 'BINGERVILLE',
      name: 'Bingerville',
      neighborhoods: [
        CatalogEntry(code: 'BINGERVILLE_CENTRE', name: 'Bingerville Centre'),
        CatalogEntry(code: 'FEH_KESSE', name: 'Féh Kessé'),
      ],
    ),
  ];

  static CommuneEntry? communeByCode(String? code) {
    if (code == null) {
      return null;
    }
    for (final commune in communes) {
      if (commune.code == code) {
        return commune;
      }
    }
    return null;
  }

  /// Catégories Nest `PROPERTY_TYPES` (seed). Surchargées par GET /property-types.
  static const propertyTypeCategories = <String, String>{
    'APARTMENT': 'RESIDENTIAL',
    'STUDIO': 'RESIDENTIAL',
    'HOUSE': 'RESIDENTIAL',
    'VILLA': 'RESIDENTIAL',
    'DUPLEX': 'RESIDENTIAL',
    'RESIDENCE': 'RESIDENTIAL',
    'LAND': 'LAND',
    'OFFICE': 'COMMERCIAL',
    'SHOP': 'COMMERCIAL',
    'WAREHOUSE': 'INDUSTRIAL',
    'BUILDING': 'MIXED',
  };

  /// Points approximatifs issus du seed de développement, pas un géocodage.
  static const neighborhoodCoordinates = <String, (double, double)>{
    'RIVIERA': (5.359, -3.958),
    'ZONE_4': (5.293, -3.985),
    'FEH_KESSE': (5.3558, -3.8854),
  };

  static (double, double)? approximateCoordinates(String? neighborhoodCode) {
    if (neighborhoodCode == null) {
      return null;
    }
    return neighborhoodCoordinates[neighborhoodCode];
  }
}
