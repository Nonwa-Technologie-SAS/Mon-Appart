import 'dart:convert';
import 'dart:io';

import 'key_value_store.dart';

/// Fichier JSON unique dans le répertoire applicatif. Pas de jetons.
class FileKeyValueStore implements KeyValueStore {
  FileKeyValueStore(this.file);

  final File file;
  Map<String, String>? _cache;
  Future<void>? _loading;
  Future<void> _writes = Future.value();

  Future<Map<String, String>> _ensure() async {
    final cached = _cache;
    if (cached != null) {
      return cached;
    }
    final pending = _loading;
    if (pending != null) {
      await pending;
      return _cache ?? {};
    }
    final future = _load();
    _loading = future;
    try {
      await future;
    } finally {
      _loading = null;
    }
    return _cache ?? {};
  }

  Future<void> _load() async {
    try {
      if (!await file.exists()) {
        _cache = {};
        return;
      }
      final raw = jsonDecode(await file.readAsString());
      if (raw is! Map) {
        _cache = {};
        return;
      }
      _cache = {
        for (final entry in raw.entries)
          if (entry.value is String)
            entry.key.toString(): entry.value as String,
      };
    } on FileSystemException {
      _cache = {};
    } on FormatException {
      _cache = {};
    }
  }

  Future<void> _persist() async {
    final values = _cache ?? {};
    await file.parent.create(recursive: true);
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsString(jsonEncode(values));
    if (await file.exists()) {
      await file.delete();
    }
    await tmp.rename(file.path);
  }

  @override
  Future<String?> read(String key) async {
    final values = await _ensure();
    return values[key];
  }

  Future<T> _enqueueWrite<T>(Future<T> Function() action) {
    final done = _writes.then((_) => action());
    _writes = done.then((_) {}, onError: (_) {});
    return done;
  }

  @override
  Future<void> write(String key, String value) {
    return _enqueueWrite(() async {
      final values = await _ensure();
      values[key] = value;
      await _persist();
    });
  }

  @override
  Future<void> delete(String key) {
    return _enqueueWrite(() async {
      final values = await _ensure();
      if (values.remove(key) != null) {
        await _persist();
      }
    });
  }

  @override
  Future<void> deleteByPrefix(String prefix) {
    return _enqueueWrite(() async {
      final values = await _ensure();
      final before = values.length;
      values.removeWhere((key, _) => key.startsWith(prefix));
      if (values.length != before) {
        await _persist();
      }
    });
  }

  @override
  Future<List<String>> keys() async {
    final values = await _ensure();
    return values.keys.toList(growable: false);
  }
}
