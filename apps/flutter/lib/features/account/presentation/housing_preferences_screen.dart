import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_messages.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/search/search_catalog.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/section_header.dart';
import '../domain/housing_preferences.dart';
import '../domain/preference_rules.dart';
import 'account_providers.dart';

class HousingPreferencesScreen extends ConsumerStatefulWidget {
  const HousingPreferencesScreen({super.key});

  @override
  ConsumerState<HousingPreferencesScreen> createState() =>
      _HousingPreferencesScreenState();
}

class _HousingPreferencesScreenState
    extends ConsumerState<HousingPreferencesScreen> {
  HousingPreferences? _draft;
  late final TextEditingController _minBudget;
  late final TextEditingController _maxBudget;
  late final TextEditingController _minSurface;
  late final TextEditingController _maxSurface;
  String? _error;
  String? _info;
  var _saving = false;
  var _hydrated = false;

  @override
  void initState() {
    super.initState();
    _minBudget = TextEditingController();
    _maxBudget = TextEditingController();
    _minSurface = TextEditingController();
    _maxSurface = TextEditingController();
  }

  @override
  void dispose() {
    _minBudget.dispose();
    _maxBudget.dispose();
    _minSurface.dispose();
    _maxSurface.dispose();
    super.dispose();
  }

  void _hydrate(HousingPreferences prefs) {
    if (_hydrated) {
      return;
    }
    _hydrated = true;
    _draft = prefs;
    _minBudget.text = _asText(prefs.minBudget);
    _maxBudget.text = _asText(prefs.maxBudget);
    _minSurface.text = _asText(prefs.minSurface);
    _maxSurface.text = _asText(prefs.maxSurface);
  }

  String _asText(int? value) => value == null ? '' : '$value';

  HousingPreferences _withNumbers(HousingPreferences draft) {
    return draft.copyWith(
      minBudget: PreferenceRules.parsePositiveInt(_minBudget.text),
      maxBudget: PreferenceRules.parsePositiveInt(_maxBudget.text),
      minSurface: PreferenceRules.parsePositiveInt(_minSurface.text),
      maxSurface: PreferenceRules.parsePositiveInt(_maxSurface.text),
      clearMinBudget: _minBudget.text.trim().isEmpty,
      clearMaxBudget: _maxBudget.text.trim().isEmpty,
      clearMinSurface: _minSurface.text.trim().isEmpty,
      clearMaxSurface: _maxSurface.text.trim().isEmpty,
    );
  }

  Future<void> _save() async {
    final current = _draft;
    if (current == null || _saving) {
      return;
    }
    final draft = _withNumbers(current);
    final deduced = PreferenceRules.deducePeriod(draft.listingTypes);
    final period = draft.budgetPeriod ?? deduced;
    final next = draft.copyWith(
      budgetPeriod: period,
      clearPeriod: period == null,
    );
    final error =
        PreferenceRules.budgetError(min: next.minBudget, max: next.maxBudget) ??
        PreferenceRules.surfaceError(
          min: next.minSurface,
          max: next.maxSurface,
        ) ??
        PreferenceRules.periodError(
          listingTypes: next.listingTypes,
          period: next.budgetPeriod,
          hasBudget: next.minBudget != null || next.maxBudget != null,
        ) ??
        PreferenceRules.toleranceError(
          pct: next.tolerancePct,
          maxBudget: next.maxBudget,
        );
    if (error != null) {
      setState(() {
        _draft = next;
        _error = error;
        _info = null;
      });
      return;
    }
    setState(() {
      _draft = next;
      _saving = true;
      _error = null;
      _info = null;
    });
    try {
      final saved = await ref
          .read(housingPreferencesControllerProvider.notifier)
          .save(next);
      if (!mounted) {
        return;
      }
      final queued = ref.read(connectivityControllerProvider).isOffline;
      setState(() {
        _draft = saved;
        _saving = false;
        _info = queued ? OfflineMessages.queuedPreferences : 'Préférences enregistrées. Les recommandations seront actualisées.';
      });
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _error = 'L\'enregistrement des préférences a échoué.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncPrefs = ref.watch(housingPreferencesControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Préférences immobilières')),
      body: asyncPrefs.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement des préférences'),
        error: (error, _) => AppEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Préférences indisponibles',
          message: error is AppFailure
              ? error.message
              : 'Impossible de charger vos préférences.',
          actionLabel: 'Réessayer',
          onAction: () => ref.invalidate(housingPreferencesControllerProvider),
        ),
        data: (prefs) {
          _hydrate(prefs);
          final draft = _draft ?? prefs;
          final landOnly =
              draft.propertyTypes.isNotEmpty &&
              draft.propertyTypes.every((code) => code == 'LAND');
          final periodLocked = PreferenceRules.deducePeriod(draft.listingTypes);
          final selectedCommunes = [
            for (final code in draft.communes)
              ?SearchCatalog.communeByCode(code),
          ];
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              120,
            ),
            children: [
              Text(
                prefs.isEmpty
                    ? 'Aucune préférence enregistrée. Tous les champs sont facultatifs.'
                    : 'Ces critères aident le moteur Nest à classer les annonces. Ils n\'éliminent pas les biens proches.',
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: AppColors.mutedForeground),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _error!,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: AppColors.destructive),
                ),
              ],
              if (_info != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _info!,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: AppColors.success),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(
                title: 'Type de besoin',
                subtitle: 'Transaction, distincte du type de bien.',
              ),
              _Chips(
                entries: SearchCatalog.listingTypes,
                selected: draft.listingTypes,
                onToggle: (code) {
                  setState(() {
                    var next = draft.toggle('listingTypes', code);
                    final deduced = PreferenceRules.deducePeriod(
                      next.listingTypes,
                    );
                    next = next.copyWith(
                      budgetPeriod: deduced,
                      clearPeriod: deduced == null,
                    );
                    _draft = next;
                  });
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Type de bien'),
              _Chips(
                entries: SearchCatalog.propertyTypes,
                selected: draft.propertyTypes,
                onToggle: (code) {
                  setState(() => _draft = draft.toggle('propertyTypes', code));
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(
                title: 'Budget (F CFA / XOF)',
                subtitle: 'Montants entiers, sans conversion. La périodicité dépend du type de besoin.',
              ),
              Row(
                children: [
                  Expanded(
                    child: _NumberField(
                      controller: _minBudget,
                      label: 'Minimum',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _NumberField(
                      controller: _maxBudget,
                      label: 'Maximum',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Périodicité',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                children: [
                  for (final entry in PreferenceRules.periods.entries)
                    ChoiceChip(
                      label: Text(entry.value),
                      selected:
                          (draft.budgetPeriod ?? periodLocked) == entry.key,
                      onSelected: periodLocked != null
                          ? null
                          : (selected) {
                              setState(() {
                                _draft = draft.copyWith(
                                  budgetPeriod: selected ? entry.key : null,
                                  clearPeriod: !selected,
                                );
                              });
                            },
                    ),
                ],
              ),
              if (periodLocked != null)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(
                    'Périodicité déduite du type de besoin : ${PreferenceRules.periods[periodLocked]}.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Tolérance sur le maximum (${draft.tolerancePct} %)',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              Slider(
                value: draft.tolerancePct.toDouble(),
                max: 30,
                divisions: 6,
                label: '${draft.tolerancePct} %',
                onChanged: (value) {
                  setState(() {
                    _draft = draft.copyWith(tolerancePct: value.round());
                  });
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(
                title: 'Localisation',
                subtitle: 'Communes et quartiers du référentiel Abidjan. Aucune position GPS n\'est demandée.',
              ),
              _Chips(
                entries: SearchCatalog.communes
                    .map(
                      (item) => CatalogEntry(code: item.code, name: item.name),
                    )
                    .toList(),
                selected: draft.communes,
                onToggle: (code) {
                  setState(() => _draft = draft.toggle('communes', code));
                },
              ),
              for (final commune in selectedCommunes) ...[
                const SizedBox(height: AppSpacing.md),
                SectionHeader(title: 'Quartiers · ${commune.name}'),
                _Chips(
                  entries: commune.neighborhoods,
                  selected: draft.neighborhoods,
                  onToggle: (code) {
                    setState(
                      () => _draft = draft.toggle('neighborhoods', code),
                    );
                  },
                ),
              ],
              if (!landOnly) ...[
                const SizedBox(height: AppSpacing.lg),
                const SectionHeader(title: 'Caractéristiques'),
                Text(
                  'Chambres (minimum)',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                _CountRow(
                  value: draft.bedrooms,
                  onChanged: (value) {
                    setState(() {
                      _draft = draft.copyWith(
                        bedrooms: value,
                        clearBedrooms: value == null,
                      );
                    });
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Salles de bain (minimum)',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                _CountRow(
                  value: draft.bathrooms,
                  onChanged: (value) {
                    setState(() {
                      _draft = draft.copyWith(
                        bathrooms: value,
                        clearBathrooms: value == null,
                      );
                    });
                  },
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: _NumberField(
                      controller: _minSurface,
                      label: 'Surface min (m²)',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _NumberField(
                      controller: _maxSurface,
                      label: 'Surface max (m²)',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Équipements'),
              _Chips(
                entries: SearchCatalog.amenities,
                selected: draft.amenities,
                onToggle: (code) {
                  setState(() => _draft = draft.toggle('amenities', code));
                },
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: asyncPrefs.hasValue
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: AppButton(
                  label: 'Enregistrer les préférences',
                  loading: _saving,
                  onPressed: _save,
                ),
              ),
            )
          : null,
    );
  }
}

class _Chips extends StatelessWidget {
  const _Chips({
    required this.entries,
    required this.selected,
    required this.onToggle,
  });

  final List<CatalogEntry> entries;
  final List<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final entry in entries)
          FilterChip(
            label: Text(entry.name),
            selected: selected.contains(entry.code),
            onSelected: (_) => onToggle(entry.code),
          ),
      ],
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({required this.controller, required this.label});

  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      decoration: InputDecoration(labelText: label),
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({required this.value, required this.onChanged});

  final int? value;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      children: [
        for (final count in const [1, 2, 3, 4, 5])
          ChoiceChip(
            label: Text(count == 5 ? '5+' : '$count'),
            selected: value == count,
            onSelected: (selected) => onChanged(selected ? count : null),
          ),
      ],
    );
  }
}
