import '../../../core/search/search_catalog.dart';

/// Règles Nest `listing-price.ts`, `property-rules.ts` et `media-policy.ts`.
abstract final class PublishRules {
  static const currency = 'XOF';
  static const maxAmount = 999999999999;
  static const titleMin = 3;
  static const titleMax = 200;
  static const descriptionMax = 5000;
  static const addressMax = 255;
  static const bedroomsMax = 100;
  static const bathroomsMax = 20;
  static const roomsMax = 100;
  static const floorMin = -5;
  static const floorMax = 200;
  static const yearBuiltMin = 1800;
  static const yearBuiltMax = 2100;
  static const maxPhotos = 30;
  static const photoLimitsLabel =
      'Jusqu\'à $maxPhotos photos JPEG, PNG, WebP ou AVIF (15 Mo).';
  static const maxImageBytes = 15 * 1024 * 1024;
  static const allowedImageMimes = <String>{
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  };

  static const coteIvoireBounds = (
    minLatitude: 4.2,
    maxLatitude: 10.8,
    minLongitude: -8.7,
    maxLongitude: -2.4,
  );

  static const allowedPeriods = <String, List<String>>{
    'SALE': ['TOTAL'],
    'RENT': ['MONTH', 'YEAR'],
    'SHORT_TERM_RENT': ['DAY', 'WEEK', 'MONTH'],
    'LEASE_TO_OWN': ['MONTH'],
  };

  static const landTitleValues = <String>[
    'ACD',
    'CPF',
    'LETTRE_ATTRIBUTION',
    'ATTESTATION_VILLAGEOISE',
    'AUTRE',
  ];

  static const standingValues = <String>['ECONOMIQUE', 'MOYEN', 'HAUT'];

  static String defaultPeriod(String listingType) {
    final periods = allowedPeriods[listingType];
    if (periods == null || periods.isEmpty) {
      return 'MONTH';
    }
    return periods.first;
  }

  static bool isPeriodAllowed(String listingType, String period) {
    return allowedPeriods[listingType]?.contains(period) ?? false;
  }

  static String categoryOf(String propertyType, {String? fromApi}) {
    if (fromApi != null && fromApi.isNotEmpty) {
      return fromApi;
    }
    return SearchCatalog.propertyTypeCategories[propertyType] ?? 'OTHER';
  }

  static bool isLand(String propertyType, {String? category}) {
    return (category ?? categoryOf(propertyType)) == 'LAND';
  }

  static bool isResidential(String propertyType, {String? category}) {
    return (category ?? categoryOf(propertyType)) == 'RESIDENTIAL';
  }

  static bool isBuildingOnly(String propertyType, {String? category}) {
    return !isLand(propertyType, category: category);
  }

  static List<String> missingForCompleteness({
    required String title,
    required String propertyType,
    required String? category,
    required double? latitude,
    required double? longitude,
    required num? surface,
    required num? landSurface,
    required int? bedrooms,
    required int? bathrooms,
  }) {
    final missing = <String>[];
    if (title.trim().isEmpty) {
      missing.add('title');
    }
    if (latitude == null || longitude == null) {
      missing.add('coordinates');
    }
    final cat = category ?? categoryOf(propertyType);
    if (cat == 'LAND') {
      if (landSurface == null) {
        missing.add('landSurface');
      }
    } else if (surface == null) {
      missing.add('surface');
    }
    if (cat == 'RESIDENTIAL') {
      if (bedrooms == null) {
        missing.add('bedrooms');
      }
      if (bathrooms == null) {
        missing.add('bathrooms');
      }
    }
    return missing;
  }

  static String? titleError(String title) {
    final trimmed = title.trim();
    if (trimmed.isEmpty) {
      return 'Le titre est obligatoire.';
    }
    if (trimmed.length < titleMin) {
      return 'Le titre doit contenir au moins $titleMin caractères.';
    }
    if (trimmed.length > titleMax) {
      return 'Le titre ne peut pas dépasser $titleMax caractères.';
    }
    return null;
  }

  static String? descriptionError(String description) {
    if (description.length > descriptionMax) {
      return 'La description ne peut pas dépasser $descriptionMax caractères.';
    }
    return null;
  }

  static String? amountError(int? amount, {required bool required}) {
    if (amount == null) {
      return required ? 'Le montant est obligatoire pour publier.' : null;
    }
    if (amount <= 0 || amount > maxAmount) {
      return 'Montant entier strictement positif, jusqu\'à $maxAmount.';
    }
    return null;
  }

