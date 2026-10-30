import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/offline/offline_messages.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/search/search_sort.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/property_card.dart';
import '../../../core/widgets/property_card_skeleton.dart';
import '../../../core/widgets/search_field.dart';
import '../../account/presentation/save_search_sheet.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../favorites/presentation/favorite_actions.dart';
import '../../favorites/presentation/favorites_providers.dart';
import '../domain/explore_feed.dart';
import 'explore_map_pane.dart';
import 'explore_providers.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key, required this.query});

  final ExploreQuery query;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  late final TextEditingController _controller;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.query.q ?? '');
    _scrollController.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(ExploreScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.query.q ?? '';
    if (_controller.text != next) {
      _controller.text = next;
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) {
      return;
    }
    final position = _scrollController.position;
    if (position.pixels > position.maxScrollExtent - 480) {
      ref.read(exploreControllerProvider(widget.query).notifier).loadMore();
    }
  }

  void _apply(ExploreQuery query) {
    context.go(query.toLocation());
  }

  void _openFilters() {
    context.push(widget.query.toLocation(path: AppRoutes.exploreFilters));
  }

  void _openListing(ListingSummary listing) {
    context.push(AppRoutes.listing(listing.listingId));
  }

  Future<void> _onFavorite(ListingSummary listing) {
    return toggleFavoriteFromCard(
      context: context,
      ref: ref,
      listing: listing,
      loginNext: widget.query.toLocation(),
    );
  }

  Future<void> _saveSearch() async {
    final session = ref.read(authControllerProvider).value;
    if (session?.isAuthenticated != true) {
      await context.push(AppRoutes.loginWithNext(widget.query.toLocation()));
      return;
    }
    if (!widget.query.hasUserIntent) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Ajoutez un critère avant d\'enregistrer la recherche.',
          ),
        ),
      );
      return;
    }
    final saved = await showSaveSearchSheet(
      context: context,
      query: widget.query,
    );
    if (saved != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Recherche « ${saved.name} » enregistrée.')),
      );
    }
  }

  void _submit(String value) {
    _apply(widget.query.copyWith(q: value.isEmpty ? null : value));
  }

  @override
  Widget build(BuildContext context) {
    final asyncFeed = ref.watch(exploreControllerProvider(widget.query));
    final sort = SearchSorts.resolve(
      widget.query.sort,
      hasText: widget.query.hasText,
      hasGeo: widget.query.hasGeo,
    );
    final filterCount = widget.query.activeFilterCount;
    final mapView = widget.query.isMapView;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Explorer'),
        actions: [
          IconButton(
            tooltip: 'Assistant immobilier',
            onPressed: () {
              final params = <String, String>{
                if (widget.query.hasText) 'q': widget.query.q!.trim(),
              };
              context.push(
                Uri(
                  path: AppRoutes.assistant,
                  queryParameters: params.isEmpty ? null : params,
                ).toString(),
              );
            },
            icon: const Icon(Icons.auto_awesome),
          ),
          IconButton(
            tooltip: 'Enregistrer la recherche',
            onPressed: _saveSearch,
            icon: const Icon(Icons.bookmark_add_outlined),
          ),
          IconButton(
            tooltip: mapView ? 'Vue liste' : 'Vue carte',
            onPressed: () {
              _apply(widget.query.copyWith(view: mapView ? null : 'map'));
            },
            icon: Icon(mapView ? Icons.view_list : Icons.map_outlined),
          ),
          IconButton(
            tooltip: filterCount == 0
                ? 'Filtres'
                : 'Filtres ($filterCount actifs)',
            onPressed: _openFilters,
            icon: Badge(
              isLabelVisible: filterCount > 0,
              label: Text('$filterCount'),
              child: const Icon(Icons.tune),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: SearchField(
              controller: _controller,
              onSubmitted: _submit,
              onChanged: (value) {
                if (value.isEmpty && widget.query.hasText) {
                  _submit('');
                }
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Texte transmis à GET /api/v1/search, sans interprétation IA.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                PopupMenuButton<String>(
                  key: const ValueKey<String>('explore-sort'),
                  tooltip: 'Trier',
                  offset: const Offset(0, 40),
                  initialValue: sort.code,
                  onSelected: (code) {
                    _apply(widget.query.copyWith(sort: code));
                  },
                  itemBuilder: (context) => [
                    for (final option in SearchSorts.options(
                      hasGeo: widget.query.hasGeo,
                    ))
                      PopupMenuItem(
                        value: option.code,
                        child: Text(option.label),
                      ),
                  ],
                  child: Row(
                    children: [
                      const Icon(Icons.sort, size: 20),
                      const SizedBox(width: AppSpacing.xxs),
                      Text(sort.label),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: mapView
                ? asyncFeed.when(
                    skipLoadingOnReload: true,
                    skipError: true,
                    loading: () => ExploreMapPane(
                      query: widget.query,
                      feed: asyncFeed.value,
                      loading: true,
                      onQueryChanged: _apply,
                      onOpenListing: _openListing,
                      onFavorite: (listing) => _onFavorite(listing),
                      isFavorite: (id) =>
                          ref
                              .watch(favoritesControllerProvider)
                              .value
                              ?.contains(id) ??
                          false,
                      favoriteEnabled: (id) =>
                          !(ref
                                  .watch(favoritesControllerProvider)
                                  .value
                                  ?.isBusy(id) ??
                              false),
                      onRetry: () {
                        ref
                            .read(
                              exploreControllerProvider(widget.query).notifier,
                            )
                            .retry();
                      },
                    ),
                    error: (error, _) => ExploreMapPane(
                      query: widget.query,
                      feed: asyncFeed.value,
                      loading: false,
                      stale: true,
                      onQueryChanged: _apply,
                      onOpenListing: _openListing,
                      onFavorite: (listing) => _onFavorite(listing),
                      isFavorite: (id) =>
                          ref
                              .watch(favoritesControllerProvider)
                              .value
                              ?.contains(id) ??
                          false,
                      favoriteEnabled: (id) =>
                          !(ref
                                  .watch(favoritesControllerProvider)
                                  .value
                                  ?.isBusy(id) ??
                              false),
                      onRetry: () {
                        ref
                            .read(
                              exploreControllerProvider(widget.query).notifier,
                            )
                            .retry();
                      },
                    ),
                    data: (feed) => ExploreMapPane(
                      query: widget.query,
                      feed: feed,
                      loading: false,
                      onQueryChanged: _apply,
                      onOpenListing: _openListing,
                      onFavorite: (listing) => _onFavorite(listing),
                      isFavorite: (id) =>
                          ref
                              .watch(favoritesControllerProvider)
                              .value
                              ?.contains(id) ??
                          false,
                      favoriteEnabled: (id) =>
                          !(ref
                                  .watch(favoritesControllerProvider)
                                  .value
                                  ?.isBusy(id) ??
                              false),
                      onRetry: () {
                        ref
                            .read(
                              exploreControllerProvider(widget.query).notifier,
                            )
                            .retry();
                      },
                    ),
                  )
                : asyncFeed.when(
                    skipLoadingOnReload: true,
                    loading: () => ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: const [
                        PropertyCardSkeleton(),
                        SizedBox(height: AppSpacing.sm),
                        PropertyCardSkeleton(),
                      ],
                    ),
                    error: (error, _) {
                      final failure = error is AppFailure
                          ? error
                          : UnexpectedFailure(message: error.toString());
                      return AppErrorView(
                        failure: OfflineMessages.exploreFailure(failure),
                        onRetry: () {
                          ref
                              .read(
                                exploreControllerProvider(widget.query)
                                    .notifier,
                              )
                              .retry();
                        },
                        title: 'Recherche impossible',
                      );
                    },
                    data: (feed) => _ResultsList(
                      feed: feed,
                      controller: _scrollController,
                      onOpenListing: _openListing,
                      onFavorite: (listing) => _onFavorite(listing),
                      onOpenFilters: _openFilters,
                      onRetryMore: () {
                        ref
                            .read(
                              exploreControllerProvider(widget.query).notifier,
                            )
                            .loadMore();
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ResultsList extends ConsumerWidget {
  const _ResultsList({
    required this.feed,
    required this.controller,
    required this.onOpenListing,
    required this.onFavorite,
    required this.onOpenFilters,
    required this.onRetryMore,
  });

  final ExploreFeed feed;
  final ScrollController controller;
  final ValueChanged<ListingSummary> onOpenListing;
  final ValueChanged<ListingSummary> onFavorite;
  final VoidCallback onOpenFilters;
  final VoidCallback onRetryMore;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (feed.items.isEmpty) {
      return AppEmptyState(
        title: 'Aucune annonce pour cette recherche',
        message: 'Essayez un autre quartier, un autre budget ou un type de bien différent.',
        actionLabel: 'Modifier les filtres',
        onAction: onOpenFilters,
      );
    }

    final extra =
        (feed.loadingMore ? 1 : 0) +
        (feed.loadMoreError != null ? 1 : 0) +
        (!feed.hasMore ? 1 : 0);

    return ListView.builder(
      key: const PageStorageKey<String>('explore-feed'),
      controller: controller,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xxl,
      ),
      itemCount: feed.items.length + 1 + extra,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Text(
              feed.totalLabel ??
                  (feed.query.hasUserIntent
                      ? 'Résultats'
                      : 'Dernières annonces'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          );
        }
        final itemIndex = index - 1;
        if (itemIndex < feed.items.length) {
          final listing = feed.items[itemIndex];
          final favorites = ref.watch(favoritesControllerProvider).value;
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: PropertyCard(
              listing: listing,
              onTap: () => onOpenListing(listing),
              onFavorite: () => onFavorite(listing),
              isFavorite: favorites?.contains(listing.listingId) ?? false,
              favoriteEnabled: !(favorites?.isBusy(listing.listingId) ?? false),
            ),
          );
        }
        if (feed.loadMoreError != null) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Column(
              children: [
                Text(
                  feed.loadMoreError!.message,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: AppColors.destructive),
                  textAlign: TextAlign.center,
                ),
                TextButton(
                  onPressed: onRetryMore,
                  child: const Text('Réessayer la suite'),
                ),
              ],
            ),
          );
        }
        if (feed.loadingMore) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        if (!feed.hasMore) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Text(
              'Fin des résultats',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}
