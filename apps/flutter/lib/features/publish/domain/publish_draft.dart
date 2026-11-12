import 'publish_rules.dart';

class CatalogOption {
  const CatalogOption({required this.code, required this.name, this.category});

  final String code;
  final String name;
  final String? category;
}

class PublishPhoto {
  const PublishPhoto({
    required this.localId,
    this.mediaId,
    this.path,
    this.previewUrl,
    this.filename,
    this.mimeType,
    this.size = 0,
    this.status = PhotoUploadStatus.local,
    this.error,
    this.isPrimary = false,
    this.bytes,
  });

  final String localId;
  final String? mediaId;
  final String? path;
  final String? previewUrl;
  final String? filename;
  final String? mimeType;
  final int size;
  final PhotoUploadStatus status;
  final String? error;
  final bool isPrimary;
  final List<int>? bytes;

  bool get isUploaded =>
      status == PhotoUploadStatus.uploaded && mediaId != null;

  PublishPhoto copyWith({
    String? mediaId,
    String? path,
    String? previewUrl,
    String? mimeType,
    int? size,
    PhotoUploadStatus? status,
    String? error,
    bool? isPrimary,
    List<int>? bytes,
    bool clearError = false,
    bool clearBytes = false,
  }) {
    return PublishPhoto(
      localId: localId,
      mediaId: mediaId ?? this.mediaId,
      path: path ?? this.path,
      previewUrl: previewUrl ?? this.previewUrl,
      filename: filename,
      mimeType: mimeType ?? this.mimeType,
      size: size ?? this.size,
      status: status ?? this.status,
      error: clearError ? null : (error ?? this.error),
      isPrimary: isPrimary ?? this.isPrimary,
      bytes: clearBytes ? null : (bytes ?? this.bytes),
    );
  }
}

class PublishDraft {
  const PublishDraft({
    this.propertyId,
    this.listingId,
    this.listingType = 'RENT',
    this.propertyType = '',
    this.propertyCategory,
    this.title = '',
    this.description = '',
    this.communeCode,
    this.neighborhoodCode,
    this.address = '',
    this.latitude,
    this.longitude,
    this.locationVisibility = 'APPROXIMATE',
    this.bedrooms,
    this.bathrooms,
    this.rooms,
    this.floor,
    this.totalFloors,
    this.yearBuilt,
    this.surface,
    this.landSurface,
    this.amount,
    this.period = 'MONTH',
    this.currency = PublishRules.currency,
    this.amenityCodes = const [],
    this.attributes = const {},
    this.photos = const [],
    this.listingStatus = 'DRAFT',
    this.propertyStatus = 'DRAFT',
    this.missingCompleteness = const [],
    this.moderationNotes = const [],
  });

  final String? propertyId;
  final String? listingId;
  final String listingType;
  final String propertyType;
  final String? propertyCategory;
  final String title;
  final String description;
  final String? communeCode;
  final String? neighborhoodCode;
  final String address;
  final double? latitude;
  final double? longitude;
  final String locationVisibility;
  final int? bedrooms;
  final int? bathrooms;
  final int? rooms;
  final int? floor;
  final int? totalFloors;
  final int? yearBuilt;
  final num? surface;
  final num? landSurface;
  final int? amount;
  final String period;
  final String currency;
  final List<String> amenityCodes;
  final Map<String, Object?> attributes;
  final List<PublishPhoto> photos;
  final String listingStatus;
  final String propertyStatus;
  final List<String> missingCompleteness;
  final List<String> moderationNotes;

  bool get hasServerDraft => propertyId != null && listingId != null;

  bool get listingTypeLocked => listingId != null;

  bool get isLand =>
      PublishRules.isLand(propertyType, category: propertyCategory);

  bool get isResidential =>
      PublishRules.isResidential(propertyType, category: propertyCategory);

  bool get canCreateProperty {
    return PublishRules.titleError(title) == null &&
        propertyType.isNotEmpty &&
        communeCode != null &&
        communeCode!.isNotEmpty &&
        neighborhoodCode != null &&
        neighborhoodCode!.isNotEmpty;
  }

  List<String> get completenessGaps {
    return PublishRules.missingForCompleteness(
      title: title,
      propertyType: propertyType,
      category: propertyCategory,
      latitude: latitude,
      longitude: longitude,
      surface: surface,
      landSurface: landSurface,
      bedrooms: bedrooms,
      bathrooms: bathrooms,
    );
  }

  bool get hasUploadingPhotos =>
      photos.any((photo) => photo.status == PhotoUploadStatus.uploading);

  bool get hasFailedPhotos =>
      photos.any((photo) => photo.status == PhotoUploadStatus.failed);

