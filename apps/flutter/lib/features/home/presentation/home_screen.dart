import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/listing/search_page.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../offline/offline_banner.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/widgets/brand_mark.dart';
import '../../../core/widgets/inline_async_section.dart';
import '../../../core/widgets/property_card.dart';
import '../../../core/widgets/search_field.dart';
import '../../../core/widgets/section_header.dart';
import '../../favorites/presentation/favorite_actions.dart';
import '../../favorites/presentation/favorites_providers.dart';
import '../../notifications/presentation/inbox_providers.dart';
import '../data/home_catalog.dart';
import 'home_feed_providers.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _openExplore(ExploreQuery query) {
    context.go(query.toLocation());
  }

  void _submitSearch(String raw) {
    final q = raw.trim();
    if (q.isEmpty) {
      _openExplore(const ExploreQuery());
      return;
    }
    _openExplore(ExploreQuery(q: q));
  }

  void _openListing(ListingSummary listing) {
    context.push(AppRoutes.listing(listing.listingId));
  }

  Future<void> _onFavorite(ListingSummary listing) {
    return toggleFavoriteFromCard(
      context: context,
      ref: ref,
      listing: listing,
      loginNext: AppRoutes.home,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final latest = ref.watch(latestListingsProvider);
    final recos = ref.watch(recommendationFeedProvider);
    final favorites = ref.watch(favoritesControllerProvider).value;
    final unread = ref.watch(inboxControllerProvider).value?.unread ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const BrandMark(height: 44),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go(AppRoutes.notifications),
            icon: unread <= 0
                ? const Icon(Icons.notifications_none_outlined)
                : Badge(
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: const Icon(Icons.notifications_none_outlined),
                  ),
          ),
        ],
      ),
      body: CustomScrollView(
        key: const PageStorageKey<String>('home-feed'),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bonjour', style: theme.textTheme.headlineSmall),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    'Trouvez votre chez-vous en Côte d\'Ivoire.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.mutedForeground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      const Icon(
                        Icons.place_outlined,
                        size: 18,
                        color: AppColors.mutedForeground,
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                      Expanded(
                        child: Text(
                          'Zone non définie — choisissez une commune',
                          style: theme.textTheme.bodySmall,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SearchField(
                    controller: _searchController,
                    onSubmitted: _submitSearch,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _AssistantEntry(
                    onTap: () => context.push(AppRoutes.assistant),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const SectionHeader(title: 'Catégories'),
                  SizedBox(
                    height: 96,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: HomeCatalog.categories.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(width: AppSpacing.sm),
                      itemBuilder: (context, index) {
                        final category = HomeCatalog.categories[index];
                        return _CategoryTile(
                          category: category,
                          onTap: () => _openExplore(category.query),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const SectionHeader(
                    title: 'Communes d\'Abidjan',
                    subtitle: 'Suggestions issues du référentiel Nest. Aucun volume d\'annonces n\'est affiché.',
                  ),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final area in HomeCatalog.areas)
                        ActionChip(
                          label: Text(area.name),
                          avatar: const Icon(
                            Icons.location_city_outlined,
                            size: 18,
                          ),
                          onPressed: () => _openExplore(area.query),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  SectionHeader(
                    title: 'Annonces récentes',
                    subtitle: 'GET /api/v1/search ? sort=NEWEST',
                    actionLabel: 'Voir tout',
                    onAction: () => _openExplore(latestHomeQuery),
                  ),
                  InlineAsyncSection<CachedRead<SearchPage>>(
                    asyncValue: latest,
                    onRetry: () => ref.invalidate(latestListingsProvider),
                    isEmpty: (page) => page.value.items.isEmpty,
                    emptyTitle: 'Aucune annonce récente',
                    emptyMessage: 'Le catalogue ne renvoie pas d\'annonce pour le moment.',
                    data: (page) => Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (page.fromCache)
                          StaleNotice(
                            cachedAt: page.fetchedAt,
                            fromCache: true,
                          ),
                        if (page.fromCache)
                          const SizedBox(height: AppSpacing.sm),
                        for (var i = 0; i < page.value.items.length; i++) ...[
                          if (i > 0) const SizedBox(height: AppSpacing.sm),
                          PropertyCard(
                            listing: page.value.items[i],
                            onTap: () => _openListing(page.value.items[i]),
                            onFavorite: () => _onFavorite(page.value.items[i]),
                            isFavorite:
                                favorites?.contains(
                                  page.value.items[i].listingId,
                                ) ??
                                false,
                            favoriteEnabled:
                                !(favorites?.isBusy(
                                      page.value.items[i].listingId,
                                    ) ??
                                    false),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  SectionHeader(
                    title: recos.maybeWhen(
                      data: (feed) => feed.value.title,
                      orElse: () => 'Découvrez des annonces',
                    ),
                    subtitle: recos.maybeWhen(
                      data: (feed) => feed.fromCache
                          ? 'Sélection enregistrée localement — pas une actualité.'
                          : feed.value.subtitle,
                      orElse: () => 'GET /api/v1/recommendations',
                    ),
                  ),
                  InlineAsyncSection(
                    asyncValue: recos,
                    onRetry: () => ref.invalidate(recommendationFeedProvider),
                    isEmpty: (feed) => feed.value.items.isEmpty,
                    emptyTitle: 'Aucune suggestion',
                    emptyMessage:
                        'Le moteur de recommandation Nest n\'a rien renvoyé.',
                    data: (feed) => Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (feed.fromCache)
                          StaleNotice(
                            cachedAt: feed.fetchedAt,
                            fromCache: true,
                          ),
                        if (feed.fromCache)
                          const SizedBox(height: AppSpacing.sm),
                        for (var i = 0; i < feed.value.items.length; i++) ...[
                          if (i > 0) const SizedBox(height: AppSpacing.sm),
                          PropertyCard(
                            listing: feed.value.items[i],
                            onTap: () => _openListing(feed.value.items[i]),
                            onFavorite: () => _onFavorite(feed.value.items[i]),
                            isFavorite:
                                favorites?.contains(
                                  feed.value.items[i].listingId,
                                ) ??
                                false,
                            favoriteEnabled:
                                !(favorites?.isBusy(
                                      feed.value.items[i].listingId,
                                    ) ??
                                    false),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssistantEntry extends StatelessWidget {
  const _AssistantEntry({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.accent,
      shape: const RoundedRectangleBorder(
        borderRadius: AppRadii.card,
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.card,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Assistant immobilier',
                      style: theme.textTheme.titleSmall,
                    ),
                    Text(
                      'Décrivez votre recherche en français. Les résultats viennent de Mon Appart.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});

  final HomeCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 92,
      child: Material(
        color: AppColors.card,
        shape: const RoundedRectangleBorder(
          borderRadius: AppRadii.button,
          side: BorderSide(color: AppColors.border),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadii.button,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(category.icon, color: AppColors.primary),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  category.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
