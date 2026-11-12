import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../notifications/domain/relative_time.dart';
import '../domain/listing_stats.dart';
import '../domain/pro_snapshots.dart';
import 'pro_access.dart';
import 'pro_providers.dart';

class ProDashboardScreen extends ConsumerWidget {
  const ProDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final label =
        ref.watch(authControllerProvider).value?.user?.publisherSpaceLabel ??
        'Espace pro';
    return ProAccessScope(
      title: label,
      nextRoute: AppRoutes.pro,
      child: const _DashboardBody(),
    );
  }
}

class _DashboardBody extends ConsumerWidget {
  const _DashboardBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(proDashboardControllerProvider);
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement du tableau de bord'),
      error: (error, _) => proFailureView(
        context: context,
        failure: asAppFailure(error),
        loginNext: AppRoutes.pro,
        onRetry: () =>
            ref.read(proDashboardControllerProvider.notifier).refresh(),
      ),
      data: (snapshot) {
        final dashboard = snapshot.dashboard;
        if (dashboard == null) {
          return const AppEmptyState(
            icon: Icons.insights_outlined,
            title: 'Tableau de bord indisponible',
            message: 'Les indicateurs n\'ont pas pu être chargés.',
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(proDashboardControllerProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Activité commerciale',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text(
                'Fenêtre Nest : ${dashboard.windowDays} jours. '
                'Mis à jour ${RelativeTime.format(dashboard.computedAt)}.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _MetricCard(
                    label: 'Non traitées',
                    value: '${dashboard.unhandled}',
                    hint: 'Demandes ouvertes sans première réponse',
                    onTap: () => context.push(AppRoutes.proLeads),
                  ),
                  _MetricCard(
                    label: 'Nouveaux contacts',
                    value: '${dashboard.newContacts}',
                    hint: 'Créés sur ${dashboard.windowDays} jours',
                    onTap: () => context.push(AppRoutes.proLeads),
                  ),
                  _MetricCard(
                    label: 'Visites à confirmer',
                    value: '${dashboard.pendingVisits}',
                    hint: 'Demandes PENDING, pas des rendez-vous confirmés',
                    onTap: () => context.push(AppRoutes.visits),
                  ),
                  _MetricCard(
                    label: 'Visites à venir',
                    value: '${dashboard.confirmedUpcomingVisits}',
                    hint: 'Confirmées et encore planifiées',
                    onTap: () => context.push(AppRoutes.visits),
                  ),
                  _MetricCard(
                    label: 'Taux de réponse',
                    value: ProPercent.format(dashboard.responseRate),
                    hint: 'Demandes avec une première réponse / total',
                    onTap: () => context.push(AppRoutes.proLeads),
                  ),
                  _MetricCard(
                    label: 'Contacts → visite',
                    value: ProPercent.format(dashboard.contactToVisitRate),
                    hint: 'Demandes liées à une visite confirmée ou effectuée',
                    onTap: () => context.push(AppRoutes.visits),
                  ),
                  if (dashboard.medianFirstResponseHours != null)
                    _MetricCard(
                      label: 'Délai médian 1re réponse',
                      value: '${dashboard.medianFirstResponseHours} h',
                      hint: 'Sur les demandes déjà répondues',
                    ),
                  if (dashboard.overdueActions > 0)
                    _MetricCard(
                      label: 'Actions échues',
                      value: '${dashboard.overdueActions}',
                      hint: 'Prochaine action dépassée',
                      onTap: () => context.push(AppRoutes.proLeads),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              _AnalyticsSection(snapshot: snapshot),
              if (dashboard.topListings.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Annonces les plus contactées',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                for (final item in dashboard.topListings)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.title),
                    subtitle: Text(
                      '${item.contacts} contact${item.contacts > 1 ? 's' : ''}',
                    ),
                    onTap: () => context.push(AppRoutes.listing(item.id)),
                  ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Raccourcis',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.home_work_outlined),
                title: const Text('Mes annonces'),
                onTap: () => context.push(AppRoutes.proListings),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.people_outline),
                title: const Text('Mes prospects'),
                onTap: () => context.push(AppRoutes.proLeads),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event_available_outlined),
                title: const Text('Mes visites'),
                onTap: () => context.push(AppRoutes.visits),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.chat_bubble_outline),
                title: const Text('Messages'),
                onTap: () => context.push(AppRoutes.messages),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.add_home_outlined),
                title: const Text('Publier une annonce'),
                subtitle: const Text(
                  'Formulaire multi-étapes, brouillon Nest et soumission.',
                ),
                onTap: () => context.push(AppRoutes.publish),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _AnalyticsSection extends ConsumerWidget {
  const _AnalyticsSection({required this.snapshot});

  final ProDashboardSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Audience des annonces',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.xs),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SegmentedButton<AnalyticsWindow>(
            segments: const [
              ButtonSegment(value: AnalyticsWindow.days7, label: Text('7 j')),
              ButtonSegment(value: AnalyticsWindow.days30, label: Text('30 j')),
              ButtonSegment(value: AnalyticsWindow.days90, label: Text('90 j')),
            ],
            selected: {snapshot.window},
            onSelectionChanged: (selected) {
              ref
                  .read(proDashboardControllerProvider.notifier)
                  .setWindow(selected.first);
            },
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (snapshot.analyticsError != null)
          Text(
            'Statistiques d\'audience indisponibles : ${snapshot.analyticsError!.message}',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else if (snapshot.analytics == null ||
            snapshot.analytics!.items.isEmpty)
          Text(
            'Aucune statistique d\'audience sur cette période. '
            'Les compteurs absents ne sont pas assimilés à zéro d\'activité globale.',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else ...[
          Text(
            'Vues détail : ${snapshot.analytics!.detailViews} · '
            'Contacts envoyés : ${snapshot.analytics!.contactsSubmitted}',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (snapshot.analytics!.from != null)
            Text(
              'Période ${snapshot.analytics!.from} → ${snapshot.analytics!.to}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
        ],
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.hint,
    this.onTap,
  });

  final String label;
  final String value;
  final String hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 158,
      child: Material(
        color: AppColors.card,
        borderRadius: AppRadii.card,
        child: InkWell(
          borderRadius: AppRadii.card,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: AppColors.mutedForeground,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(value, style: theme.textTheme.headlineSmall),
                const SizedBox(height: AppSpacing.xxs),
                Text(hint, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
