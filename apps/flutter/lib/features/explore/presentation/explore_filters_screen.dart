import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/search/search_catalog.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/section_header.dart';
import '../../account/presentation/account_providers.dart';

class ExploreFiltersScreen extends ConsumerStatefulWidget {
  const ExploreFiltersScreen({
    super.key,
    required this.query,
    this.savedSearchId,
  });

  final ExploreQuery query;
  final String? savedSearchId;

  @override
  ConsumerState<ExploreFiltersScreen> createState() =>
      _ExploreFiltersScreenState();
}

class _ExploreFiltersScreenState extends ConsumerState<ExploreFiltersScreen> {
  late ExploreQuery _draft;
  late final TextEditingController _minPrice;
  late final TextEditingController _maxPrice;
  late final TextEditingController _minSurface;
  late final TextEditingController _maxSurface;
  String? _error;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _draft = widget.query;
    _minPrice = TextEditingController(text: _asText(_draft.minPrice));
    _maxPrice = TextEditingController(text: _asText(_draft.maxPrice));
    _minSurface = TextEditingController(text: _asText(_draft.minSurface));
    _maxSurface = TextEditingController(text: _asText(_draft.maxSurface));
  }

  @override
  void dispose() {
    _minPrice.dispose();
    _maxPrice.dispose();
    _minSurface.dispose();
    _maxSurface.dispose();
    super.dispose();
  }

  String _asText(int? value) => value == null ? '' : '$value';

  int? _parse(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return null;
    }
    return int.tryParse(trimmed);
  }

  Future<void> _apply() async {
    final next = _draft.copyWith(
      minPrice: _parse(_minPrice.text),
      maxPrice: _parse(_maxPrice.text),
      minSurface: _parse(_minSurface.text),
      maxSurface: _parse(_maxSurface.text),
    );
    final error = next.budgetError ?? next.surfaceError;
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    final savedSearchId = widget.savedSearchId;
    if (savedSearchId != null && savedSearchId.isNotEmpty) {
      setState(() {
        _saving = true;
        _error = null;
      });
      try {
        await ref
            .read(savedSearchesControllerProvider.notifier)
            .patch(savedSearchId, params: next.toSavedSearchParams());
      } on AppFailure catch (failure) {
        if (!mounted) {
          return;
        }
        setState(() {
          _saving = false;
          _error = failure.message;
        });
        return;
      }
    }
    if (!mounted) {
      return;
    }
    context.go(next.toLocation());
  }

  void _reset() {
    setState(() {
      _draft = ExploreQuery(q: widget.query.q, sort: widget.query.sort);
      _minPrice.clear();
      _maxPrice.clear();
      _minSurface.clear();
      _maxSurface.clear();
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final commune = SearchCatalog.communeByCode(_draft.commune);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Filtres'),
        actions: [
          TextButton(onPressed: _reset, child: const Text('Réinitialiser')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          120,
        ),
        children: [
          if (_error != null) ...[
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: AppColors.destructive),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          const SectionHeader(title: 'Type de transaction'),
          _Chips(
            entries: SearchCatalog.listingTypes,
            selected: _draft.listingTypes,
            onToggle: (code) {
              setState(() => _draft = _draft.toggleCsv('listingType', code));
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Type de bien'),
          _Chips(
            entries: SearchCatalog.propertyTypes,
            selected: _draft.propertyTypes,
            onToggle: (code) {
              setState(() => _draft = _draft.toggleCsv('propertyType', code));
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(
            title: 'Budget (F CFA)',
            subtitle: 'Montants entiers, sans conversion de devise.',
          ),
          Row(
            children: [
              Expanded(
                child: _NumberField(controller: _minPrice, label: 'Minimum'),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _NumberField(controller: _maxPrice, label: 'Maximum'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(
            title: 'Localisation',
            subtitle: 'Communes du District d\'Abidjan (référentiel Nest).',
          ),
          _Chips(
            entries: SearchCatalog.communes
                .map((item) => CatalogEntry(code: item.code, name: item.name))
                .toList(),
            selected: [if (_draft.commune != null) _draft.commune!],
            onToggle: (code) {
              setState(() {
                if (_draft.commune == code) {
                  _draft = _draft.copyWith(
                    commune: null,
                    neighborhood: null,
                    city: null,
                  );
                } else {
                  _draft = _draft.copyWith(
                    commune: code,
                    city: SearchCatalog.city.code,
                    neighborhood: null,
                  );
                }
              });
            },
          ),
          if (commune != null) ...[
            const SizedBox(height: AppSpacing.md),
            SectionHeader(title: 'Quartier · ${commune.name}'),
            _Chips(
              entries: commune.neighborhoods,
              selected: [if (_draft.neighborhood != null) _draft.neighborhood!],
              onToggle: (code) {
                setState(() {
                  _draft = _draft.copyWith(
                    neighborhood: _draft.neighborhood == code ? null : code,
                  );
                });
              },
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Caractéristiques'),
          Text(
            'Chambres (minimum)',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          _CountRow(
            value: _draft.bedrooms,
            onChanged: (value) => setState(() {
              _draft = _draft.copyWith(bedrooms: value);
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Salles de bain (minimum)',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          _CountRow(
            value: _draft.bathrooms,
            onChanged: (value) => setState(() {
              _draft = _draft.copyWith(bathrooms: value);
            }),
          ),
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
            selected: _draft.amenityCodes,
            onToggle: (code) {
              setState(() => _draft = _draft.toggleCsv('amenities', code));
            },
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: AppButton(
            label: widget.savedSearchId == null
                ? 'Appliquer les filtres'
                : 'Mettre à jour la recherche',
            loading: _saving,
            onPressed: _saving ? null : _apply,
          ),
        ),
      ),
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
