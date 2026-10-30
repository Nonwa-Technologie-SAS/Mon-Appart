import '../json/json_map.dart';
import 'listing_summary.dart';

enum RecommendationLevel { generic, preferences, behavior, unknown }

class RecommendationFeed {
  const RecommendationFeed({
    required this.items,
    required this.level,
    this.degraded = false,
  });

  final List<ListingSummary> items;
  final RecommendationLevel level;
  final bool degraded;

  /// Titre honnête : ne prétend pas une personnalisation si le niveau est GENERIC.
  String get title {
    return switch (level) {
      RecommendationLevel.preferences => 'Selon vos préférences',
      RecommendationLevel.behavior => 'D\'après votre activité',
      RecommendationLevel.generic ||
      RecommendationLevel.unknown => 'Découvrez des annonces',
    };
  }

  String get subtitle {
    return switch (level) {
      RecommendationLevel.preferences =>
        'Classement Nest d\'après le profil déclaré.',
      RecommendationLevel.behavior =>
        'Classement Nest d\'après l\'activité récente.',
      RecommendationLevel.generic || RecommendationLevel.unknown => 'Sélection générale du catalogue — pas de recommandation personnalisée.',
    };
  }

  static RecommendationLevel parseLevel(Object? raw) {
    return switch (raw) {
      'GENERIC' => RecommendationLevel.generic,
      'PREFERENCES' => RecommendationLevel.preferences,
      'BEHAVIOR' => RecommendationLevel.behavior,
      _ => RecommendationLevel.unknown,
    };
  }

  static RecommendationFeed fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    final items = <ListingSummary>[];
    if (rawItems is List) {
      for (final raw in rawItems) {
        final map = asJsonMapOrNull(raw);
        final listing = ListingSummary.tryFromJson(map?['listing']);
        if (listing != null) {
          items.add(listing);
        }
      }
    }
    final meta = asJsonMapOrNull(json['meta']);
    return RecommendationFeed(
      items: items,
      level: parseLevel(meta?['level']),
      degraded: meta?['degraded'] == true,
    );
  }
}
