import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/favorite_button.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../compare/domain/shortlist_entry.dart';
import '../../compare/presentation/compare_actions.dart';
import '../../compare/presentation/shortlist_providers.dart';
import '../../offline/offline_banner.dart';
import '../domain/favorite_item.dart';
import 'favorite_actions.dart';
import 'favorites_providers.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    final compareCount = ref.watch(shortlistControllerProvider).length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Favoris'),
        actions: [
          IconButton(
            tooltip: compareCount == 0
                ? 'Comparaison'
                : 'Comparaison ($compareCount)',
            onPressed: () => context.push(AppRoutes.compare),
            icon: Badge(
              isLabelVisible: compareCount > 0,
              label: Text('$compareCount'),
              child: const Icon(Icons.compare_arrows),
            ),
          ),
        ],
      ),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.favorite_border,
              title: 'Aucun favori enregistré',
              message: 'Connectez-vous pour synchroniser vos favoris avec le serveur.',
              actionLabel: 'Se connecter',
              onAction: () =>
                  context.push(AppRoutes.loginWithNext(AppRoutes.favorites)),
            )
          : const _FavoriteList(),
    );
  }
}

class _FavoriteList extends ConsumerWidget {
  const _FavoriteList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncFavs = ref.watch(favoritesControllerProvider);
    return asyncFavs.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des favoris'),
      error: (error, _) => AppEmptyState(
        icon: Icons.wifi_off_outlined,
        title: 'Favoris indisponibles',
        message: error is AppFailure
            ? error.message
            : 'Impossible de charger vos favoris.',
        actionLabel: 'Réessayer',
        onAction: () => ref.invalidate(favoritesControllerProvider),
      ),
      data: (snapshot) {
        if (snapshot.items.isEmpty) {
          return AppEmptyState(
            icon: Icons.favorite_border,
            title: 'Aucun favori enregistré',
            message:
                'Ajoutez une annonce depuis sa fiche, l\'accueil ou Explorer.',
            actionLabel: 'Explorer',
            onAction: () => context.go(AppRoutes.explore),
          );
        }
        final showNotice = snapshot.fromCache || snapshot.queued.isNotEmpty;
        return ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.md),
          itemCount: snapshot.items.length + (showNotice ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, index) {
            if (showNotice && index == 0) {
              return StaleNotice(
                cachedAt: snapshot.cachedAt,
                fromCache: snapshot.fromCache,
                queued: snapshot.queued.isNotEmpty,
              );
            }
            final item = snapshot.items[index - (showNotice ? 1 : 0)];
            return _FavoriteTile(
              item: item,
              busy: snapshot.isBusy(item.listingId),
              queued: snapshot.isQueued(item.listingId),
            );
          },
        );
      },
    );
  }
}

class _FavoriteTile extends ConsumerWidget {
  const _FavoriteTile({
    required this.item,
    required this.busy,
    this.queued = false,
  });

  final FavoriteItem item;
  final bool busy;
  final bool queued;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final inCompare = ref
        .watch(shortlistControllerProvider)
        .any((entry) => entry.listingId == item.listingId);
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: ListTile(
        title: Text(item.title),
        subtitle: Text(
          queued
              ? 'En attente d\'envoi au serveur. Pas encore confirmé.'
              : 'Prix, localisation et photo : ouvrir la fiche. '
                    'La liste Nest ne fournit que le titre.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: AppColors.mutedForeground,
          ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: inCompare
                  ? 'Retirer de la comparaison'
                  : 'Ajouter à la comparaison',
              visualDensity: VisualDensity.compact,
              onPressed: () => toggleShortlistWithFeedback(
                context: context,
                ref: ref,
                entry: ShortlistEntry(
                  listingId: item.listingId,
                  title: item.title,
                  propertyId: item.propertyId,
                ),
              ),
              icon: Icon(
                inCompare
                    ? Icons.compare_arrows
                    : Icons.compare_arrows_outlined,
              ),
            ),
            FavoriteButton(
              isFavorite: true,
              enabled: !busy,
              onPressed: () => toggleFavoriteForListing(
                context: context,
                ref: ref,
                listingId: item.listingId,
                title: item.title,
                propertyId: item.propertyId,
                loginNext: AppRoutes.favorites,
              ),
            ),
          ],
        ),
        onTap: () => context.push(AppRoutes.listing(item.listingId)),
      ),
    );
  }
}
