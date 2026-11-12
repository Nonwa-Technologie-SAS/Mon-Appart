import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/property_image.dart';
import '../../favorites/presentation/favorite_actions.dart';
import '../../favorites/presentation/favorites_providers.dart';
import '../domain/compare_models.dart';
import '../domain/shortlist_entry.dart';
import 'compare_providers.dart';
import 'shortlist_providers.dart';

class CompareScreen extends ConsumerWidget {
  const CompareScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(shortlistControllerProvider);
    final report = ref.watch(compareReportProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          entries.isEmpty ? 'Comparaison' : 'Comparaison (${entries.length})',
        ),
        actions: [
          if (entries.isNotEmpty)
            IconButton(
              tooltip: 'Vider la sélection',
              onPressed: () =>
                  ref.read(shortlistControllerProvider.notifier).clear(),
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: entries.isEmpty
          ? AppEmptyState(
              icon: Icons.compare_arrows,
              title: 'Aucune annonce à comparer',
              message:
                  'Ajoutez 2 à 4 annonces depuis une fiche, les favoris ou l\'assistant. '
                  'Cette sélection reste sur cet appareil pendant la session : ce n\'est pas une liste synchronisée.',
              actionLabel: 'Explorer',
              onAction: () => context.go(AppRoutes.explore),
            )
          : report.when(
              skipLoadingOnReload: true,
              loading: () =>
                  const AppLoading(label: 'Chargement de la comparaison'),
              error: (error, _) => AppErrorView(
                failure: error is AppFailure
                    ? error
                    : UnexpectedFailure(message: error.toString()),
                title: 'Comparaison indisponible',
                onRetry: () => ref.invalidate(compareReportProvider),
              ),
              data: (value) => _CompareBody(report: value),
            ),
    );
  }
}

class _CompareBody extends ConsumerWidget {
  const _CompareBody({required this.report});

  final CompareReport report;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesControllerProvider).value;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xxl,
      ),
      children: [
        Text(
          'Les prix, surfaces et statuts viennent des fiches Nest. '
          'Aucun classement automatique n\'est inventé.',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: AppColors.mutedForeground),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final item in report.items) ...[
          _ListingHeader(
            item: item,
            isFavorite: favorites?.contains(item.entry.listingId) ?? false,
            favoriteEnabled:
                !(favorites?.isBusy(item.entry.listingId) ?? false),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (report.loadedCount < ShortlistLimits.minCompare)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Text(
              'Ajoutez encore ${ShortlistLimits.minCompare - report.loadedCount} annonce(s) publiée(s) pour afficher le tableau.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        if (report.insights.isNotEmpty) ...[
          Text('Synthèse', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          for (final insight in report.insights)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Text('• ${insight.text}'),
            ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (report.rows.isNotEmpty) ...[
          Text('Critères', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          _CriteriaMatrix(report: report),
          const SizedBox(height: AppSpacing.md),
        ],
        if (report.questions.isNotEmpty) ...[
          Text(
            'À vérifier avant de décider',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final question in report.questions)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Text('• $question'),
            ),
        ],
      ],
    );
  }
}

class _ListingHeader extends ConsumerWidget {
  const _ListingHeader({
    required this.item,
    required this.isFavorite,
    required this.favoriteEnabled,
  });

  final CompareItem item;
  final bool isFavorite;
  final bool favoriteEnabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listing = item.listing;
    final theme = Theme.of(context);
    return Material(
      color: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: AppRadii.card,
        side: BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: item.isLoaded
            ? () => context.push(AppRoutes.listing(item.entry.listingId))
            : null,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            children: [
              SizedBox(
                width: 72,
                height: 72,
                child: PropertyImage(
                  url: listing?.coverUrl,
                  semanticLabel: 'Photo de ${item.entry.title}',
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.entry.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                    Text(
                      switch (item.status) {
                        CompareItemStatus.loaded =>
                          listing?.priceLabel ?? 'Prix sur demande',
                        CompareItemStatus.unavailable =>
                          'Annonce plus disponible',
                        CompareItemStatus.failed =>
                          item.errorMessage ?? 'Chargement impossible',
                      },
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: item.status == CompareItemStatus.loaded
                            ? AppColors.mutedForeground
                            : AppColors.destructive,
                      ),
                    ),
                  ],
                ),
              ),
              if (item.isLoaded)
                IconButton(
                  tooltip: 'Favori',
                  onPressed: favoriteEnabled
                      ? () => toggleFavoriteForListing(
                          context: context,
                          ref: ref,
                          listingId: item.entry.listingId,
                          title: item.entry.title,
                          propertyId: item.entry.propertyId,
                          loginNext: AppRoutes.compare,
                        )
                      : null,
                  icon: Icon(
                    isFavorite ? Icons.favorite : Icons.favorite_border,
                  ),
                ),
              IconButton(
                tooltip: 'Retirer de la comparaison',
                onPressed: () => ref
                    .read(shortlistControllerProvider.notifier)
                    .remove(item.entry.listingId),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CriteriaMatrix extends StatelessWidget {
  const _CriteriaMatrix({required this.report});

  final CompareReport report;

  @override
  Widget build(BuildContext context) {
    final loaded = report.loaded;
    const labelWidth = 108.0;
    const colWidth = 140.0;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: MediaQuery.sizeOf(context).width - 32,
        ),
        child: Table(
          defaultVerticalAlignment: TableCellVerticalAlignment.middle,
          columnWidths: {
            0: const FixedColumnWidth(labelWidth),
            for (var i = 0; i < loaded.length; i++)
              i + 1: const FixedColumnWidth(colWidth),
          },
          border: TableBorder.all(color: AppColors.border, width: 0.5),
          children: [
            TableRow(
              decoration: const BoxDecoration(color: AppColors.muted),
              children: [
                const _Cell(text: 'Critère', header: true),
                for (final item in loaded)
                  _Cell(text: item.listing!.listingTypeLabel, header: true),
              ],
            ),
            for (final row in report.rows)
              TableRow(
                children: [
                  _Cell(text: row.label, header: true),
                  for (final cell in row.cells)
                    _Cell(
                      text: cell.value,
                      missing: cell.missing,
                      emphasized: cell.emphasized,
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.text,
    this.header = false,
    this.missing = false,
    this.emphasized = false,
  });

  final String text;
  final bool header;
  final bool missing;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xs),
      child: Text(
        text,
        style:
            (header ? theme.textTheme.labelMedium : theme.textTheme.bodySmall)
                ?.copyWith(
                  color: missing ? AppColors.mutedForeground : null,
                  fontWeight: emphasized ? FontWeight.w600 : null,
                ),
      ),
    );
  }
}
