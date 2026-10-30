import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/widgets/app_button.dart';
import '../domain/saved_search_item.dart';
import 'account_providers.dart';

Future<SavedSearchItem?> showSaveSearchSheet({
  required BuildContext context,
  required ExploreQuery query,
  String? existingId,
  String? initialName,
  bool initialAlerts = true,
  String initialFrequency = 'DAILY',
}) {
  return showModalBottomSheet<SavedSearchItem>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (context) {
      return Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: _SaveSearchForm(
          query: query,
          existingId: existingId,
          initialName: initialName,
          initialAlerts: initialAlerts,
          initialFrequency: initialFrequency,
        ),
      );
    },
  );
}

class _SaveSearchForm extends ConsumerStatefulWidget {
  const _SaveSearchForm({
    required this.query,
    this.existingId,
    this.initialName,
    required this.initialAlerts,
    required this.initialFrequency,
  });

  final ExploreQuery query;
  final String? existingId;
  final String? initialName;
  final bool initialAlerts;
  final String initialFrequency;

  @override
  ConsumerState<_SaveSearchForm> createState() => _SaveSearchFormState();
}

class _SaveSearchFormState extends ConsumerState<_SaveSearchForm> {
  late final TextEditingController _name;
  late var _alerts = widget.initialAlerts;
  late var _frequency = widget.initialFrequency == 'PAUSED'
      ? 'DAILY'
      : widget.initialFrequency;
  String? _nameError;
  String? _formError;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(
      text: widget.initialName ?? SavedSearchItem.defaultName(widget.query),
    );
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final nameError = SavedSearchItem.nameError(_name.text);
    setState(() {
      _nameError = nameError;
      _formError = null;
    });
    if (nameError != null || _saving) {
      return;
    }
    if (!widget.query.hasUserIntent) {
      setState(() {
        _formError = 'Ajoutez au moins un critère avant d\'enregistrer.';
      });
      return;
    }
    setState(() => _saving = true);
    final frequency = _alerts ? _frequency : 'PAUSED';
    try {
      final notifier = ref.read(savedSearchesControllerProvider.notifier);
      final item = widget.existingId == null
          ? await notifier.create(
              name: _name.text.trim(),
              params: widget.query.toSavedSearchParams(),
              alertsEnabled: _alerts,
              frequency: frequency,
            )
          : await notifier.patch(
              widget.existingId!,
              name: _name.text.trim(),
              params: widget.query.toSavedSearchParams(),
              alertsEnabled: _alerts,
              frequency: frequency,
            );
      if (!mounted) {
        return;
      }
      Navigator.pop(context, item);
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _formError = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _formError = 'L\'enregistrement de la recherche a échoué.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final alertable = widget.query.hasAlertableCriteria;
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.55,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.xs,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.existingId == null
                  ? 'Enregistrer la recherche'
                  : 'Mettre à jour la recherche',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: ListView(
                children: [
                  TextField(
                    controller: _name,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      labelText: 'Nom',
                      errorText: _nameError,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Alertes de nouvelles annonces'),
                    subtitle: Text(
                      alertable
                          ? 'Digest Nest quotidien ou hebdomadaire. Pas d\'envoi immédiat.'
                          : 'Les alertes exigent un critère structuré (type, lieu, budget…).',
                    ),
                    value: _alerts && alertable,
                    onChanged: alertable
                        ? (value) => setState(() => _alerts = value)
                        : null,
                  ),
                  if (_alerts && alertable) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      children: [
                        ChoiceChip(
                          label: const Text('Chaque jour'),
                          selected: _frequency == 'DAILY',
                          onSelected: (_) =>
                              setState(() => _frequency = 'DAILY'),
                        ),
                        ChoiceChip(
                          label: const Text('Chaque semaine'),
                          selected: _frequency == 'WEEKLY',
                          onSelected: (_) =>
                              setState(() => _frequency = 'WEEKLY'),
                        ),
                      ],
                    ),
                  ],
                  if (_formError != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      _formError!,
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: AppColors.destructive),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: widget.existingId == null
                  ? 'Enregistrer'
                  : 'Mettre à jour',
              loading: _saving,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
