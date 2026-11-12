import 'dart:convert';

import 'offline_json.dart';
import 'offline_policy.dart';
import 'key_value_store.dart';
import 'pending_operation.dart';

class PendingQueue {
  PendingQueue({required this._store, DateTime Function()? clock})
    : _now = clock ?? DateTime.now;

  static const _key = 'queue/operations';

  final KeyValueStore _store;
  final DateTime Function() _now;

  DateTime get now => _now().toUtc();

  Future<List<PendingOperation>> list({String? userId}) async {
    final all = await _load();
    if (userId == null) {
      return all;
    }
    return [
      for (final op in all)
        if (op.userId == userId) op,
    ];
  }

  Future<List<PendingOperation>> openFor(String userId) async {
    return [
      for (final op in await list(userId: userId))
        if (op.isOpen) op,
    ];
  }

  Future<PendingOperation> enqueue(PendingOperation incoming) async {
    final all = await _load();
    final next = <PendingOperation>[];
    for (final op in all) {
      final sameUser = op.userId == incoming.userId;
      final sameSlot = op.coalescingKey == incoming.coalescingKey;
      if (sameUser && sameSlot && op.isOpen) {
        continue;
      }
      next.add(op);
    }
    next.add(incoming);
    while (next.length > OfflinePolicy.maxQueue) {
      next.removeAt(0);
    }
    await _save(next);
    return incoming;
  }

  Future<void> replace(PendingOperation updated) async {
    final all = await _load();
    await _save([
      for (final op in all)
        if (op.id == updated.id) updated else op,
    ]);
  }

  Future<void> remove(String id) async {
    final all = await _load();
    await _save([
      for (final op in all)
        if (op.id != id) op,
    ]);
  }

  Future<void> cancelOpen(String userId, String coalescingKey) async {
    final all = await _load();
    await _save([
      for (final op in all)
        if (op.userId == userId &&
            op.coalescingKey == coalescingKey &&
            op.isOpen)
          op.copyWith(status: PendingOpStatus.cancelled)
        else
          op,
    ]);
  }

  Future<void> clearUser(String userId) async {
    final all = await _load();
    await _save([
      for (final op in all)
        if (op.userId != userId) op,
    ]);
  }

  Future<List<PendingOperation>> _load() async {
    final raw = await _store.read(_key);
    if (raw == null || raw.isEmpty) {
      return const [];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return const [];
      }
      final recovered = <PendingOperation>[];
      for (final item in decoded) {
        final op = _recover(PendingOperation.tryParse(item));
        if (op != null) {
          recovered.add(op);
        }
      }
      return recovered;
    } on FormatException {
      return const [];
    }
  }

  static PendingOperation? _recover(PendingOperation? op) {
    if (op == null) {
      return null;
    }
    if (op.status == PendingOpStatus.running) {
      return op.copyWith(status: PendingOpStatus.pending);
    }
    return op;
  }

  Future<void> _save(List<PendingOperation> ops) {
    return _store.write(
      _key,
      jsonEncode([for (final op in ops) jsonSafe(op.toJson())]),
    );
  }
}
