import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/auth_providers.dart';
import 'account_providers.dart';

class SavedSearchesScreen extends ConsumerWidget {
  const SavedSearchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Recherches enregistrées')),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.bookmark_outline,
              title: 'Connexion requise',
              message:
                  'Connectez-vous pour enregistrer et relancer vos recherches.',
              actionLabel: 'Se connecter',
              onAction: () => context.push(
                AppRoutes.loginWithNext(AppRoutes.savedSearches),
              ),
            )
          : const _SavedSearchList(),
    );
  }
}

class _SavedSearchList extends ConsumerWidget {
  const _SavedSearchList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncItems = ref.watch(savedSearchesControllerProvider);
    return asyncItems.when(
      skipLoadingOnReload: true,
      loading: () =>
          const AppLoading(label: 'Chargement des recherches enregistrées'),
      error: (error, _) => AppEmptyState(
        icon: Icons.wifi_off_outlined,
        title: 'Recherches indisponibles',
        message: error is AppFailure
            ? error.message
            : 'Impossible de charger vos recherches.',
        actionLabel: 'Réessayer',
        onAction: () => ref.invalidate(savedSearchesControllerProvider),
      ),
      data: (items) {
        if (items.isEmpty) {
          return AppEmptyState(
            icon: Icons.bookmark_outline,
            title: 'Aucune recherche enregistrée',
            message:
                'Depuis Explorer, enregistrez vos critères pour les relancer '
                'et recevoir un digest d\'alertes.',
            actionLabel: 'Explorer',
            onAction: () => context.go(AppRoutes.explore),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.md),
          itemCount: items.length,
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final item = items[index];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item.name),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.summary),
                  const SizedBox(height: AppSpacing.xxs),
                  StatusBadge(
                    label: item.alertsActive
                        ? 'Alertes · ${item.frequencyLabel}'
                        : 'Alertes désactivées',
                    tone: item.alertsActive
                        ? StatusBadgeTone.accent
                        : StatusBadgeTone.neutral,
                  ),
                ],
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(AppRoutes.savedSearch(item.id)),
            );
          },
        );
      },
    );
  }
}
