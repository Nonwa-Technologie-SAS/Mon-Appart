import 'telemetry_event.dart';
import 'telemetry_policy.dart';

class TelemetryBuffer {
  final _items = <TelemetryEvent>[];

  List<TelemetryEvent> get items => List.unmodifiable(_items);

  void clear() => _items.clear();

  TelemetryEvent add(
    TelemetryEvent event, {
    required DateTime now,
    Duration window = TelemetryBudgets.dedupeWindow,
    int max = TelemetryBudgets.maxBuffered,
  }) {
    final index = _items.indexWhere(
      (existing) =>
          existing.fingerprint == event.fingerprint &&
          now.difference(existing.at) <= window,
    );
    if (index >= 0) {
      final merged = _items[index].copyWith(count: _items[index].count + 1);
      _items[index] = merged;
      return merged;
    }
    _items.add(event);
    while (_items.length > max) {
      _items.removeAt(0);
    }
    return event;
  }
}
