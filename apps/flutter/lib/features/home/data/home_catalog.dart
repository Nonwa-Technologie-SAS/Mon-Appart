import 'package:flutter/material.dart';

import '../../../core/search/explore_query.dart';

/// Catégorie d'accueil mappée sur des filtres Nest existants.
class HomeCategory {
  const HomeCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.query,
  });

  final String id;
  final String label;
  final IconData icon;
  final ExploreQuery query;
}

/// Zone géographique issue du seed Nest `COMMUNES` (Abidjan).
///
/// Source : `apps/api/prisma/seed/reference-data.ts`.
/// Aucun volume d'annonces n'est affiché : le seed n'en fournit pas.
class DiscoveryArea {
  const DiscoveryArea({
    required this.code,
    required this.name,
    required this.query,
  });

  final String code;
  final String name;
  final ExploreQuery query;
}

/// Catalogue statique documenté. Pas de statistiques inventées.
abstract final class HomeCatalog {
  static const categories = <HomeCategory>[
    HomeCategory(
      id: 'rent',
      label: 'À louer',
      icon: Icons.key_outlined,
      query: ExploreQuery(listingType: 'RENT'),
    ),
    HomeCategory(
      id: 'sale',
      label: 'À acheter',
      icon: Icons.home_work_outlined,
      query: ExploreQuery(listingType: 'SALE'),
    ),
    HomeCategory(
      id: 'land',
      label: 'Terrains',
      icon: Icons.landscape_outlined,
      query: ExploreQuery(propertyType: 'LAND'),
    ),
    HomeCategory(
      id: 'short_term',
      label: 'Meublés',
      icon: Icons.weekend_outlined,
      query: ExploreQuery(listingType: 'SHORT_TERM_RENT'),
    ),
    HomeCategory(
      id: 'residence',
      label: 'Résidences',
      icon: Icons.apartment_outlined,
      query: ExploreQuery(propertyType: 'RESIDENCE'),
    ),
  ];

  static const areas = <DiscoveryArea>[
    DiscoveryArea(
      code: 'COCODY',
      name: 'Cocody',
      query: ExploreQuery(city: 'ABIDJAN', commune: 'COCODY'),
    ),
    DiscoveryArea(
      code: 'MARCORY',
      name: 'Marcory',
      query: ExploreQuery(city: 'ABIDJAN', commune: 'MARCORY'),
    ),
    DiscoveryArea(
      code: 'YOPOUGON',
      name: 'Yopougon',
      query: ExploreQuery(city: 'ABIDJAN', commune: 'YOPOUGON'),
    ),
    DiscoveryArea(
      code: 'PLATEAU',
      name: 'Plateau',
      query: ExploreQuery(city: 'ABIDJAN', commune: 'PLATEAU'),
    ),
    DiscoveryArea(
      code: 'BINGERVILLE',
      name: 'Bingerville',
      query: ExploreQuery(city: 'ABIDJAN', commune: 'BINGERVILLE'),
    ),
    DiscoveryArea(
      code: 'TREICHVILLE',
      name: 'Treichville',
      query: ExploreQuery(city: 'ABIDJAN', commune: 'TREICHVILLE'),
    ),
  ];
}
