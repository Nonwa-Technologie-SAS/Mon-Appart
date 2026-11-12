import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/listing/recommendation_feed.dart';
import '../../../core/listing/search_page.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/search/explore_query.dart';

const latestHomeQuery = ExploreQuery(sort: 'NEWEST', limit: 5);

final latestListingsProvider =
    FutureProvider.autoDispose<CachedRead<SearchPage>>((ref) {
      return ref
          .watch(searchRepositoryProvider)
          .readHomeLatest(latestHomeQuery);
    }, retry: (_, _) => null);

final recommendationFeedProvider =
    FutureProvider.autoDispose<CachedRead<RecommendationFeed>>((ref) {
      return ref.watch(recommendationRepositoryProvider).readHomeFeed(limit: 8);
    }, retry: (_, _) => null);
