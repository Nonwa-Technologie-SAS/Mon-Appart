import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/own_report.dart';
import 'support_providers.dart';

class MyReportsScreen extends ConsumerWidget {
  const MyReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mes signalements')),
      body: session.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement du compte'),
        error: (error, _) => AppErrorView(
          failure: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(authControllerProvider),
        ),
        data: (value) {
          if (value.user == null) {
            return AppEmptyState(
              icon: Icons.person_outline,
              title: 'Connexion requise',
              message:
                  'Les signalements sont liés au compte. '
                  'Aucun dossier n\'est affiché sans session.',
              actionLabel: 'Se connecter',
              onAction: () =>
                  context.push(AppRoutes.loginWithNext(AppRoutes.myReports)),
            );
          }
          final reports = ref.watch(ownReportsProvider);
          return reports.when(
            loading: () =>
                const AppLoading(label: 'Chargement des signalements'),
            error: (error, _) => AppErrorView(
              title: 'Signalements indisponibles',
              failure: error is AppFailure
                  ? error
                  : UnexpectedFailure(message: error.toString()),
              onRetry: () => ref.invalidate(ownReportsProvider),
            ),
            data: (items) {
              if (items.isEmpty) {
                return const AppEmptyState(
                  title: 'Aucun signalement',
                  message:
                      'Un signalement d\'annonce ou de conversation apparaîtra ici. '
                      'Il n\'existe pas de ticket de support général.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: items.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, index) =>
                    _ReportTile(report: items[index]),
              );
            },
          );
        },
      ),
    );
  }
}

String _format(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} '
      '${two(local.hour)}:${two(local.minute)}';
}

class _ReportTile extends StatelessWidget {
  const _ReportTile({required this.report});

  final OwnReport report;

  @override
  Widget build(BuildContext context) {
    final when = _format(report.createdAt);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              report.reasonLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text('${report.targetLabel} · ${report.statusLabel}'),
            Text(when, style: Theme.of(context).textTheme.bodySmall),
            if (report.status == 'RESOLVED')
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(
                  'Examiné signifie que la modération a clos le dossier. '
                  'L\'application ne dit pas si le motif a été retenu.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
