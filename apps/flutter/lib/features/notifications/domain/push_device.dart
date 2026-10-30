import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

/// Appareil enregistré côté Nest. Le jeton n'est jamais renvoyé.
class PushDevice {
  const PushDevice({
    required this.id,
    required this.platform,
    this.lastSeenAt,
    this.createdAt,
  });

  final String id;
  final String platform;
  final DateTime? lastSeenAt;
  final DateTime? createdAt;

  static PushDevice? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final platform = asNonEmptyString(json['platform']);
    if (id == null || !PublicIds.isUuid(id) || platform == null) {
      return null;
    }
    return PushDevice(
      id: id,
      platform: platform,
      lastSeenAt: DateTime.tryParse(asNonEmptyString(json['lastSeenAt']) ?? ''),
      createdAt: DateTime.tryParse(asNonEmptyString(json['createdAt']) ?? ''),
    );
  }
}
