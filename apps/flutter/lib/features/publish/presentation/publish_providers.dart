import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_status_labels.dart';
import '../domain/managed_property.dart';
import '../../../core/listing/public_ids.dart';
import '../../../core/search/search_catalog.dart';
import '../../pro/presentation/pro_providers.dart';
import '../data/media_upload_repository.dart';
import '../data/property_repository.dart';
import '../data/publish_catalog_repository.dart';
import '../data/publish_image_picker.dart';
import '../domain/publish_draft.dart';
import '../domain/publish_rules.dart';

final publishCatalogRepositoryProvider = Provider<PublishCatalogRepository>((
  ref,
) {
  return PublishCatalogRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
  );
});

final propertyRepositoryProvider = Provider<PropertyRepository>((ref) {
  return PropertyRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final mediaUploadRepositoryProvider = Provider<MediaUploadRepository>((ref) {
  return MediaUploadRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final publishImagePickerProvider = Provider<PublishImagePicker>((ref) {
  return DevicePublishImagePicker();
});

final publishControllerProvider = AsyncNotifierProvider.autoDispose
    .family<PublishController, PublishWizardState, String>(
      PublishController.new,
    );

class PublishController extends AsyncNotifier<PublishWizardState> {
  PublishController(this.listingId);

  final String listingId;
  Timer? _debounce;
  int _saveGeneration = 0;
  bool _saving = false;
  bool _submitting = false;

  @override
  Future<PublishWizardState> build() async {
    ref.onDispose(() => _debounce?.cancel());
    final types = await ref
        .read(publishCatalogRepositoryProvider)
        .propertyTypes();
    final amenities = await ref
        .read(publishCatalogRepositoryProvider)
        .amenities();
    if (listingId.isNotEmpty) {
      return _resume(listingId, types, amenities);
    }
    return PublishWizardState(
      draft: const PublishDraft(),
      propertyTypes: types,
      amenities: amenities,
    );
  }

  Future<void> goTo(PublishStep step) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = AsyncData(current.copyWith(step: step, fieldErrors: const {}));
  }

  Future<bool> continueNext() async {
    final current = state.value;
    if (current == null) {
      return false;
    }
    final errors = _validateStep(
      current.draft,
      current.step,
      current.propertyTypes,
    );
    if (errors.isNotEmpty) {
      state = AsyncData(current.copyWith(fieldErrors: errors));
      return false;
    }
    if (current.step == PublishStep.location || current.draft.hasServerDraft) {
      await saveDraft(manual: false);
    }
    final index = current.stepIndex;
    if (index >= PublishStep.values.length - 1) {
      return true;
    }
    final latest = state.value ?? current;
    state = AsyncData(
      latest.copyWith(
        step: PublishStep.values[index + 1],
        fieldErrors: const {},
      ),
    );
    return true;
  }

  void back() {
    final current = state.value;
    if (current == null || current.stepIndex == 0) {
      return;
    }
    state = AsyncData(
      current.copyWith(
        step: PublishStep.values[current.stepIndex - 1],
        fieldErrors: const {},
      ),
    );
  }

  void updateDraft(PublishDraft Function(PublishDraft draft) updater) {
    final current = state.value;
    if (current == null) {
      return;
    }
    var next = updater(current.draft);
    if (next.propertyType != current.draft.propertyType) {
      final category = _categoryOf(next.propertyType, current.propertyTypes);
      next = next.copyWith(propertyCategory: category);
      if (PublishRules.isLand(next.propertyType, category: category)) {
        next = next.copyWith(
          clearBedrooms: true,
          clearBathrooms: true,
          clearRooms: true,
          clearFloor: true,
          clearTotalFloors: true,
          clearSurface: true,
        );
      }
    }
    if (next.listingType != current.draft.listingType) {
      if (!PublishRules.isPeriodAllowed(next.listingType, next.period)) {
        next = next.copyWith(
          period: PublishRules.defaultPeriod(next.listingType),
        );
      }
    }
    if (next.neighborhoodCode != current.draft.neighborhoodCode) {
      final point = SearchCatalog.approximateCoordinates(next.neighborhoodCode);
      if (next.latitude == null && point != null) {
        next = next.copyWith(latitude: point.$1, longitude: point.$2);
      }
    }
    state = AsyncData(
      current.copyWith(draft: next, dirty: true, fieldErrors: const {}),
    );
    _scheduleSave();
  }

  Future<void> saveDraft({required bool manual}) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    if (_saving) {
      return;
    }
    if (!current.draft.hasServerDraft && !current.draft.canCreateProperty) {
      if (manual) {
        state = AsyncData(
          current.copyWith(
            saveStatus: SaveDraftStatus.failed,
            saveError: 'Renseignez le type, le titre, la commune et le quartier avant d\'enregistrer.',
          ),
        );
      }
      return;
    }
    _debounce?.cancel();
    final generation = ++_saveGeneration;
    _saving = true;
    state = AsyncData(
      current.copyWith(
        saveStatus: SaveDraftStatus.saving,
        clearSaveError: true,
      ),
    );
    try {
      final saved = await _persist(current.draft);
      if (generation != _saveGeneration) {
        return;
      }
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          draft: saved,
          saveStatus: SaveDraftStatus.saved,
          dirty: false,
          clearSaveError: true,
        ),
      );
    } catch (error) {
      if (generation != _saveGeneration) {
        return;
      }
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          saveStatus: SaveDraftStatus.failed,
          saveError: _failure(error).message,
        ),
      );
    } finally {
      _saving = false;
    }
  }

  Future<void> submit() async {
    final current = state.value;
    if (current == null || _submitting) {
      return;
    }
    if (current.draft.hasUploadingPhotos) {
      state = AsyncData(
        current.copyWith(
          submitError: 'Attendez la fin de l\'envoi des photos.',
        ),
      );
      return;
    }
    if (current.draft.hasFailedPhotos) {
      state = AsyncData(
        current.copyWith(
          submitError: 'Corrigez les photos en échec avant de soumettre.',
        ),
      );
      return;
    }
    final recapErrors = _validatePublish(current.draft);
    if (recapErrors.isNotEmpty) {
      state = AsyncData(current.copyWith(fieldErrors: recapErrors));
      return;
    }
    _submitting = true;
    state = AsyncData(
      current.copyWith(submitting: true, clearSubmitError: true),
    );
    try {
      if (!ListingManagerActions.canPublish(current.draft.listingStatus)) {
        state = AsyncData(
          current.copyWith(
            submitting: false,
            submitError:
                'Cette annonce ne peut pas être soumise dans son statut actuel (${ListingStatusLabels.of(current.draft.listingStatus)}).',
          ),
        );
        return;
      }
      var draft = await _persist(current.draft);
      if (draft.propertyStatus == 'DRAFT' && draft.completenessGaps.isEmpty) {
        final property = await ref
            .read(propertyRepositoryProvider)
            .setStatus(draft.propertyId!, 'ACTIVE');
        draft = draft.copyWith(
          propertyStatus: property.status ?? 'ACTIVE',
          missingCompleteness: property.missingCompleteness,
        );
      }
      final listing = await ref
          .read(proListingsRepositoryProvider)
          .publish(draft.listingId!);
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          draft: draft.copyWith(
            listingStatus: listing.status,
            listingId: listing.id,
          ),
          submitting: false,
          dirty: false,
          submittedStatus: listing.status,
          saveStatus: SaveDraftStatus.saved,
          clearSubmitError: true,
        ),
      );
    } catch (error) {
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          submitting: false,
          submitError: _failure(error).message,
        ),
      );
    } finally {
      _submitting = false;
    }
  }

  Future<void> withdrawToDraft() async {
    final current = state.value;
    final listingId = current?.draft.listingId;
    if (current == null || listingId == null) {
      return;
    }
    try {
      final listing = await ref
          .read(proListingsRepositoryProvider)
          .changeStatus(listingId, 'DRAFT');
      state = AsyncData(
        current.copyWith(
          draft: current.draft.copyWith(listingStatus: listing.status),
        ),
      );
    } catch (error) {
      state = AsyncData(current.copyWith(submitError: _failure(error).message));
    }
  }

  Future<void> addFromGallery() async {
    final files = await ref.read(publishImagePickerProvider).pickGallery();
    await _addFiles(files);
  }

  Future<void> addFromCamera() async {
    final file = await ref.read(publishImagePickerProvider).pickCamera();
    if (file != null) {
      await _addFiles([file]);
    }
  }

  Future<void> retryPhoto(String localId) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    PublishPhoto? target;
    for (final photo in current.draft.photos) {
      if (photo.localId == localId) {
        target = photo;
        break;
      }
    }
    if (target == null || target.bytes == null) {
      return;
    }
    await _uploadPhoto(target);
  }

  Future<void> removePhoto(String localId) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    PublishPhoto? target;
    for (final photo in current.draft.photos) {
      if (photo.localId == localId) {
        target = photo;
        break;
      }
    }
    if (target == null) {
      return;
    }
    if (target.mediaId != null && current.draft.propertyId != null) {
      await ref
          .read(mediaUploadRepositoryProvider)
          .remove(current.draft.propertyId!, target.mediaId!);
    }
    final remaining = [
      for (final photo in current.draft.photos)
        if (photo.localId != localId) photo,
    ];
    state = AsyncData(
      current.copyWith(
        draft: current.draft.copyWith(photos: remaining),
        dirty: true,
      ),
    );
    if (remaining.any((photo) => photo.isUploaded)) {
      await _syncOrder(
        state.value?.draft ?? current.draft.copyWith(photos: remaining),
      );
    }
  }

  Future<void> reorderPhotos(int oldIndex, int newIndex) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    var nextIndex = newIndex;
    if (oldIndex < nextIndex) {
      nextIndex -= 1;
    }
    final photos = [...current.draft.photos];
    final item = photos.removeAt(oldIndex);
    photos.insert(nextIndex, item);
    final draft = current.draft.copyWith(photos: photos);
    state = AsyncData(current.copyWith(draft: draft, dirty: true));
    await _syncOrder(draft);
  }

  Future<void> setPrimary(String localId) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    PublishPhoto? target;
    for (final photo in current.draft.photos) {
      if (photo.localId == localId) {
        target = photo;
        break;
      }
    }
    if (target?.mediaId == null || current.draft.propertyId == null) {
      return;
    }
    await ref
        .read(mediaUploadRepositoryProvider)
        .setPrimary(current.draft.propertyId!, target!.mediaId!);
    state = AsyncData(
      current.copyWith(
        draft: current.draft.copyWith(
          photos: [
            for (final photo in current.draft.photos)
              photo.copyWith(isPrimary: photo.localId == localId),
          ],
        ),
      ),
    );
  }

  void _scheduleSave() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 1600), () {
      unawaited(saveDraft(manual: false));
    });
  }

  Future<PublishWizardState> _resume(
    String listingId,
    List<CatalogOption> types,
    List<CatalogOption> amenities,
  ) async {
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final listing = await ref
        .read(proListingsRepositoryProvider)
        .getById(listingId);
    final property = await ref
        .read(propertyRepositoryProvider)
        .getById(listing.propertyId);
    final media = await ref
        .read(mediaUploadRepositoryProvider)
        .list(property.id);
    final notes = await ref
        .read(proListingsRepositoryProvider)
        .moderationNotes(listingId);
    final photos = [
      for (final item in media.images)
        PublishPhoto(
          localId: item.id,
          mediaId: item.id,
          previewUrl: item.previewUrl,
          status: PhotoUploadStatus.uploaded,
          isPrimary: item.isPrimary,
        ),
    ];
    final amount = listing.price?.amount.round();
    return PublishWizardState(
      draft: PublishDraft(
        propertyId: property.id,
        listingId: listing.id,
        listingType: listing.listingType,
        propertyType: property.propertyTypeCode,
        propertyCategory: property.propertyCategory,
        title: property.title,
        description: listing.description ?? property.description ?? '',
        communeCode: property.communeCode,
        neighborhoodCode: property.neighborhoodCode,
        address: property.address ?? '',
        latitude: property.latitude,
        longitude: property.longitude,
        locationVisibility: property.locationVisibility ?? 'APPROXIMATE',
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        rooms: property.rooms,
        floor: property.floor,
        totalFloors: property.totalFloors,
        yearBuilt: property.yearBuilt,
        surface: property.surface,
        landSurface: property.landSurface,
        amount: amount,
        period:
            listing.price?.period ??
            PublishRules.defaultPeriod(listing.listingType),
        amenityCodes: property.amenityCodes,
        attributes: property.attributes,
        photos: photos,
        listingStatus: listing.status,
        propertyStatus: property.status ?? 'DRAFT',
        missingCompleteness: property.missingCompleteness,
        moderationNotes: notes,
      ),
      step: listing.status == 'DRAFT' ? PublishStep.offer : PublishStep.recap,
      propertyTypes: types,
      amenities: amenities,
      saveStatus: SaveDraftStatus.saved,
    );
  }

  Future<PublishDraft> _persist(PublishDraft draft) async {
    var next = draft;
    final properties = ref.read(propertyRepositoryProvider);
    final listings = ref.read(proListingsRepositoryProvider);
    if (next.propertyId == null) {
      final created = await properties.create(next);
      next = _mergeProperty(next, created);
    } else {
      final updated = await properties.update(next);
      next = _mergeProperty(next, updated);
    }
    if (next.listingId == null) {
      final created = await listings.create(
        propertyId: next.propertyId!,
        listingType: next.listingType,
        title: next.title,
        description: next.description.trim().isEmpty ? null : next.description,
        amount: next.amount,
        period: next.period,
      );
      next = next.copyWith(
        listingId: created.id,
        listingStatus: created.status,
      );
    } else {
      await listings.update(
        listingId: next.listingId!,
        title: next.title,
        description: next.description.trim().isEmpty ? null : next.description,
      );
      if (next.amount != null) {
        await listings.changePrice(
          listingId: next.listingId!,
          amount: next.amount!,
          period: next.period,
        );
      }
    }
    await properties.replaceAmenities(next.propertyId!, next.amenityCodes);
    return next;
  }

  PublishDraft _mergeProperty(PublishDraft draft, ManagedProperty property) {
    return draft.copyWith(
      propertyId: property.id,
      propertyStatus: property.status ?? draft.propertyStatus,
      missingCompleteness: property.missingCompleteness,
      propertyCategory: property.propertyCategory ?? draft.propertyCategory,
    );
  }

  Future<void> _addFiles(List<PickedPublishFile> files) async {
    final current = state.value;
    if (current == null || files.isEmpty) {
      return;
    }
    if (!current.draft.hasServerDraft) {
      await saveDraft(manual: true);
    }
    final latest = state.value ?? current;
    final propertyId = latest.draft.propertyId;
    if (propertyId == null) {
      state = AsyncData(
        latest.copyWith(
          saveError: 'Enregistrez le brouillon avant d\'ajouter des photos.',
          saveStatus: SaveDraftStatus.failed,
        ),
      );
      return;
    }
    var photos = [...latest.draft.photos];
    for (final file in files) {
      final header = file.bytes.length > 16
          ? file.bytes.sublist(0, 16)
          : file.bytes;
      final mime = PublishRules.detectImageMime(
        header,
        filename: file.filename,
      );
      final error = PublishRules.photoError(
        size: file.size,
        mime: mime,
        currentCount: photos.length,
      );
      if (error.isNotEmpty) {
        photos = [
          ...photos,
          PublishPhoto(
            localId: file.localId,
            path: file.path,
            filename: file.filename,
            mimeType: mime,
            size: file.size,
            bytes: file.bytes,
            status: PhotoUploadStatus.failed,
            error: error,
          ),
        ];
        continue;
      }
      photos = [
        ...photos,
        PublishPhoto(
          localId: file.localId,
          path: file.path,
          filename: file.filename,
          mimeType: mime,
          size: file.size,
          bytes: file.bytes,
          status: PhotoUploadStatus.local,
        ),
      ];
    }
    state = AsyncData(
      latest.copyWith(draft: latest.draft.copyWith(photos: photos)),
    );
    for (final photo in photos) {
      if (photo.status == PhotoUploadStatus.local && photo.bytes != null) {
        await _uploadPhoto(photo);
      }
    }
  }

  Future<void> _uploadPhoto(PublishPhoto photo) async {
    final current = state.value;
    if (current == null || photo.bytes == null || photo.mimeType == null) {
      return;
    }
    final propertyId = current.draft.propertyId;
    if (propertyId == null) {
      return;
    }
    _replacePhoto(
      photo.copyWith(status: PhotoUploadStatus.uploading, clearError: true),
    );
    try {
      final item = await ref
          .read(mediaUploadRepositoryProvider)
          .uploadImage(
            propertyId: propertyId,
            bytes: photo.bytes!,
            mimeType: photo.mimeType!,
            filename: photo.filename,
          );
      _replacePhoto(
        photo.copyWith(
          mediaId: item.id,
          previewUrl: item.previewUrl,
          status: PhotoUploadStatus.uploaded,
          isPrimary: item.isPrimary,
          clearError: true,
          clearBytes: true,
        ),
      );
    } catch (error) {
      _replacePhoto(
        photo.copyWith(
          status: PhotoUploadStatus.failed,
          error: _failure(error).message,
        ),
      );
      return;
    }
    try {
      final latest = state.value;
      if (latest != null) {
        await _syncOrder(latest.draft);
      }
    } catch (_) {
      // L'ordre est un complément : le média reste confirmé par Nest.
    }
  }

  void _replacePhoto(PublishPhoto updated) {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = AsyncData(
      current.copyWith(
        draft: current.draft.copyWith(
          photos: [
            for (final photo in current.draft.photos)
              if (photo.localId == updated.localId) updated else photo,
          ],
        ),
      ),
    );
  }

  Future<void> _syncOrder(PublishDraft draft) async {
    final ids = [
      for (final photo in draft.photos)
        if (photo.mediaId != null) photo.mediaId!,
    ];
    if (draft.propertyId == null || ids.isEmpty) {
      return;
    }
    await ref
        .read(mediaUploadRepositoryProvider)
        .reorder(draft.propertyId!, ids);
  }

  Map<String, String> _validateStep(
    PublishDraft draft,
    PublishStep step,
    List<CatalogOption> types,
  ) {
    final errors = <String, String>{};
    switch (step) {
      case PublishStep.offer:
        if (draft.listingType.isEmpty) {
          errors['listingType'] = 'Choisissez un type de transaction.';
        }
        if (draft.propertyType.isEmpty) {
          errors['propertyType'] = 'Choisissez un type de bien.';
        }
      case PublishStep.basics:
        final title = PublishRules.titleError(draft.title);
        if (title != null) {
          errors['title'] = title;
        }
        if (draft.isLand) {
          if (draft.landSurface != null && draft.landSurface! < 1) {
            errors['landSurface'] = 'Surface minimale : 1 m².';
          }
        } else if (draft.surface != null && draft.surface! < 1) {
          errors['surface'] = 'Surface minimale : 1 m².';
        }
      case PublishStep.location:
        if (draft.communeCode == null) {
          errors['commune'] = 'Choisissez une commune.';
        }
        if (draft.neighborhoodCode == null) {
          errors['neighborhood'] = 'Choisissez un quartier.';
        }
        final coords = PublishRules.coordinatesError(
          draft.latitude,
          draft.longitude,
        );
        if (coords != null) {
          errors['coordinates'] = coords;
        }
      case PublishStep.price:
        if (!PublishRules.isPeriodAllowed(draft.listingType, draft.period)) {
          errors['period'] = 'Période incompatible avec ce type d\'offre.';
        }
        final amount = PublishRules.amountError(draft.amount, required: false);
        if (amount != null) {
          errors['amount'] = amount;
        }
      case PublishStep.features:
      case PublishStep.photos:
        break;
      case PublishStep.description:
        final description = PublishRules.descriptionError(draft.description);
        if (description != null) {
          errors['description'] = description;
        }
      case PublishStep.recap:
        errors.addAll(_validatePublish(draft));
    }
    return errors;
  }

  Map<String, String> _validatePublish(PublishDraft draft) {
    final errors = _validateStep(draft, PublishStep.offer, const []);
    errors.addAll(_validateStep(draft, PublishStep.basics, const []));
    errors.addAll(_validateStep(draft, PublishStep.location, const []));
    final amount = PublishRules.amountError(draft.amount, required: true);
    if (amount != null) {
      errors['amount'] = amount;
    }
    if (!PublishRules.isPeriodAllowed(draft.listingType, draft.period)) {
      errors['period'] = 'Période incompatible avec ce type d\'offre.';
    }
    for (final field in draft.completenessGaps) {
      errors[field] =
          'Requis pour publier : ${PublishRules.completenessLabel(field)}.';
    }
    return errors;
  }

  String? _categoryOf(String code, List<CatalogOption> types) {
    for (final type in types) {
      if (type.code == code) {
        return type.category;
      }
    }
    return PublishRules.categoryOf(code);
  }

  AppFailure _failure(Object error) {
    if (error is AppFailure) {
      return error;
    }
    return const UnexpectedFailure();
  }
}

String publishSaveLabel(SaveDraftStatus status) {
  return switch (status) {
    SaveDraftStatus.idle => 'Brouillon',
    SaveDraftStatus.saving => 'Enregistrement…',
    SaveDraftStatus.saved => 'Enregistré',
    SaveDraftStatus.failed => 'Échec de l\'enregistrement',
  };
}

String publishOutcomeMessage(String status) {
  return switch (status) {
    'PENDING_REVIEW' =>
      'Annonce envoyée. Le statut officiel est « ${ListingStatusLabels.of(status)} ». Un modérateur doit encore la valider.',
    'PUBLISHED' =>
      'Annonce publiée. Le statut officiel est « ${ListingStatusLabels.of(status)} ».',
    _ => 'Statut officiel : ${ListingStatusLabels.of(status)}.',
  };
}
