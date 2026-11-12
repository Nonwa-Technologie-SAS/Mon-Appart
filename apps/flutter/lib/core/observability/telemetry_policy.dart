import '../../app/config/app_environment.dart';
import 'telemetry_event.dart';

/// Seuils initiaux. Ce ne sont pas des performances mesurées en production.
abstract final class TelemetryBudgets {
  static const startupToFirstFrame = Duration(milliseconds: 2500);
  static const slowRequest = Duration(milliseconds: 2000);
  static const slowFrame = Duration(milliseconds: 32);
  static const frameFlushCount = 120;
  static const maxBuffered = 100;
  static const maxIncidents = 20;
  static const dedupeWindow = Duration(minutes: 1);
}

class TelemetryPolicy {
  const TelemetryPolicy({required this.mediumRate, required this.lowRate});

  final double mediumRate;
  final double lowRate;

  factory TelemetryPolicy.forEnvironment(AppEnvironment environment) {
    return switch (environment) {
      AppEnvironment.local => const TelemetryPolicy(mediumRate: 1, lowRate: 1),
      AppEnvironment.staging => const TelemetryPolicy(
        mediumRate: 0.5,
        lowRate: 0.2,
      ),
      AppEnvironment.production => const TelemetryPolicy(
        mediumRate: 0.2,
        lowRate: 0.05,
      ),
    };
  }

  /// Les crashs et erreurs hautes ne sont jamais échantillonnés.
  bool keep(TelemetrySeverity severity, double roll) {
    if (severity == TelemetrySeverity.critical ||
        severity == TelemetrySeverity.high) {
      return true;
    }
    final rate = severity == TelemetrySeverity.medium ? mediumRate : lowRate;
    return roll < rate;
  }
}
