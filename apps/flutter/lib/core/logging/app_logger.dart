import 'package:flutter/foundation.dart';

/// Journalisation minimale. Désactivée en production via [enabled].
class AppLogger {
  const AppLogger({required this.enabled});

  final bool enabled;

  void debug(String message) {
    if (!enabled) {
      return;
    }
    debugPrint(message);
  }
}
