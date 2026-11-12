import 'key_value_store.dart';

class MemoryKeyValueStore implements KeyValueStore {
  MemoryKeyValueStore([Map<String, String>? seed]) : _values = {...?seed};

  final Map<String, String> _values;

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async {
    _values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _values.remove(key);
  }

  @override
  Future<void> deleteByPrefix(String prefix) async {
    _values.removeWhere((key, _) => key.startsWith(prefix));
  }

  @override
  Future<List<String>> keys() async => _values.keys.toList(growable: false);
}
