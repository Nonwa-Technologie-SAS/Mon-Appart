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
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../offline/offline_banner.dart';
import '../domain/visit.dart';
import '../domain/visit_labels.dart';
import '../domain/visits_snapshot.dart';
import 'visits_providers.dart';

class VisitsScreen extends ConsumerWidget {
  const VisitsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes visites'),
        actions: [
          IconButton(
            tooltip: 'Tournée de visites',
            onPressed: () => context.push(AppRoutes.visitTour),
            icon: const Icon(Icons.route_outlined),
          ),
        ],
      ),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.lock_outline,
              title: 'Connexion requise',
              message:
                  'Connectez-vous pour consulter vos demandes de visite. '
                  'L\'accès à chaque rendez-vous reste contrôlé par le serveur.',
              actionLabel: 'Se connecter',
              onAction: () =>
                  context.push(AppRoutes.loginWithNext(AppRoutes.visits)),
            )
          : const _VisitsBody(),
    );
  }
}

class _VisitsBody extends ConsumerWidget {
  const _VisitsBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(visitsControllerProvider);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            0,
          ),
          child: SegmentedButton<VisitListScope>(
            segments: const [
              ButtonSegment(
                value: VisitListScope.upcoming,
                label: Text('À venir'),
              ),
              ButtonSegment(value: VisitListScope.past, label: Text('Passées')),
            ],
            selected: {async.value?.scope ?? VisitListScope.upcoming},
            onSelectionChanged: (selected) {
              ref
                  .read(visitsControllerProvider.notifier)
                  .setScope(selected.first);
            },
          ),
        ),
        Expanded(child: _VisitsList(async: async)),
      ],
    );
  }
}

class _VisitsList extends ConsumerWidget {
  const _VisitsList({required this.async});

  final AsyncValue<VisitsSnapshot> async;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des visites'),
      error: (error, _) {
        final failure = error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString());
        if (failure is HttpFailure && failure.isUnauthenticated) {
          return AppEmptyState(
            icon: Icons.lock_outline,
            title: 'Session expirée',
            message: failure.message,
            actionLabel: 'Se connecter',
            onAction: () =>
                context.push(AppRoutes.loginWithNext(AppRoutes.visits)),
          );
        }
        return AppErrorView(
          failure: failure,
          onRetry: () => ref.read(visitsControllerProvider.notifier).refresh(),
        );
      },
      data: (snapshot) {
        if (snapshot.items.isEmpty) {
          return AppEmptyState(
            icon: Icons.event_available_outlined,
            title: snapshot.scope == VisitListScope.past
                ? 'Aucune visite passée'
                : 'Aucune visite prévue',
            message:
                'Demandez une visite depuis la fiche d\'un bien. '
                'Une demande envoyée n\'est pas un rendez-vous confirmé.',
            actionLabel: 'Découvrir les biens',
            onAction: () => context.go(AppRoutes.explore),
          );
        }
        final groups = _groupByDay(snapshot.items);
        final header = snapshot.fromCache ? 1 : 0;
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(visitsControllerProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: groups.length + header,
            itemBuilder: (context, index) {
              if (header == 1 && index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: StaleNotice(
                    cachedAt: snapshot.cachedAt,
                    fromCache: true,
                  ),
                );
              }
              final group = groups[index - header];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(
                      top: AppSpacing.sm,
                      bottom: AppSpacing.xs,
                    ),
                    child: Text(
                      group.$1,
                      style: Theme.of(context).textTheme.titleSmall
                          ?.copyWith(color: AppColors.mutedForeground),
                    ),
                  ),
                  for (final visit in group.$2) ...[
                    _VisitTile(visit: visit),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                ],
              );
            },
          ),
        );
      },
    );
  }

  static List<(String, List<Visit>)> _groupByDay(List<Visit> items) {
    final groups = <(String, List<Visit>)>[];
    for (final visit in items) {
      final header = VisitLabels.dayHeader(visit.scheduledAt);
      if (groups.isEmpty || groups.last.$1 != header) {
        groups.add((header, [visit]));
      } else {
        groups.last.$2.add(visit);
      }
    }
    return groups;
  }
}

class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit});

  final Visit visit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.card,
      borderRadius: AppRadii.card,
      child: InkWell(
        borderRadius: AppRadii.card,
        onTap: () => context.push(AppRoutes.appointment(visit.id)),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.event_outlined),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      VisitLabels.counterpart(visit),
                      style: theme.textTheme.titleMedium,
                    ),
                    Text(
                      VisitLabels.dateTime(visit.scheduledAt),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    if (!visit.isRequester)
                      Text(
                        visit.listingTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall,
                      ),
                    const SizedBox(height: AppSpacing.xxs),
                    StatusBadge(
                      label: VisitLabels.status(visit.status),
                      tone: VisitLabels.tone(visit.status),
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
}
