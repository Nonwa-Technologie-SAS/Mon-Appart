import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/section_header.dart';
import '../domain/saved_search_item.dart';
import 'account_providers.dart';
import 'save_search_sheet.dart';

class SavedSearchEditScreen extends ConsumerWidget {
  const SavedSearchEditScreen({super.key, required this.savedSearchId});

  final String savedSearchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncItems = ref.watch(savedSearchesControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Recherche enregistrée')),
      body: asyncItems.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement'),
        error: (error, _) => AppEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Recherche indisponible',
          message: error is AppFailure
              ? error.message
              : 'Impossible de charger cette recherche.',
          actionLabel: 'Réessayer',
          onAction: () => ref.invalidate(savedSearchesControllerProvider),
        ),
        data: (items) {
          SavedSearchItem? item;
          for (final candidate in items) {
            if (candidate.id == savedSearchId) {
              item = candidate;
              break;
            }
          }
          if (item == null) {
            return const AppEmptyState(
              icon: Icons.bookmark_outline,
              title: 'Recherche introuvable',
              message: 'Elle a peut-être déjà été supprimée.',
            );
          }
          return _SavedSearchEditor(item: item);
        },
      ),
    );
  }
}

class _SavedSearchEditor extends ConsumerStatefulWidget {
  const _SavedSearchEditor({required this.item});

  final SavedSearchItem item;

  @override
  ConsumerState<_SavedSearchEditor> createState() => _SavedSearchEditorState();
}

class _SavedSearchEditorState extends ConsumerState<_SavedSearchEditor> {
  var _busy = false;

  Future<void> _resume() async {
    setState(() => _busy = true);
    try {
      final query = await ref
          .read(savedSearchRepositoryProvider)
          .resume(widget.item.id);
      if (!mounted) {
        return;
      }
      context.go(query.toLocation());
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _setAlerts(bool enabled) async {
    try {
      await ref
          .read(savedSearchesControllerProvider.notifier)
          .patch(
            widget.item.id,
            alertsEnabled: enabled,
            frequency: enabled
                ? (widget.item.frequency == 'PAUSED'
                      ? 'DAILY'
                      : widget.item.frequency)
                : 'PAUSED',
          );
    } on AppFailure catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _setFrequency(String frequency) async {
    try {
      await ref
          .read(savedSearchesControllerProvider.notifier)
          .patch(
            widget.item.id,
            frequency: frequency,
            alertsEnabled: frequency != 'PAUSED',
          );
    } on AppFailure catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Supprimer cette recherche ?'),
          content: const Text(
            'Les alertes associées cesseront. Cette action est définitive.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Annuler'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Supprimer'),
            ),
          ],
        );
      },
    );
    if (confirmed != true) {
      return;
    }
    try {
      await ref
          .read(savedSearchesControllerProvider.notifier)
          .remove(widget.item.id);
      if (mounted) {
        context.pop();
      }
    } on AppFailure catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final alertable = item.query.hasAlertableCriteria;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Text(item.name, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(item.summary),
        const SizedBox(height: AppSpacing.lg),
        const SectionHeader(
          title: 'Alertes',
          subtitle: 'Digest serveur (quotidien ou hebdomadaire). Aucun envoi immédiat.',
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Recevoir des alertes'),
          subtitle: Text(
            alertable
                ? item.frequencyLabel
                : 'Ajoutez un critère structuré pour activer les alertes.',
          ),
          value: item.alertsActive && alertable,
          onChanged: alertable ? _setAlerts : null,
        ),
        if (item.alertsActive && alertable)
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              ChoiceChip(
                label: const Text('Chaque jour'),
                selected: item.frequency == 'DAILY',
                onSelected: (_) => _setFrequency('DAILY'),
              ),
              ChoiceChip(
                label: const Text('Chaque semaine'),
                selected: item.frequency == 'WEEKLY',
                onSelected: (_) => _setFrequency('WEEKLY'),
              ),
            ],
          ),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Relancer la recherche',
          loading: _busy,
          onPressed: _resume,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Renommer ou mettre à jour les critères',
          variant: AppButtonVariant.outline,
          onPressed: () async {
            await showSaveSearchSheet(
              context: context,
              query: item.query,
              existingId: item.id,
              initialName: item.name,
              initialAlerts: item.alertsActive,
              initialFrequency: item.frequency,
            );
          },
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Ajuster les filtres dans Explorer',
          variant: AppButtonVariant.outline,
          onPressed: () {
            final location = Uri.parse(
              item.query.toLocation(path: AppRoutes.exploreFilters),
            );
            context.push(
              Uri(
                path: location.path,
                queryParameters: {
                  ...location.queryParameters,
                  AppRoutes.savedSearchIdQuery: item.id,
                },
              ).toString(),
            );
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        TextButton(
          onPressed: _delete,
          child: const Text(
            'Supprimer la recherche',
            style: TextStyle(color: AppColors.destructive),
          ),
        ),
      ],
    );
  }
}
