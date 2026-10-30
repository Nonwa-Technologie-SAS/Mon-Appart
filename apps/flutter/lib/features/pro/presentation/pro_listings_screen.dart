import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/listing/listing_status_labels.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/property_image.dart';
import '../../../core/widgets/status_badge.dart';
import '../../notifications/domain/relative_time.dart';
import '../domain/managed_listing.dart';
import '../domain/pro_snapshots.dart';
import 'pro_access.dart';
import 'pro_providers.dart';

const _statusFilters = <String?>[
  null,
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'PAUSED',
  'SUSPENDED',
  'EXPIRED',
  'RENTED',
  'SOLD',
  'ARCHIVED',
];

const _typeFilters = <String?>[null, 'RENT', 'SALE', 'LEASE_TO_OWN'];

class ProListingsScreen extends StatelessWidget {
  const ProListingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ProAccessScope(
      title: 'Mes annonces',
      nextRoute: AppRoutes.proListings,
      child: _ListingsBody(),
    );
  }
}

class _ListingsBody extends ConsumerWidget {
  const _ListingsBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(proListingsControllerProvider);
    return Column(
      children: [
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            children: [
              for (final status in _statusFilters)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.xs),
                  child: FilterChip(
                    label: Text(
                      status == null
                          ? 'Tous les statuts'
                          : ListingStatusLabels.of(status),
                    ),
                    selected: async.value?.status == status,
                    onSelected: (_) {
                      ref
                          .read(proListingsControllerProvider.notifier)
                          .setStatus(status);
                    },
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            children: [
              for (final type in _typeFilters)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.xs),
                  child: FilterChip(
                    label: Text(
                      type == null
                          ? 'Tous les types'
                          : ListingTypeLabel.of(type),
                    ),
                    selected: async.value?.listingType == type,
                    onSelected: (_) {
                      ref
                          .read(proListingsControllerProvider.notifier)
                          .setListingType(type);
                    },
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.xs,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => context.push(AppRoutes.publish),
              icon: const Icon(Icons.add_home_outlined),
              label: const Text('Nouvelle annonce'),
            ),
          ),
        ),
        Expanded(child: _ListingsList(async: async)),
      ],
    );
  }
}

class _ListingsList extends ConsumerWidget {
  const _ListingsList({required this.async});

  final AsyncValue<ProListingsSnapshot> async;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des annonces'),
      error: (error, _) => proFailureView(
        context: context,
        failure: asAppFailure(error),
        loginNext: AppRoutes.proListings,
        onRetry: () =>
            ref.read(proListingsControllerProvider.notifier).refresh(),
      ),
      data: (snapshot) {
        if (snapshot.items.isEmpty) {
          return AppEmptyState(
            icon: Icons.home_work_outlined,
            title: 'Aucune annonce',
            message:
                'Les annonces gérées par votre compte apparaissent ici. '
                'Vous pouvez créer un brouillon puis le soumettre à la modération.',
            actionLabel: 'Publier une annonce',
            onAction: () => context.push(AppRoutes.publish),
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(proListingsControllerProvider.notifier).refresh(),
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification.metrics.pixels >
                  notification.metrics.maxScrollExtent - 240) {
                ref.read(proListingsControllerProvider.notifier).loadMore();
              }
              return false;
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: snapshot.items.length + (snapshot.loadingMore ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                if (index >= snapshot.items.length) {
                  return const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return _ManagedListingCard(listing: snapshot.items[index]);
              },
            ),
          ),
        );
      },
    );
  }
}

class _ManagedListingCard extends ConsumerWidget {
  const _ManagedListingCard({required this.listing});

