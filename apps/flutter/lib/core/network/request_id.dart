import 'dart:math';

/// Identifiant de corrélation, aligné sur l'en-tête Nest `X-Request-ID`.
String createRequestId() {
  final random = Random.secure();
  final suffix = List<int>.generate(
    8,
    (_) => random.nextInt(256),
  ).map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return 'ma-$suffix';
}
