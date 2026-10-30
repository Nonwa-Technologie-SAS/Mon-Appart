import 'dart:convert';

Object? jsonSafe(Object? value) {
  if (value == null || value is num || value is bool) {
    return value;
  }
  if (value is String) {
    return value;
  }
  if (value is DateTime) {
    return value.toUtc().toIso8601String();
  }
  if (value is List) {
    return [for (final item in value) jsonSafe(item)];
  }
  if (value is Map) {
    return {
      for (final entry in value.entries)
        entry.key.toString(): jsonSafe(entry.value),
    };
  }
  return value.toString();
}

String encodeJsonObject(Map<String, Object?> value) {
  return jsonEncode(jsonSafe(value));
}

Map<String, Object?> decodeJsonObject(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is Map<String, Object?>) {
    return decoded;
  }
  if (decoded is Map) {
    return decoded.map((key, value) => MapEntry(key.toString(), value));
  }
  throw const FormatException('Objet JSON attendu.');
}