  final ManagedListing listing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.card,
      borderRadius: AppRadii.card,
      child: InkWell(
        borderRadius: AppRadii.card,
        onTap: () => context.push(AppRoutes.listing(listing.id)),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.md),
                child: SizedBox(
                  width: 96,
                  height: 96,
                  child: PropertyImage(
                    url: listing.coverUrl,
                    semanticLabel: 'Photo de ${listing.title}',
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(listing.title, style: theme.textTheme.titleMedium),
                    Text(
                      '${listing.listingTypeLabel} · ${listing.locationLabel}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    Text(listing.priceLabel, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: AppSpacing.xxs),
                    StatusBadge(
                      label: ListingStatusLabels.of(listing.status),
                      tone: ListingStatusLabels.tone(listing.status),
                    ),
                    if (listing.updatedAt != null)
                      Text(
                        'MAJ ${RelativeTime.format(listing.updatedAt!)}',
                        style: theme.textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
              PopupMenuButton<_ListingAction>(
                tooltip: 'Actions',
                onSelected: (action) =>
                    _onAction(context, ref, listing, action),
                itemBuilder: (context) => [
                  if (listing.status == 'DRAFT' ||
                      listing.status == 'PENDING_REVIEW')
                    const PopupMenuItem(
                      value: _ListingAction.resume,
                      child: Text('Reprendre le brouillon'),
                    ),
                  const PopupMenuItem(
                    value: _ListingAction.view,
                    child: Text('Consulter la fiche'),
                  ),
                  if (ListingManagerActions.canPublish(listing.status))
                    const PopupMenuItem(
                      value: _ListingAction.publish,
                      child: Text('Demander la publication'),
                    ),
                  if (ListingManagerActions.canPause(listing.status))
                    const PopupMenuItem(
                      value: _ListingAction.pause,
                      child: Text('Mettre en pause'),
                    ),
                  if (ListingManagerActions.canMarkRented(
                    listing.status,
                    listing.listingType,
                  ))
                    const PopupMenuItem(
                      value: _ListingAction.rented,
                      child: Text('Marquer comme louée'),
                    ),
                  if (ListingManagerActions.canMarkSold(
                    listing.status,
                    listing.listingType,
                  ))
                    const PopupMenuItem(
                      value: _ListingAction.sold,
                      child: Text('Marquer comme vendue'),
                    ),
                  if (ListingManagerActions.canArchive(listing.status))
                    const PopupMenuItem(
                      value: _ListingAction.archive,
                      child: Text('Archiver'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _ListingAction { resume, view, publish, pause, rented, sold, archive }

Future<void> _onAction(
  BuildContext context,
  WidgetRef ref,
  ManagedListing listing,
  _ListingAction action,
) async {
  if (action == _ListingAction.resume) {
    await context.push(AppRoutes.publishListing(listing.id));
    return;
  }
  if (action == _ListingAction.view) {
    await context.push(AppRoutes.listing(listing.id));
    return;
  }
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) {
      final (title, body) = switch (action) {
        _ListingAction.publish => (
          'Publier l\'annonce ?',
          'Le serveur décide du statut réel (publication ou revue).',
        ),
        _ListingAction.pause => (
          'Mettre en pause ?',
          'L\'annonce ne sera plus visible publiquement.',
        ),
        _ListingAction.rented => (
          'Marquer comme louée ?',
          'Cette action commerciale est définitive côté serveur.',
        ),
        _ListingAction.sold => (
          'Marquer comme vendue ?',
          'Cette action commerciale est définitive côté serveur.',
        ),
        _ListingAction.archive => (
          'Archiver l\'annonce ?',
          'L\'annonce quittera le suivi actif.',
        ),
        _ListingAction.view || _ListingAction.resume => ('', ''),
      };
      return AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirmer'),
          ),
        ],
      );
    },
  );
  if (confirmed != true || !context.mounted) {
    return;
  }
  final controller = ref.read(proListingsControllerProvider.notifier);
  try {
    switch (action) {
      case _ListingAction.publish:
        await controller.publish(listing.id);
      case _ListingAction.pause:
        await controller.pause(listing.id);
      case _ListingAction.rented:
        await controller.changeStatus(listing.id, 'RENTED');
      case _ListingAction.sold:
        await controller.changeStatus(listing.id, 'SOLD');
      case _ListingAction.archive:
        await controller.changeStatus(listing.id, 'ARCHIVED');
      case _ListingAction.view:
      case _ListingAction.resume:
        break;
    }
    if (!context.mounted) {
      return;
    }
    ManagedListing? updated;
    final items = ref.read(proListingsControllerProvider).value?.items ?? [];
    for (final item in items) {
      if (item.id == listing.id) {
        updated = item;
        break;
      }
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          updated == null
              ? 'Action enregistrée.'
              : 'Statut : ${ListingStatusLabels.of(updated.status)}',
        ),
      ),
    );
  } catch (error) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(asAppFailure(error).message)));
  }
}
