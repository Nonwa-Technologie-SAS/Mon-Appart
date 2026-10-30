import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/json/json_map.dart';
import '../../../core/search/search_catalog.dart';
import '../domain/publish_draft.dart';
import '../domain/publish_rules.dart';

class PublishCatalogRepository {
  PublishCatalogRepository({required this.client, required this.endpoints});

  final ApiClient client;
  final ApiEndpoints endpoints;

  Future<List<CatalogOption>> propertyTypes() async {
    try {
      final raw = await client.getJsonList(endpoints.propertyTypes());
      final items = _parseOptions(raw, includeCategory: true);
      if (items.isNotEmpty) {
        return items;
      }
    } catch (_) {
      // Le référentiel seed reste le repli si le tableau Nest est illisible.
    }
    return [
      for (final entry in SearchCatalog.propertyTypes)
        CatalogOption(
          code: entry.code,
          name: entry.name,
          category: PublishRules.categoryOf(entry.code),
        ),
    ];
  }

  Future<List<CatalogOption>> amenities() async {
    try {
      final raw = await client.getJsonList(endpoints.amenities());
      final items = _parseOptions(raw, includeCategory: true);
      if (items.isNotEmpty) {
        return items;
      }
    } catch (_) {}
    return [
      for (final entry in SearchCatalog.amenities)
        CatalogOption(code: entry.code, name: entry.name),
    ];
  }

  List<CatalogOption> _parseOptions(
    List<Object?> raw, {
    required bool includeCategory,
  }) {
    final items = <CatalogOption>[];
    for (final item in raw) {
      final json = asJsonMapOrNull(item);
      if (json == null) {
        continue;
      }
      final code = asNonEmptyString(json['code']);
      final name = asNonEmptyString(json['name']) ?? code;
      if (code == null) {
        continue;
      }
      items.add(
        CatalogOption(
          code: code,
          name: name ?? code,
          category: includeCategory ? asNonEmptyString(json['category']) : null,
        ),
      );
    }
    return items;
  }
}
