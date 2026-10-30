import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/router/deep_link_resolver.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../account/presentation/account_providers.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/device_notification_permission.dart';
import '../domain/inbox_notification.dart';
import '../domain/notification_destination.dart';
import '../domain/relative_time.dart';
import 'inbox_providers.dart';
import 'push_providers.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    final snapshot = ref.watch(inboxControllerProvider).value;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (session?.isAuthenticated == true && (snapshot?.unread ?? 0) > 0)
            TextButton(
              onPressed: snapshot?.markingAll == true
                  ? null
                  : () async {
                      try {
                        await ref
                            .read(inboxControllerProvider.notifier)
                            .markAllRead();
                      } on AppFailure catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(error.message)),
                          );
                        }
                      }
                    },
              child: const Text('Tout lu'),
            ),
          IconButton(
            tooltip: 'Préférences',
            onPressed: () => context.push(AppRoutes.notificationPreferences),
            icon: const Icon(Icons.tune),
          ),
        ],
      ),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.notifications_none_outlined,
              title: 'Connexion requise',
              message: 'Les alertes immobilières et messages in-app nécessitent une session.',
              actionLabel: 'Se connecter',
              onAction: () => context.push(
                AppRoutes.loginWithNext(AppRoutes.notifications),
              ),
            )
          : const _InboxList(),
    );
  }
}

class _InboxList extends ConsumerWidget {
  const _InboxList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncInbox = ref.watch(inboxControllerProvider);
    return asyncInbox.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des notifications'),
      error: (error, _) => AppEmptyState(
        icon: Icons.wifi_off_outlined,
        title: 'Notifications indisponibles',
        message: error is AppFailure
            ? error.message
            : 'Impossible de charger l\'inbox.',
        actionLabel: 'Réessayer',
        onAction: () => ref.invalidate(inboxControllerProvider),
      ),
      data: (snapshot) {
        return Column(
          children: [
            const _PermissionBanner(),
            if (snapshot.actionError case final AppFailure failure)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  0,
                ),
                child: Text(
                  failure.message,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: AppColors.destructive),
                ),
              ),
            Expanded(
              child: snapshot.items.isEmpty
                  ? AppEmptyState(
                      icon: Icons.notifications_none_outlined,
                      title: 'Aucune notification pour le moment',
                      message:
                          'Les digests de recherches enregistrées et les baisses de prix '
                          'des favoris apparaîtront ici. Le push natif n\'est pas livré : '
                          'aucun fournisseur FCM/APNs n\'est configuré côté serveur.',
                      actionLabel: 'Recherches enregistrées',
                      onAction: () => context.push(AppRoutes.savedSearches),
                    )
                  : RefreshIndicator(
                      onRefresh: () =>
                          ref.read(inboxControllerProvider.notifier).refresh(),
                      child: NotificationListener<ScrollNotification>(
                        onNotification: (notification) {
                          if (notification.metrics.extentAfter < 240 &&
                              snapshot.hasMore &&
                              !snapshot.loadingMore) {
                            unawaited(
                              ref
                                  .read(inboxControllerProvider.notifier)
                                  .loadMore(),
                            );
                          }
                          return false;
                        },
                        child: ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(AppSpacing.md),
                          itemCount:
                              snapshot.items.length +
                              (snapshot.hasMore || snapshot.loadingMore
                                  ? 1
                                  : 0),
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (context, index) {
                            if (index >= snapshot.items.length) {
                              return const Padding(
                                padding: EdgeInsets.symmetric(
                                  vertical: AppSpacing.md,
                                ),
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              );
                            }
                            final item = snapshot.items[index];
                            return _InboxTile(
                              item: item,
                              pending: snapshot.isPending(item.id),
                              onOpen: () => _open(context, ref, item),
                            );
                          },
                        ),
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _open(
    BuildContext context,
    WidgetRef ref,
    InboxNotification item,
  ) async {
    if (!item.isRead) {
      try {
        await ref.read(inboxControllerProvider.notifier).markRead(item.id);
      } on AppFailure {
        // La navigation reste possible même si le marquage échoue.
      }
    }
    if (!context.mounted) {
      return;
    }
    final destination = NotificationDestination.fromInbox(item);
    if (destination.kind == NotificationKind.savedSearch &&
        destination.id != null) {
      try {
        final query = await ref
            .read(savedSearchRepositoryProvider)
            .resume(destination.id!);
        if (context.mounted) {
          context.go(query.toLocation());
        }
      } on AppFailure catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(error.message)));
          await context.push(AppRoutes.savedSearch(destination.id!));
        }
      }
      return;
    }
    final location = DeepLinkResolver().locationFor(destination);
    if (location == null) {
      return;
    }
    await context.push(location);
  }
}

class _InboxTile extends StatelessWidget {
  const _InboxTile({
    required this.item,
    required this.pending,
    required this.onOpen,
  });

  final InboxNotification item;
  final bool pending;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: item.isRead ? AppColors.card : AppColors.accent,
      borderRadius: AppRadii.card,
      child: InkWell(
        borderRadius: AppRadii.card,
        onTap: pending ? null : onOpen,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                _iconFor(item.category),
                color: item.isRead
                    ? AppColors.mutedForeground
                    : AppColors.primary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: item.isRead
                                  ? FontWeight.w500
                                  : FontWeight.w700,
                            ),
                          ),
                        ),
                        if (!item.isRead)
                          const StatusBadge(
                            label: 'Non lu',
                            tone: StatusBadgeTone.accent,
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      NotificationCatalog.categoryLabel(item.category),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    if (item.body.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(item.body, style: theme.textTheme.bodyMedium),
                    ],
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      RelativeTime.format(item.createdAt),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _iconFor(String category) {
    return switch (category) {
      'MESSAGES' => Icons.chat_bubble_outline,
      'VISITS' || 'APPOINTMENT_REMINDERS' => Icons.event_outlined,
      'RECOMMENDATIONS' => Icons.auto_awesome_outlined,
      'PRICE_DROPS' => Icons.trending_down,
      'SAVED_SEARCHES' => Icons.saved_search_outlined,
      'LISTING_UPDATES' => Icons.home_work_outlined,
      'ACCOUNT' => Icons.security_outlined,
      'MARKETING' => Icons.campaign_outlined,
      _ => Icons.notifications_outlined,
    };
  }
}

class _PermissionBanner extends ConsumerWidget {
  const _PermissionBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncPermission = ref.watch(notificationPermissionControllerProvider);
    final state = asyncPermission.value;
    if (state == null ||
        state == NotificationPermissionState.unavailable ||
        state == NotificationPermissionState.granted) {
      return const SizedBox.shrink();
    }
    final permanently = state == NotificationPermissionState.permanentlyDenied;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        0,
      ),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: AppColors.muted,
          borderRadius: AppRadii.card,
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Alertes sur cet appareil',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                permanently
                    ? 'Les notifications système sont désactivées. '
                          'Vous pouvez les activer dans les paramètres de l\'appareil. '
                          'L\'application reste utilisable sans elles.'
                    : 'Autorisez les notifications pour être prévenu des nouvelles '
                          'annonces et des messages. Cette demande n\'est pas faite '
                          'au premier lancement. Le serveur n\'envoie pas encore de push.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: AppColors.mutedForeground),
              ),
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () {
                    final controller = ref.read(
                      notificationPermissionControllerProvider.notifier,
                    );
                    if (permanently) {
                      unawaited(controller.openSettings());
                    } else {
                      unawaited(controller.request());
                    }
                  },
                  child: Text(
                    permanently ? 'Ouvrir les paramètres' : 'Autoriser',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