  PublishDraft copyWith({
    String? propertyId,
    String? listingId,
    String? listingType,
    String? propertyType,
    String? propertyCategory,
    String? title,
    String? description,
    String? communeCode,
    String? neighborhoodCode,
    bool clearNeighborhood = false,
    String? address,
    double? latitude,
    double? longitude,
    bool clearLatitude = false,
    bool clearLongitude = false,
    String? locationVisibility,
    int? bedrooms,
    int? bathrooms,
    int? rooms,
    int? floor,
    int? totalFloors,
    int? yearBuilt,
    num? surface,
    num? landSurface,
    int? amount,
    bool clearAmount = false,
    String? period,
    List<String>? amenityCodes,
    Map<String, Object?>? attributes,
    List<PublishPhoto>? photos,
    String? listingStatus,
    String? propertyStatus,
    List<String>? missingCompleteness,
    List<String>? moderationNotes,
    bool clearBedrooms = false,
    bool clearBathrooms = false,
    bool clearRooms = false,
    bool clearFloor = false,
    bool clearTotalFloors = false,
    bool clearYearBuilt = false,
    bool clearSurface = false,
    bool clearLandSurface = false,
  }) {
    return PublishDraft(
      propertyId: propertyId ?? this.propertyId,
      listingId: listingId ?? this.listingId,
      listingType: listingType ?? this.listingType,
      propertyType: propertyType ?? this.propertyType,
      propertyCategory: propertyCategory ?? this.propertyCategory,
      title: title ?? this.title,
      description: description ?? this.description,
      communeCode: communeCode ?? this.communeCode,
      neighborhoodCode: clearNeighborhood
          ? null
          : (neighborhoodCode ?? this.neighborhoodCode),
      address: address ?? this.address,
      latitude: clearLatitude ? null : (latitude ?? this.latitude),
      longitude: clearLongitude ? null : (longitude ?? this.longitude),
      locationVisibility: locationVisibility ?? this.locationVisibility,
      bedrooms: clearBedrooms ? null : (bedrooms ?? this.bedrooms),
      bathrooms: clearBathrooms ? null : (bathrooms ?? this.bathrooms),
      rooms: clearRooms ? null : (rooms ?? this.rooms),
      floor: clearFloor ? null : (floor ?? this.floor),
      totalFloors: clearTotalFloors ? null : (totalFloors ?? this.totalFloors),
      yearBuilt: clearYearBuilt ? null : (yearBuilt ?? this.yearBuilt),
      surface: clearSurface ? null : (surface ?? this.surface),
      landSurface: clearLandSurface ? null : (landSurface ?? this.landSurface),
      amount: clearAmount ? null : (amount ?? this.amount),
      period: period ?? this.period,
      currency: currency,
      amenityCodes: amenityCodes ?? this.amenityCodes,
      attributes: attributes ?? this.attributes,
      photos: photos ?? this.photos,
      listingStatus: listingStatus ?? this.listingStatus,
      propertyStatus: propertyStatus ?? this.propertyStatus,
      missingCompleteness: missingCompleteness ?? this.missingCompleteness,
      moderationNotes: moderationNotes ?? this.moderationNotes,
    );
  }
}

class PublishWizardState {
  const PublishWizardState({
    required this.draft,
    this.step = PublishStep.offer,
    this.saveStatus = SaveDraftStatus.idle,
    this.saveError,
    this.submitError,
    this.submitting = false,
    this.dirty = false,
    this.propertyTypes = const [],
    this.amenities = const [],
    this.fieldErrors = const {},
    this.submittedStatus,
  });

  final PublishDraft draft;
  final PublishStep step;
  final SaveDraftStatus saveStatus;
  final String? saveError;
  final String? submitError;
  final bool submitting;
  final bool dirty;
  final List<CatalogOption> propertyTypes;
  final List<CatalogOption> amenities;
  final Map<String, String> fieldErrors;
  final String? submittedStatus;

  int get stepIndex => PublishStep.values.indexOf(step);

  int get stepCount => PublishStep.values.length;

  PublishWizardState copyWith({
    PublishDraft? draft,
    PublishStep? step,
    SaveDraftStatus? saveStatus,
    String? saveError,
    String? submitError,
    bool? submitting,
    bool? dirty,
    List<CatalogOption>? propertyTypes,
    List<CatalogOption>? amenities,
    Map<String, String>? fieldErrors,
    String? submittedStatus,
    bool clearSaveError = false,
    bool clearSubmitError = false,
    bool clearSubmittedStatus = false,
  }) {
    return PublishWizardState(
      draft: draft ?? this.draft,
      step: step ?? this.step,
      saveStatus: saveStatus ?? this.saveStatus,
      saveError: clearSaveError ? null : (saveError ?? this.saveError),
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
      submitting: submitting ?? this.submitting,
      dirty: dirty ?? this.dirty,
      propertyTypes: propertyTypes ?? this.propertyTypes,
      amenities: amenities ?? this.amenities,
      fieldErrors: fieldErrors ?? this.fieldErrors,
      submittedStatus: clearSubmittedStatus
          ? null
          : (submittedStatus ?? this.submittedStatus),
    );
  }
}
