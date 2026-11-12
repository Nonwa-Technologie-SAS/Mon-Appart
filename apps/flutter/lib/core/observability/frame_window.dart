import 'telemetry_policy.dart';

/// Agrège les frames. Un seul résumé est émis, pas un événement par frame.
class FrameWindow {
  var total = 0;
  var slow = 0;

  void add(Duration totalSpan) {
    total += 1;
    if (totalSpan > TelemetryBudgets.slowFrame) {
      slow += 1;
    }
  }

  bool get shouldFlush => total >= TelemetryBudgets.frameFlushCount;

  void reset() {
    total = 0;
    slow = 0;
  }
}
