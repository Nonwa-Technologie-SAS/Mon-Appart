import '../json/json_map.dart';
import 'offline_json.dart';
import 'offline_policy.dart';

class CachedEnvelope {
  const CachedEnvelope({required this.payload, required this.fetchedAt});

  final Map<String, Object?> payload;
  final DateTime fetchedAt;

  bool isStale(Duration maxAge, {required DateTime now}) {
    return now.difference(fetchedAt) > maxAge;
  }

  Map<String, Object?> toJson() {
    return {
      'fetchedAt': fetchedAt.toUtc().toIso8601String(),
      'payload': payload,
    };
  }

  String encode() => encodeJsonObject(toJson());

  static CachedEnvelope? tryParse(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      final json = decodeJsonObject(raw);
      final fetchedAt = DateTime.tryParse(
        asNonEmptyString(json['fetchedAt']) ?? '',
      );
      final payload = asJsonMapOrNull(json['payload']);
      if (fetchedAt == null || payload == null) {
        return null;
      }
      return CachedEnvelope(payload: payload, fetchedAt: fetchedAt.toUtc());
    } on FormatException {
      return null;
    }
  }
}

class CachedRead<T> {
  const CachedRead({
    required this.value,
    required this.fetchedAt,
    required this.fromCache,
  });

  final T value;
  final DateTime fetchedAt;
  final bool fromCache;

  bool isStale(Duration maxAge, {required DateTime now}) {
    return now.difference(fetchedAt) > maxAge;
  }
}

String formatCachedAt(DateTime fetchedAt, {DateTime? now}) {
  final local = fetchedAt.toUtc();
  String two(int value) => value.toString().padLeft(2, '0');
  final stamp =
      '${local.day}/${local.month}/${local.year} à ${two(local.hour)}:${two(local.minute)}';
  final age = (now ?? DateTime.now().toUtc()).difference(fetchedAt);
  if (age > OfflinePolicy.staleListings) {
    return 'Enregistré le $stamp (peut être périmé)';
  }
  return 'Mis à jour le $stamp';
}
