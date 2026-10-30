import '../widgets/status_badge.dart';

abstract final class ListingStatusLabels {
  static String of(String status) {
    return switch (status) {
      'DRAFT' => 'Brouillon',
      'PENDING_REVIEW' => 'En revue',
      'PUBLISHED' => 'Publiée',
      'PAUSED' => 'En pause',
      'SUSPENDED' => 'Suspendue',
      'EXPIRED' => 'Expirée',
      'RENTED' => 'Louée',
      'SOLD' => 'Vendue',
      'ARCHIVED' => 'Archivée',
      _ => status,
    };
  }

  static StatusBadgeTone tone(String status) {
    return switch (status) {
      'PUBLISHED' => StatusBadgeTone.success,
      'DRAFT' || 'PENDING_REVIEW' || 'PAUSED' => StatusBadgeTone.warning,
      'RENTED' || 'SOLD' => StatusBadgeTone.accent,
      _ => StatusBadgeTone.neutral,
    };
  }
}

abstract final class ListingManagerActions {
  static bool canPublish(String status) {
    return status == 'DRAFT' || status == 'PAUSED' || status == 'EXPIRED';
  }

  static bool canPause(String status) => status == 'PUBLISHED';

  static bool canMarkRented(String status, String listingType) {
    return (status == 'PUBLISHED' || status == 'PAUSED') &&
        (listingType == 'RENT' || listingType == 'LEASE_TO_OWN');
  }

  static bool canMarkSold(String status, String listingType) {
    return (status == 'PUBLISHED' || status == 'PAUSED') &&
        (listingType == 'SALE' || listingType == 'LEASE_TO_OWN');
  }

  static bool canArchive(String status) => status != 'ARCHIVED';
}
