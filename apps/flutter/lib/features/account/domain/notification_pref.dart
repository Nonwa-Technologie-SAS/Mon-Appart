import '../../../core/json/json_map.dart';

class NotificationPrefCell {
  const NotificationPrefCell({
    required this.category,
    required this.channel,
    required this.enabled,
    required this.locked,
    required this.available,
  });

  final String category;
  final String channel;
  final bool enabled;
  final bool locked;
  final bool available;

  bool get canToggle => available && !locked;

  String get categoryLabel => switch (category) {
    'ACCOUNT' => 'Compte et sécurité',
    'MESSAGES' => 'Messages',
    'VISITS' => 'Demandes de visite',
    'APPOINTMENT_REMINDERS' => 'Rappels de visite',
    'RECOMMENDATIONS' => 'Recommandations',
    'PRICE_DROPS' => 'Baisse de prix',
    'SAVED_SEARCHES' => 'Alertes de recherche',
    'LISTING_UPDATES' => 'Annonces suivies',
    'MARKETING' => 'Offres et actualités',
    _ => category,
  };

  String get channelLabel => switch (channel) {
    'IN_APP' => 'Dans l\'application',
    'EMAIL' => 'E-mail',
    'SMS' => 'SMS',
    'PUSH' => 'Notification push',
    'WHATSAPP' => 'WhatsApp',
    _ => channel,
  };

  Map<String, Object?> toChange({required bool enabled}) {
    return {'category': category, 'channel': channel, 'enabled': enabled};
  }

  static NotificationPrefCell? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final category = asNonEmptyString(json['category']);
    final channel = asNonEmptyString(json['channel']);
    if (category == null || channel == null) {
      return null;
    }
    return NotificationPrefCell(
      category: category,
      channel: channel,
      enabled: json['enabled'] == true,
      locked: json['locked'] == true,
      available: json['available'] == true,
    );
  }
}
