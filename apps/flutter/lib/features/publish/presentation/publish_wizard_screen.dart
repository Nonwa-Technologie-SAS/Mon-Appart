import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_status_labels.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/listing/money_format.dart';
import '../../../core/search/search_catalog.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/property_image.dart';
import '../../../core/widgets/status_badge.dart';
import '../../pro/presentation/pro_access.dart';
import '../domain/publish_draft.dart';
import '../domain/publish_rules.dart';
import 'publish_providers.dart';

class PublishWizardScreen extends ConsumerWidget {
  const PublishWizardScreen({super.key, this.listingId});

  final String? listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ProAccessScope(
      title: 'Publier une annonce',
      nextRoute: listingId == null || listingId!.isEmpty
          ? AppRoutes.publish
          : AppRoutes.publishListing(listingId!),
      child: _WizardBody(listingId: listingId ?? ''),
    );
  }
}

class _WizardBody extends ConsumerWidget {
  const _WizardBody({required this.listingId});

  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(publishControllerProvider(listingId));
    return async.when(
      loading: () => const AppLoading(label: 'Chargement du formulaire'),
      error: (error, _) => AppErrorView(
        failure: error is AppFailure ? error : const UnexpectedFailure(),
        onRetry: () => ref.invalidate(publishControllerProvider(listingId)),
      ),
      data: (state) {
        if (state.submittedStatus != null) {
          return _SubmittedView(listingId: listingId, wizard: state);
        }
        return _FormScaffold(listingId: listingId, wizard: state);
      },
    );
  }
}

class _FormScaffold extends ConsumerWidget {
  const _FormScaffold({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    return PopScope(
      canPop: !wizard.dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) {
          return;
        }
        final leave = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Quitter le formulaire ?'),
            content: const Text(
              'Des modifications ne sont peut-être pas enregistrées sur le serveur.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Rester'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Quitter'),
              ),
            ],
          ),
        );
        if (leave == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LinearProgressIndicator(
                  value: (wizard.stepIndex + 1) / wizard.stepCount,
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${wizard.step.title} · ${wizard.stepIndex + 1}/${wizard.stepCount}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    Text(
                      publishSaveLabel(wizard.saveStatus),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: wizard.saveStatus == SaveDraftStatus.failed
                            ? AppColors.destructive
                            : AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
                if (wizard.saveError != null)
                  Text(
                    wizard.saveError!,
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: AppColors.destructive),
                  ),
                if (wizard.draft.moderationNotes.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Demandes de correction',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  for (final note in wizard.draft.moderationNotes)
                    Text(
                      '• $note',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [_StepView(listingId: listingId, wizard: wizard)],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  if (wizard.stepIndex > 0)
                    Expanded(
                      child: AppButton(
                        label: 'Précédent',
                        variant: AppButtonVariant.outline,
                        onPressed: notifier.back,
                      ),
                    ),
                  if (wizard.stepIndex > 0)
                    const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: AppButton(
                      label: wizard.step == PublishStep.recap
                          ? 'Soumettre'
                          : 'Continuer',
                      loading: wizard.submitting,
                      onPressed: wizard.submitting
                          ? null
                          : () async {
                              if (wizard.step == PublishStep.recap) {
                                await notifier.submit();
                              } else {
                                await notifier.continueNext();
                              }
                            },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepView extends ConsumerWidget {
  const _StepView({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return switch (wizard.step) {
      PublishStep.offer => _OfferStep(listingId: listingId, wizard: wizard),
      PublishStep.basics => _BasicsStep(listingId: listingId, wizard: wizard),
      PublishStep.location => _LocationStep(
        listingId: listingId,
        wizard: wizard,
      ),
      PublishStep.price => _PriceStep(listingId: listingId, wizard: wizard),
      PublishStep.features => _FeaturesStep(
        listingId: listingId,
        wizard: wizard,
      ),
      PublishStep.photos => _PhotosStep(listingId: listingId, wizard: wizard),
      PublishStep.description => _DescriptionStep(
        listingId: listingId,
        wizard: wizard,
      ),
      PublishStep.recap => _RecapStep(listingId: listingId, wizard: wizard),
    };
  }
}

class _OfferStep extends ConsumerWidget {
  const _OfferStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    final draft = wizard.draft;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Transaction'),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (final type in SearchCatalog.listingTypes)
              ChoiceChip(
                label: Text(type.name),
                selected: draft.listingType == type.code,
                onSelected: draft.listingTypeLocked
                    ? null
                    : (_) => notifier.updateDraft(
                        (current) => current.copyWith(listingType: type.code),
                      ),
              ),
          ],
        ),
        if (draft.listingTypeLocked)
          const Padding(
            padding: EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              'Le type de transaction est fixé après la création du brouillon serveur.',
            ),
          ),
        _FieldError(wizard.fieldErrors['listingType']),
        const SizedBox(height: AppSpacing.md),
        const Text('Type de bien'),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (final type in wizard.propertyTypes)
              ChoiceChip(
                label: Text(type.name),
                selected: draft.propertyType == type.code,
                onSelected: (_) => notifier.updateDraft(
                  (current) => current.copyWith(
                    propertyType: type.code,
                    propertyCategory: type.category,
                  ),
                ),
              ),
          ],
        ),
        _FieldError(wizard.fieldErrors['propertyType']),
      ],
    );
  }
}