  static int? parseAmount(String raw) {
    final cleaned = raw
        .replaceAll(RegExp(r'[\s\u00A0]'), '')
        .replaceAll(',', '');
    if (cleaned.isEmpty) {
      return null;
    }
    if (cleaned.contains('.') || cleaned.contains(',')) {
      return null;
    }
    return int.tryParse(cleaned);
  }

  static String? integerFieldError(
    String raw, {
    required int min,
    required int max,
    String? emptyMessage,
  }) {
    if (raw.trim().isEmpty) {
      return emptyMessage;
    }
    final value = int.tryParse(raw.trim());
    if (value == null) {
      return 'Nombre entier attendu.';
    }
    if (value < min || value > max) {
      return 'Valeur entre $min et $max.';
    }
    return null;
  }

  static String? surfaceError(String raw, {required bool required}) {
    if (raw.trim().isEmpty) {
      return required ? 'La surface est obligatoire.' : null;
    }
    final value = num.tryParse(raw.trim().replaceAll(',', '.'));
    if (value == null || value < 1) {
      return 'Surface minimale : 1 m².';
    }
    return null;
  }

  static bool coordinatesInCoteIvoire(double latitude, double longitude) {
    return latitude >= coteIvoireBounds.minLatitude &&
        latitude <= coteIvoireBounds.maxLatitude &&
        longitude >= coteIvoireBounds.minLongitude &&
        longitude <= coteIvoireBounds.maxLongitude;
  }

  static String? coordinatesError(double? latitude, double? longitude) {
    if (latitude == null && longitude == null) {
      return null;
    }
    if (latitude == null || longitude == null) {
      return 'Latitude et longitude vont ensemble.';
    }
    if (!coordinatesInCoteIvoire(latitude, longitude)) {
      return 'Coordonnées hors de Côte d\'Ivoire.';
    }
    return null;
  }

  static String? detectImageMime(List<int> header, {String? filename}) {
    if (header.length >= 3 &&
        header[0] == 0xFF &&
        header[1] == 0xD8 &&
        header[2] == 0xFF) {
      return 'image/jpeg';
    }
    if (header.length >= 8 &&
        header[0] == 0x89 &&
        header[1] == 0x50 &&
        header[2] == 0x4E &&
        header[3] == 0x47) {
      return 'image/png';
    }
    if (header.length >= 12 &&
        header[0] == 0x52 &&
        header[1] == 0x49 &&
        header[2] == 0x46 &&
        header[3] == 0x46 &&
        header[8] == 0x57 &&
        header[9] == 0x45 &&
        header[10] == 0x42 &&
        header[11] == 0x50) {
      return 'image/webp';
    }
    if (_isAvif(header)) {
      return 'image/avif';
    }
    final lower = filename?.toLowerCase() ?? '';
    if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
      return null;
    }
    return null;
  }

  static bool _isAvif(List<int> header) {
    if (header.length < 12) {
      return false;
    }
    final brand = String.fromCharCodes(header.sublist(4, 8));
    if (brand != 'ftyp') {
      return false;
    }
    final minor = String.fromCharCodes(header.sublist(8, 12));
    return minor == 'avif' || minor == 'avis';
  }

  static String photoError({
    required int size,
    required String? mime,
    required int currentCount,
  }) {
    if (currentCount >= maxPhotos) {
      return 'Maximum $maxPhotos photos par bien.';
    }
    if (size > maxImageBytes) {
      return 'Fichier trop volumineux (max 15 Mo).';
    }
    if (mime == null || !allowedImageMimes.contains(mime)) {
      return 'Format non pris en charge (JPEG, PNG, WebP ou AVIF).';
    }
    return '';
  }

  static String completenessLabel(String field) {
    return switch (field) {
      'title' => 'titre',
      'coordinates' => 'coordonnées',
      'surface' => 'surface habitable',
      'landSurface' => 'surface du terrain',
      'bedrooms' => 'chambres',
      'bathrooms' => 'salles de bains',
      _ => field,
    };
  }
}

enum PublishStep {
  offer,
  basics,
  location,
  price,
  features,
  photos,
  description,
  recap,
}

extension PublishStepLabels on PublishStep {
  String get title {
    return switch (this) {
      PublishStep.offer => 'Type d\'annonce',
      PublishStep.basics => 'Informations du bien',
      PublishStep.location => 'Localisation',
      PublishStep.price => 'Prix',
      PublishStep.features => 'Caractéristiques',
      PublishStep.photos => 'Photos',
      PublishStep.description => 'Description',
      PublishStep.recap => 'Vérification',
    };
  }
}

enum SaveDraftStatus { idle, saving, saved, failed }

enum PhotoUploadStatus { local, uploading, uploaded, failed }
