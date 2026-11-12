import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import 'account_providers.dart';

class AccountSessionsScreen extends ConsumerWidget {
  const AccountSessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSessions = ref.watch(accountSessionsControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Sessions')),
      body: asyncSessions.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement des sessions'),
        error: (error, _) => AppEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Sessions indisponibles',
          message: error is AppFailure
              ? error.message
              : 'Impossible de charger les appareils connectés.',
          actionLabel: 'Réessayer',
          onAction: () => ref.invalidate(accountSessionsControllerProvider),
        ),
        data: (sessions) {
          if (sessions.isEmpty) {
            return const AppEmptyState(
              icon: Icons.devices_outlined,
              title: 'Aucune session',
              message: 'Aucun appareil n\'est actuellement associé au compte.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: sessions.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final session = sessions[index];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(session.label),
                subtitle: Text(
                  'Dernière activité : ${_format(session.lastActiveAt)}',
                ),
                trailing: session.current
                    ? const StatusBadge(
                        label: 'Cet appareil',
                        tone: StatusBadgeTone.success,
                      )
                    : IconButton(
                        tooltip: 'Révoquer',
                        icon: const Icon(Icons.logout),
                        onPressed: () async {
                          try {
                            await ref
                                .read(
                                  accountSessionsControllerProvider.notifier,
                                )
                                .revoke(session.id);
                          } on AppFailure catch (error) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(error.message)),
                              );
                            }
                          }
                        },
                      ),
              );
            },
          );
        },
      ),
    );
  }

  static String _format(DateTime value) {
    final local = value.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    final h = local.hour.toString().padLeft(2, '0');
    final min = local.minute.toString().padLeft(2, '0');
    return '$d/$m/$y $h:$min';
  }
}