class _BasicsStep extends ConsumerWidget {
  const _BasicsStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = wizard.draft;
    return Column(
      children: [
        _TextDraftField(
          listingId: listingId,
          label: 'Titre',
          value: draft.title,
          maxLength: PublishRules.titleMax,
          error: wizard.fieldErrors['title'],
          onChanged: (value) => ref
              .read(publishControllerProvider(listingId).notifier)
              .updateDraft((current) => current.copyWith(title: value)),
        ),
        if (draft.isLand)
          _NumberDraftField(
            listingId: listingId,
            label: 'Surface du terrain (m²)',
            value: draft.landSurface,
            error: wizard.fieldErrors['landSurface'],
            onParsed: (value) => ref
                .read(publishControllerProvider(listingId).notifier)
                .updateDraft(
                  (current) => current.copyWith(
                    landSurface: value,
                    clearLandSurface: value == null,
                  ),
                ),
          )
        else ...[
          _NumberDraftField(
            listingId: listingId,
            label: 'Surface habitable (m²)',
            value: draft.surface,
            error: wizard.fieldErrors['surface'],
            onParsed: (value) => ref
                .read(publishControllerProvider(listingId).notifier)
                .updateDraft(
                  (current) => current.copyWith(
                    surface: value,
                    clearSurface: value == null,
                  ),
                ),
          ),
          _IntDraftField(
            listingId: listingId,
            label: 'Chambres',
            value: draft.bedrooms,
            min: 0,
            max: PublishRules.bedroomsMax,
            error: wizard.fieldErrors['bedrooms'],
            onParsed: (value) => ref
                .read(publishControllerProvider(listingId).notifier)
                .updateDraft(
                  (current) => current.copyWith(
                    bedrooms: value,
                    clearBedrooms: value == null,
                  ),
                ),
          ),
          _IntDraftField(
            listingId: listingId,
            label: 'Salles de bains',
            value: draft.bathrooms,
            min: 0,
            max: PublishRules.bathroomsMax,
            error: wizard.fieldErrors['bathrooms'],
            onParsed: (value) => ref
                .read(publishControllerProvider(listingId).notifier)
                .updateDraft(
                  (current) => current.copyWith(
                    bathrooms: value,
                    clearBathrooms: value == null,
                  ),
                ),
          ),
          _IntDraftField(
            listingId: listingId,
            label: 'Pièces',
            value: draft.rooms,
            min: 0,
            max: PublishRules.roomsMax,
            onParsed: (value) => ref
                .read(publishControllerProvider(listingId).notifier)
                .updateDraft(
                  (current) =>
                      current.copyWith(rooms: value, clearRooms: value == null),
                ),
          ),
        ],
      ],
    );
  }
}

