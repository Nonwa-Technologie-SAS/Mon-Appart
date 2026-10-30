import 'dart:math';

/// Identifiant anonyme `x-assistant-session` (UUID v4).
///
/// Conservé en mémoire process uniquement : Nest isole déjà les
/// conversations par session + TTL. Aucune persistance disque.
class AssistantSession {
  AssistantSession([String? id]) : id = id ?? createUuidV4();

  final String id;
}

final _hex = List<String>.generate(
  256,
  (i) => i.toRadixString(16).padLeft(2, '0'),
);

String createUuidV4() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return '${_hex[bytes[0]]}${_hex[bytes[1]]}${_hex[bytes[2]]}${_hex[bytes[3]]}-'
      '${_hex[bytes[4]]}${_hex[bytes[5]]}-'
      '${_hex[bytes[6]]}${_hex[bytes[7]]}-'
      '${_hex[bytes[8]]}${_hex[bytes[9]]}-'
      '${_hex[bytes[10]]}${_hex[bytes[11]]}${_hex[bytes[12]]}'
      '${_hex[bytes[13]]}${_hex[bytes[14]]}${_hex[bytes[15]]}';
}
