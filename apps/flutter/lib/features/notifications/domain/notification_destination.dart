import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';
import 'inbox_notification.dart';

/// Destination de navigation issue d'une notification ou d'un lien.
///
/// Les identifiants absents ou mal formés produisent [NotificationKind.unknown]
/// : jamais d'ouverture vers une ressource inventée.
enum NotificationKind {
  listing,
  savedSearch,
  conversation,
  appointment,
  explore,
  notifications,
  favorites,
  resetPassword,
  unknown,
}

class NotificationDestination {
  const NotificationDestination._({
    required this.kind,
    this.id,
    this.query = const {},
  });

  factory NotificationDestination.listing(String listingId) {
    return NotificationDestination._(
      kind: NotificationKind.listing,
      id: listingId,
    );
  }

  factory NotificationDestination.savedSearch(String savedSearchId) {
    return NotificationDestination._(
      kind: NotificationKind.savedSearch,
      id: savedSearchId,
    );
  }

  factory NotificationDestination.conversation(String conversationId) {
    return NotificationDestination._(
      kind: NotificationKind.conversation,
      id: conversationId,
    );
  }

  factory NotificationDestination.appointment(String appointmentId) {
    return NotificationDestination._(
      kind: NotificationKind.appointment,
      id: appointmentId,
    );
  }

  factory NotificationDestination.explore([
    Map<String, String> query = const {},
  ]) {
    return NotificationDestination._(
      kind: NotificationKind.explore,
      query: query,
    );
  }

  factory NotificationDestination.notifications() {
    return const NotificationDestination._(
      kind: NotificationKind.notifications,
    );
  }

  factory NotificationDestination.favorites() {
    return const NotificationDestination._(kind: NotificationKind.favorites);
  }

  factory NotificationDestination.resetPassword({String? token}) {
    return NotificationDestination._(
      kind: NotificationKind.resetPassword,
      query: token == null || token.isEmpty ? const {} : {'token': token},
    );
  }

  factory NotificationDestination.unknown() {
    return const NotificationDestination._(kind: NotificationKind.unknown);
  }

  final NotificationKind kind;
  final String? id;
  final Map<String, String> query;

  bool get requiresAuth => switch (kind) {
    NotificationKind.savedSearch ||
    NotificationKind.conversation ||
    NotificationKind.appointment ||
    NotificationKind.notifications ||
    NotificationKind.favorites => true,
    _ => false,
  };

  bool get isUnknown => kind == NotificationKind.unknown;

  /// Priorité : type métier, puis identifiants stables du payload inbox.
  factory NotificationDestination.fromInbox(InboxNotification notification) {
    return NotificationDestination.fromPayload(
      type: notification.type,
      listingId: notification.listingId,
      savedSearchId: notification.savedSearchId,
      conversationId: notification.conversationId,
      appointmentId: notification.appointmentId,
    );
  }

  /// Payload push Nest : `{ notificationId, type }` ; clés métier optionnelles.
  factory NotificationDestination.fromPayload({
    String? type,
    String? listingId,
    String? savedSearchId,
    String? conversationId,
    String? appointmentId,
    String? notificationId,
  }) {
    final normalizedType = type?.trim().toUpperCase();
    if (normalizedType == 'MESSAGE' && _uuid(conversationId) != null) {
      return NotificationDestination.conversation(conversationId!.trim());
    }
    if (normalizedType == 'APPOINTMENT' && _uuid(appointmentId) != null) {
      return NotificationDestination.appointment(appointmentId!.trim());
    }
    final listing = _uuid(listingId);
    if (listing != null) {
      return NotificationDestination.listing(listing);
    }
    final saved = _uuid(savedSearchId);
    if (saved != null) {
      return NotificationDestination.savedSearch(saved);
    }
    final conversation = _uuid(conversationId);
    if (conversation != null) {
      return NotificationDestination.conversation(conversation);
    }
    final appointment = _uuid(appointmentId);
    if (appointment != null) {
      return NotificationDestination.appointment(appointment);
    }
    if (_uuid(notificationId) != null ||
        (normalizedType != null && normalizedType.isNotEmpty)) {
      return NotificationDestination.notifications();
    }
    return NotificationDestination.unknown();
  }

  factory NotificationDestination.fromDataMap(Map<String, Object?> data) {
    return NotificationDestination.fromPayload(
      type: asNonEmptyString(data['type']),
      listingId: asNonEmptyString(data['listingId']),
      savedSearchId: asNonEmptyString(data['savedSearchId']),
      conversationId: asNonEmptyString(data['conversationId']),
      appointmentId: asNonEmptyString(data['appointmentId']),
      notificationId: asNonEmptyString(data['notificationId']),
    );
  }

  static String? _uuid(String? value) {
    if (value == null) {
      return null;
    }
    final trimmed = value.trim();
    return PublicIds.isUuid(trimmed) ? trimmed : null;
  }
}

abstract final class NotificationCatalog {
  static String categoryLabel(String category) {
    return switch (category) {
      'ACCOUNT' => 'Compte et sécurité',
      'MESSAGES' => 'Messages',
      'VISITS' => 'Demandes de visite',
      'APPOINTMENT_REMINDERS' => 'Rappels de visite',
      'RECOMMENDATIONS' => 'Recommandations',
      'PRICE_DROPS' => 'Baisse de prix',
      'SAVED_SEARCHES' => 'Alertes de recherche',
      'LISTING_UPDATES' => 'Annonces suivies',
      'MARKETING' => 'Offres et actualités',
      _ => 'Notification',
    };
  }

  static String typeLabel(String type) {
    return switch (type) {
      'NEW_RECOMMENDATION' => 'Recommandation',
      'PRICE_DROP' => 'Baisse de prix',
      'NEW_PROPERTY' => 'Nouvelle annonce',
      'APPOINTMENT' => 'Visite',
      'MESSAGE' => 'Message',
      'VERIFICATION' => 'Vérification',
      'SYSTEM' => 'Information',
      'REPORT' => 'Signalement',
      _ => 'Notification',
    };
  }
}
