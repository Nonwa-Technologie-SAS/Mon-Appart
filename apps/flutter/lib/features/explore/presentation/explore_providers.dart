import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/search/explore_query.dart';
import '../domain/explore_feed.dart';

class ExploreController extends AsyncNotifier<ExploreFeed> {
  ExploreController(this.query);

  final ExploreQuery query;
  var _generation = 0;

  @override
  Future<ExploreFeed> build() async {
    final generation = ++_generation;
    final page = await ref
        .read(searchRepositoryProvider)
        .search(query, submit: query.hasUserIntent);
    if (generation != _generation) {
      return state.value ?? ExploreFeed.fromPage(query, page);
    }
    return ExploreFeed.fromPage(query, page);
  }

  void retry() {
    ref.invalidateSelf();
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null ||
        current.loadingMore ||
        !current.hasMore ||
        current.nextCursor == null) {
      return;
    }
    final generation = _generation;
    state = AsyncData(
      current.copyWith(loadingMore: true, clearLoadMoreError: true),
    );
    try {
      final page = await ref
          .read(searchRepositoryProvider)
          .search(current.query, cursor: current.nextCursor);
      if (generation != _generation) {
        return;
      }
      state = AsyncData(current.mergePage(page));
    } catch (error) {
      if (generation != _generation) {
        return;
      }
      final failure = error is AppFailure
          ? error
          : UnexpectedFailure(message: error.toString());
      state = AsyncData(
        current.copyWith(loadingMore: false, loadMoreError: failure),
      );
    }
  }
}

final exploreControllerProvider =
    AsyncNotifierProvider.family<ExploreController, ExploreFeed, ExploreQuery>(
      ExploreController.new,
      retry: (_, _) => null,
    );
