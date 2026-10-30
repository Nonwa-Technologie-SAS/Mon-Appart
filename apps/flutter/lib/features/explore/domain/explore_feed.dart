import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/listing/search_page.dart';
import '../../../core/search/explore_query.dart';

class ExploreFeed {
  const ExploreFeed({
    required this.query,
    required this.items,
    this.nextCursor,
    this.hasMore = false,
    this.totalLabel,
    this.loadingMore = false,
    this.loadMoreError,
  });

  final ExploreQuery query;
  final List<ListingSummary> items;
  final String? nextCursor;
  final bool hasMore;
  final String? totalLabel;
  final bool loadingMore;
  final AppFailure? loadMoreError;

  factory ExploreFeed.fromPage(ExploreQuery query, SearchPage page) {
    return ExploreFeed(
      query: query,
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      totalLabel: page.totalLabel,
    );
  }

  ExploreFeed mergePage(SearchPage page) {
    final seen = {for (final item in items) item.listingId};
    final extra = [
      for (final item in page.items)
        if (!seen.contains(item.listingId)) item,
    ];
    return ExploreFeed(
      query: query,
      items: [...items, ...extra],
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      totalLabel: totalLabel,
      loadingMore: false,
    );
  }

  ExploreFeed copyWith({
    bool? loadingMore,
    AppFailure? loadMoreError,
    bool clearLoadMoreError = false,
  }) {
    return ExploreFeed(
      query: query,
      items: items,
      nextCursor: nextCursor,
      hasMore: hasMore,
      totalLabel: totalLabel,
      loadingMore: loadingMore ?? this.loadingMore,
      loadMoreError: clearLoadMoreError
          ? null
          : (loadMoreError ?? this.loadMoreError),
    );
  }
}
