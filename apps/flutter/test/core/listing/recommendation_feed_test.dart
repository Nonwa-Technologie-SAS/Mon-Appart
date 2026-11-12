import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/listing/recommendation_feed.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('GENERIC ne se présente pas comme une reco personnalisée', () {
    final feed = RecommendationFeed.fromJson(
      recommendationResponseJson(level: 'GENERIC'),
    );
    expect(feed.level, RecommendationLevel.generic);
    expect(feed.title, 'Découvrez des annonces');
    expect(feed.subtitle, contains('pas de recommandation personnalisée'));
    expect(feed.items, hasLength(1));
  });

  test('PREFERENCES expose le niveau Nest', () {
    final feed = RecommendationFeed.fromJson(
      recommendationResponseJson(level: 'PREFERENCES'),
    );
    expect(feed.title, 'Selon vos préférences');
  });
}
