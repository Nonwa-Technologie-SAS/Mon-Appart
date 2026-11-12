import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

import 'frame_window.dart';
import 'telemetry_client.dart';
import 'telemetry_event.dart';
import 'telemetry_redactor.dart';

/// Branche les erreurs Flutter sans remplacer le comportement déjà installé.
class FlutterTelemetryHooks {
  static TelemetryClient? _active;
  static var _installed = false;

  static void attach(TelemetryClient client) {
    _active = client;
    if (_installed) {
      return;
    }
    _installed = true;
    _installFrames();
    final previousFlutter = FlutterError.onError;
    FlutterError.onError = (details) {
      _recordFlutter(details);
      previousFlutter?.call(details);
    };
    final previousPlatform = PlatformDispatcher.instance.onError;
    PlatformDispatcher.instance.onError = (error, stack) {
      _recordAsync(error, stack);
      return previousPlatform?.call(error, stack) ?? false;
    };
  }

  static void detach(TelemetryClient client) {
    if (identical(_active, client)) {
      _active = null;
    }
  }

  static void _installFrames() {
    if (!(kReleaseMode || kProfileMode)) {
      return;
    }
    final window = FrameWindow();
    SchedulerBinding.instance.addTimingsCallback((timings) {
      final client = _active;
      if (client == null) {
        return;
      }
      for (final timing in timings) {
        window.add(timing.totalSpan);
      }
      if (!window.shouldFlush) {
        return;
      }
      final total = window.total;
      final slow = window.slow;
      window.reset();
      client.record(
        severity: slow > 0 ? TelemetrySeverity.medium : TelemetrySeverity.low,
        kind: TelemetryKind.performance,
        operation: 'frame.summary',
        message: 'Résumé de fluidité sur un lot de frames.',
        attributes: {'total': total, 'slow': slow},
      );
    });
  }

  static void _recordFlutter(FlutterErrorDetails details) {
    final client = _active;
    if (client == null) {
      return;
    }
    client.record(
      severity: TelemetrySeverity.high,
      kind: TelemetryKind.crash,
      operation: 'flutter.framework',
      message: redactText(details.exceptionAsString()),
      attributes: {
        'library': details.library ?? '',
        'stack': redactText(details.stack?.toString() ?? ''),
      },
    );
  }

  static void _recordAsync(Object error, StackTrace stack) {
    final client = _active;
    if (client == null) {
      return;
    }
    client.record(
      severity: TelemetrySeverity.critical,
      kind: TelemetryKind.crash,
      operation: 'flutter.async',
      message: redactText(error.toString()),
      attributes: {'stack': redactText(stack.toString())},
    );
  }
}
