/// Persistance clé / valeur JSON. Les jetons restent dans [SessionStore].
abstract class KeyValueStore {
  Future<String?> read(String key);

  Future<void> write(String key, String value);

  Future<void> delete(String key);

  Future<void> deleteByPrefix(String prefix);

  Future<List<String>> keys();
}
