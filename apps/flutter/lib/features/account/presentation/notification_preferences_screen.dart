import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/section_header.dart';
import '../domain/notification_pref.dart';
import 'account_providers.dart';

class NotificationPreferencesScreen extends ConsumerWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncItems = ref.watch(notificationPreferencesControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: asyncItems.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement des préférences'),
        error: (error, _) => AppEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Préférences indisponibles',
          message: error is AppFailure
              ? error.message
              : 'Impossible de charger les notifications.',
          actionLabel: 'Réessayer',
          onAction: () =>
              ref.invalidate(notificationPreferencesControllerProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const AppEmptyState(
              icon: Icons.notifications_off_outlined,
              title: 'Aucun paramètre disponible',
              message:
                  'Le serveur n\'a renvoyé aucune catégorie. '
                  'Les permissions natives se demandent depuis le centre de notifications.',
            );
          }
          final groups = <String, List<NotificationPrefCell>>{};
          for (final item in items) {
            groups.putIfAbsent(item.category, () => []).add(item);
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Ces interrupteurs concernent les canaux Nest (application, e-mail, SMS…). '
                'Ils ne désactivent pas les notifications système de l\'appareil.',
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: AppColors.mutedForeground),
              ),
              const SizedBox(height: AppSpacing.lg),
              for (final entry in groups.entries) ...[
                SectionHeader(title: entry.value.first.categoryLabel),
                for (final cell in entry.value)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(cell.channelLabel),
                    subtitle: !cell.canToggle
                        ? Text(
                            cell.locked
                                ? 'Paramètre verrouillé'
                                : 'Canal indisponible',
                          )
                        : null,
                    value: cell.enabled,
                    onChanged: cell.canToggle
                        ? (enabled) async {
                            try {
                              await ref
                                  .read(
                                    notificationPreferencesControllerProvider
                                        .notifier,
                                  )
                                  .setEnabled(cell, enabled);
                            } on AppFailure catch (error) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(error.message)),
                                );
                              }
                            }
                          }
                        : null,
                  ),
                const SizedBox(height: AppSpacing.md),
              ],
            ],
          );
        },
      ),
    );
  }
}