class _LocationStep extends ConsumerWidget {
  const _LocationStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    final draft = wizard.draft;
    final commune = SearchCatalog.communeByCode(draft.communeCode);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Côte d\'Ivoire · Abidjan'),
        const SizedBox(height: AppSpacing.sm),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: draft.communeCode,
          decoration: const InputDecoration(labelText: 'Commune'),
          items: [
            for (final item in SearchCatalog.communes)
              DropdownMenuItem(value: item.code, child: Text(item.name)),
          ],
          onChanged: (code) => notifier.updateDraft(
            (current) => current.copyWith(
              communeCode: code,
              clearNeighborhood: true,
              clearLatitude: true,
              clearLongitude: true,
            ),
          ),
        ),
        _FieldError(wizard.fieldErrors['commune']),
        const SizedBox(height: AppSpacing.sm),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: draft.neighborhoodCode,
          decoration: const InputDecoration(labelText: 'Quartier'),
          items: [
            for (final item in commune?.neighborhoods ?? const <CatalogEntry>[])
              DropdownMenuItem(value: item.code, child: Text(item.name)),
          ],
          onChanged: commune == null
              ? null
              : (code) => notifier.updateDraft(
                  (current) => current.copyWith(neighborhoodCode: code),
                ),
        ),
        _FieldError(wizard.fieldErrors['neighborhood']),
        const SizedBox(height: AppSpacing.sm),
        _TextDraftField(
          listingId: listingId,
          label: 'Indication d\'adresse (facultatif)',
          value: draft.address,
          maxLength: PublishRules.addressMax,
          onChanged: (value) => notifier.updateDraft(
            (current) => current.copyWith(address: value),
          ),
        ),
        Text(
          draft.latitude == null
              ? 'Les coordonnées sont exigées par Nest pour publier. Un point approximatif de quartier est proposé lorsqu\'il figure dans le seed.'
              : 'Point approximatif : ${draft.latitude}, ${draft.longitude} (visibilité ${draft.locationVisibility}).',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        _FieldError(wizard.fieldErrors['coordinates']),
      ],
    );
  }
}

class _PriceStep extends ConsumerWidget {
  const _PriceStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    final periods = PublishRules.allowedPeriods[wizard.draft.listingType] ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Montant en ${MoneyFormat.currencyLabel(PublishRules.currency)}'),
        _IntDraftField(
          listingId: listingId,
          label: 'Montant (entier, sans séparateur)',
          value: wizard.draft.amount,
          min: 1,
          max: PublishRules.maxAmount,
          error: wizard.fieldErrors['amount'],
          onParsed: (value) => notifier.updateDraft(
            (current) =>
                current.copyWith(amount: value, clearAmount: value == null),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text('Périodicité'),
        Wrap(
          spacing: AppSpacing.xs,
          children: [
            for (final period in periods)
              ChoiceChip(
                label: Text(MoneyFormat.periodLabel(period) ?? period),
                selected: wizard.draft.period == period,
                onSelected: (_) => notifier.updateDraft(
                  (current) => current.copyWith(period: period),
                ),
              ),
          ],
        ),
        _FieldError(wizard.fieldErrors['period']),
      ],
    );
  }
}

