/// Tris Nest `SEARCH_SORTS`. `DISTANCE` uniquement si `lat`+`lng` sont envoyés.
class SearchSortOption {
  const SearchSortOption({required this.code, required this.label});

  final String code;
  final String label;
}

abstract final class SearchSorts {
  static const relevance = SearchSortOption(
    code: 'RELEVANCE',
    label: 'Pertinence',
  );
  static const newest = SearchSortOption(
    code: 'NEWEST',
    label: 'Plus récentes',
  );
  static const priceAsc = SearchSortOption(
    code: 'PRICE_ASC',
    label: 'Prix croissant',
  );
  static const priceDesc = SearchSortOption(
    code: 'PRICE_DESC',
    label: 'Prix décroissant',
  );
  static const surfaceAsc = SearchSortOption(
    code: 'SURFACE_ASC',
    label: 'Surface croissante',
  );
  static const surfaceDesc = SearchSortOption(
    code: 'SURFACE_DESC',
    label: 'Surface décroissante',
  );
  static const distance = SearchSortOption(code: 'DISTANCE', label: 'Distance');

  static const all = <SearchSortOption>[
    relevance,
    newest,
    priceAsc,
    priceDesc,
    surfaceAsc,
    surfaceDesc,
  ];

  static List<SearchSortOption> options({required bool hasGeo}) {
    if (!hasGeo) {
      return all;
    }
    return [...all, distance];
  }

  static SearchSortOption resolve(
    String? code, {
    required bool hasText,
    bool hasGeo = false,
  }) {
    final available = options(hasGeo: hasGeo);
    if (code != null) {
      for (final option in available) {
        if (option.code == code) {
          return option;
        }
      }
    }
    return hasText ? relevance : newest;
  }
}
