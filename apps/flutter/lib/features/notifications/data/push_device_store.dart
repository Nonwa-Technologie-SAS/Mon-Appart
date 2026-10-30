import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persistance de l'identifiant public d'appareil Nest — jamais du jeton.
abstract class PushDeviceStore {
  Future<String?> readDeviceId();

  Future<void> saveDeviceId(String id);

  Future<void> clear();
}

class SecurePushDeviceStore implements PushDeviceStore {
  SecurePushDeviceStore({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(),
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
          );

  static const _deviceKey = 'ma.push.device_id';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readDeviceId() => _storage.read(key: _deviceKey);

  @override
  Future<void> saveDeviceId(String id) {
    return _storage.write(key: _deviceKey, value: id);
  }

  @override
  Future<void> clear() => _storage.delete(key: _deviceKey);
}

class InMemoryPushDeviceStore implements PushDeviceStore {
  String? _id;

  @override
  Future<String?> readDeviceId() async => _id;

  @override
  Future<void> saveDeviceId(String id) async {
    _id = id;
  }

  @override
  Future<void> clear() async {
    _id = null;
  }
}