class _FeaturesStep extends ConsumerWidget {
  const _FeaturesStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    final draft = wizard.draft;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Équipements'),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (final amenity in wizard.amenities)
              FilterChip(
                label: Text(amenity.name),
                selected: draft.amenityCodes.contains(amenity.code),
                onSelected: (selected) {
                  final next = [...draft.amenityCodes];
                  if (selected) {
                    next.add(amenity.code);
                  } else {
                    next.remove(amenity.code);
                  }
                  notifier.updateDraft(
                    (current) => current.copyWith(amenityCodes: next),
                  );
                },
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        const Text('Attributs (non renseigné tant que vous ne choisissez pas)'),
        if (draft.isLand) ...[
          _BoolAttribute(
            listingId: listingId,
            label: 'Viabilisé',
            keyName: 'serviced',
            draft: draft,
          ),
          _BoolAttribute(
            listingId: listingId,
            label: 'Clôturé',
            keyName: 'fenced',
            draft: draft,
          ),
          _BoolAttribute(
            listingId: listingId,
            label: 'Constructible',
            keyName: 'buildable',
            draft: draft,
          ),
          DropdownButtonFormField<String>(
            // ignore: deprecated_member_use
            value: (draft.attributes['landTitle'] as String?) ?? '',
            decoration: const InputDecoration(labelText: 'Titre foncier'),
            items: [
              const DropdownMenuItem(value: '', child: Text('Non renseigné')),
              for (final value in PublishRules.landTitleValues)
                DropdownMenuItem(value: value, child: Text(value)),
            ],
            onChanged: (value) => _setAttribute(
              notifier,
              draft,
              'landTitle',
              value == null || value.isEmpty ? null : value,
            ),
          ),
        ] else ...[
          if (draft.isResidential)
            DropdownButtonFormField<String>(
              // ignore: deprecated_member_use
              value: (draft.attributes['standing'] as String?) ?? '',
              decoration: const InputDecoration(labelText: 'Standing'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Non renseigné')),
                for (final value in PublishRules.standingValues)
                  DropdownMenuItem(value: value, child: Text(value)),
              ],
              onChanged: (value) => _setAttribute(
                notifier,
                draft,
                'standing',
                value == null || value.isEmpty ? null : value,
              ),
            ),
          _BoolAttribute(
            listingId: listingId,
            label: 'Compteur d\'eau',
            keyName: 'waterMeter',
            draft: draft,
          ),
          _BoolAttribute(
            listingId: listingId,
            label: 'Compteur électrique',
            keyName: 'electricityMeter',
            draft: draft,
          ),
        ],
        Text(
          'L\'équipement « Meublé » se coche dans la liste Nest. '
          'Les attributs absents ne sont pas envoyés comme faux.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  void _setAttribute(
    PublishController notifier,
    PublishDraft draft,
    String key,
    Object? value,
  ) {
    final next = Map<String, Object?>.from(draft.attributes);
    if (value == null) {
      next.remove(key);
    } else {
      next[key] = value;
    }
    notifier.updateDraft((current) => current.copyWith(attributes: next));
  }
}

class _BoolAttribute extends ConsumerWidget {
  const _BoolAttribute({
    required this.listingId,
    required this.label,
    required this.keyName,
    required this.draft,
  });

  final String listingId;
  final String label;
  final String keyName;
  final PublishDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = draft.attributes[keyName];
    final bool? current = value is bool ? value : null;
    return CheckboxListTile(
      tristate: true,
      value: current,
      title: Text(label),
      subtitle: Text(
        current == null
            ? 'Non renseigné'
            : current
            ? 'Oui'
            : 'Non',
      ),
      onChanged: (next) {
        final map = Map<String, Object?>.from(draft.attributes);
        if (next == null) {
          map.remove(keyName);
        } else {
          map[keyName] = next;
        }
        ref
            .read(publishControllerProvider(listingId).notifier)
            .updateDraft((draft) => draft.copyWith(attributes: map));
      },
    );
  }
}

class _PhotosStep extends ConsumerWidget {
  const _PhotosStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    final photos = wizard.draft.photos;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(PublishRules.photoLimitsLabel),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: 'Galerie',
                icon: Icons.photo_library_outlined,
                onPressed: notifier.addFromGallery,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppButton(
                label: 'Appareil photo',
                variant: AppButtonVariant.outline,
                icon: Icons.photo_camera_outlined,
                onPressed: notifier.addFromCamera,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        if (photos.isEmpty)
          const AppEmptyState(
            icon: Icons.add_a_photo_outlined,
            title: 'Aucune photo',
            message: 'Les photos sont facultatives pour le brouillon. Elles sont envoyées via les sessions Nest, pas stockées en base.',
          )
        else
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: photos.length,
            // ignore: deprecated_member_use
            onReorder: notifier.reorderPhotos,
            itemBuilder: (context, index) {
              final photo = photos[index];
              return ListTile(
                key: ValueKey(photo.localId),
                leading: SizedBox(
                  width: 56,
                  height: 56,
                  child: photo.previewUrl != null
                      ? PropertyImage(
                          url: photo.previewUrl,
                          semanticLabel: 'Photo',
                        )
                      : const ColoredBox(color: AppColors.muted),
                ),
                title: Text(
                  photo.isPrimary ? 'Photo principale' : 'Photo ${index + 1}',
                ),
                subtitle: Text(_photoStatusLabel(photo)),
                trailing: Wrap(
                  children: [
                    if (photo.status == PhotoUploadStatus.failed)
                      IconButton(
                        onPressed: () => notifier.retryPhoto(photo.localId),
                        icon: const Icon(Icons.refresh),
                      ),
                    if (photo.isUploaded)
                      IconButton(
                        onPressed: () => notifier.setPrimary(photo.localId),
                        icon: Icon(
                          photo.isPrimary ? Icons.star : Icons.star_border,
                        ),
                      ),
                    IconButton(
                      onPressed: () => notifier.removePhoto(photo.localId),
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  String _photoStatusLabel(PublishPhoto photo) {
    return switch (photo.status) {
      PhotoUploadStatus.local => 'En attente d\'envoi',
      PhotoUploadStatus.uploading => 'Envoi en cours',
      PhotoUploadStatus.uploaded => 'Confirmée par le serveur',
      PhotoUploadStatus.failed => photo.error ?? 'Échec de l\'envoi',
    };
  }
}

class _DescriptionStep extends ConsumerWidget {
  const _DescriptionStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _TextDraftField(
      listingId: listingId,
      label: 'Description',
      value: wizard.draft.description,
      maxLength: PublishRules.descriptionMax,
      maxLines: 8,
      error: wizard.fieldErrors['description'],
      onChanged: (value) => ref
          .read(publishControllerProvider(listingId).notifier)
          .updateDraft((current) => current.copyWith(description: value)),
    );
  }
}

class _RecapStep extends ConsumerWidget {
  const _RecapStep({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = wizard.draft;
    final notifier = ref.read(publishControllerProvider(listingId).notifier);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        StatusBadge(
          label: ListingStatusLabels.of(draft.listingStatus),
          tone: ListingStatusLabels.tone(draft.listingStatus),
        ),
        if (draft.moderationNotes.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Demandes de correction',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          for (final note in draft.moderationNotes) Text('• $note'),
        ],
        const SizedBox(height: AppSpacing.md),
        _RecapLine('Transaction', ListingTypeLabel.of(draft.listingType), () {
          notifier.goTo(PublishStep.offer);
        }),
        _RecapLine('Bien', draft.propertyType, () {
          notifier.goTo(PublishStep.offer);
        }),
        _RecapLine('Titre', draft.title, () {
          notifier.goTo(PublishStep.basics);
        }),
        _RecapLine(
          'Localisation',
          '${draft.neighborhoodCode ?? '—'} · ${draft.communeCode ?? '—'}',
          () => notifier.goTo(PublishStep.location),
        ),
        _RecapLine(
          'Prix',
          draft.amount == null
              ? 'Non renseigné'
              : MoneyFormat.formatPrice(
                  ListingPrice(
                    amount: draft.amount!,
                    currency: draft.currency,
                    period: draft.period,
                  ),
                ),
          () => notifier.goTo(PublishStep.price),
        ),
        _RecapLine(
          'Photos',
          '${draft.photos.where((photo) => photo.isUploaded).length} confirmée(s)',
          () => notifier.goTo(PublishStep.photos),
        ),
        if (wizard.fieldErrors.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          for (final error in wizard.fieldErrors.values)
            Text(error, style: const TextStyle(color: AppColors.destructive)),
        ],
        if (wizard.submitError != null)
          Text(
            wizard.submitError!,
            style: const TextStyle(color: AppColors.destructive),
          ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Enregistrer le brouillon',
          variant: AppButtonVariant.outline,
          loading: wizard.saveStatus == SaveDraftStatus.saving,
          onPressed: () => notifier.saveDraft(manual: true),
        ),
        if (draft.listingStatus == 'PENDING_REVIEW') ...[
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Retirer en brouillon pour corriger',
            variant: AppButtonVariant.outline,
            onPressed: notifier.withdrawToDraft,
          ),
        ],
      ],
    );
  }
}

class _RecapLine extends StatelessWidget {
  const _RecapLine(this.label, this.value, this.onEdit);

  final String label;
  final String value;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(value),
      trailing: TextButton(onPressed: onEdit, child: const Text('Modifier')),
    );
  }
}

class _SubmittedView extends StatelessWidget {
  const _SubmittedView({required this.listingId, required this.wizard});

  final String listingId;
  final PublishWizardState wizard;

  @override
  Widget build(BuildContext context) {
    final status = wizard.submittedStatus ?? wizard.draft.listingStatus;
    final id = wizard.draft.listingId;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusBadge(
            label: ListingStatusLabels.of(status),
            tone: ListingStatusLabels.tone(status),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            publishOutcomeMessage(status),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (id != null)
            Text(
              'Référence : $id',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Voir l\'annonce',
            onPressed: id == null
                ? null
                : () => context.push(AppRoutes.listing(id)),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Mes annonces',
            variant: AppButtonVariant.outline,
            onPressed: () => context.go(AppRoutes.proListings),
          ),
        ],
      ),
    );
  }
}

class _TextDraftField extends StatelessWidget {
  const _TextDraftField({
    required this.listingId,
    required this.label,
    required this.value,
    required this.onChanged,
    this.maxLength,
    this.maxLines = 1,
    this.error,
  });

  final String listingId;
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final int? maxLength;
  final int maxLines;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: TextFormField(
        initialValue: value,
        maxLength: maxLength,
        maxLines: maxLines,
        onChanged: onChanged,
        decoration: InputDecoration(labelText: label, errorText: error),
      ),
    );
  }
}

class _NumberDraftField extends StatelessWidget {
  const _NumberDraftField({
    required this.listingId,
    required this.label,
    required this.value,
    required this.onParsed,
    this.error,
  });

  final String listingId;
  final String label;
  final num? value;
  final ValueChanged<num?> onParsed;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: TextFormField(
        initialValue: value?.toString() ?? '',
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (raw) {
          if (raw.trim().isEmpty) {
            onParsed(null);
            return;
          }
          onParsed(num.tryParse(raw.trim().replaceAll(',', '.')));
        },
        decoration: InputDecoration(labelText: label, errorText: error),
      ),
    );
  }
}

class _IntDraftField extends StatelessWidget {
  const _IntDraftField({
    required this.listingId,
    required this.label,
    required this.value,
    required this.onParsed,
    required this.min,
    required this.max,
    this.error,
  });

  final String listingId;
  final String label;
  final int? value;
  final ValueChanged<int?> onParsed;
  final int min;
  final int max;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: TextFormField(
        initialValue: value?.toString() ?? '',
        keyboardType: TextInputType.number,
        onChanged: (raw) {
          if (raw.trim().isEmpty) {
            onParsed(null);
            return;
          }
          final parsed = int.tryParse(raw.trim());
          if (parsed == null || parsed < min || parsed > max) {
            onParsed(null);
            return;
          }
          onParsed(parsed);
        },
        decoration: InputDecoration(labelText: label, errorText: error),
      ),
    );
  }
}

class _FieldError extends StatelessWidget {
  const _FieldError(this.message);

  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xxs),
      child: Text(
        message!,
        style: const TextStyle(color: AppColors.destructive),
      ),
    );
  }
}
