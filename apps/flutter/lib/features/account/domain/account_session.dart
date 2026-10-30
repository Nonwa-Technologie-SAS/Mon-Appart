import '../../../core/json/json_map.dart';

class AccountDeviceSession {
  const AccountDeviceSession({
    required this.id,
    required this.current,
    required this.lastActiveAt,
    required this.expiresAt,
    this.deviceName,
    this.userAgent,
  });

  final String id;
  final bool current;
  final DateTime lastActiveAt;
  final DateTime expiresAt;
  final String? deviceName;
  final String? userAgent;

  String get label {
    if (deviceName != null && deviceName!.isNotEmpty) {
      return deviceName!;
    }
    if (userAgent != null && userAgent!.isNotEmpty) {
      return userAgent!;
    }
    return 'Appareil';
  }

  static AccountDeviceSession? tryParse(Object? raw) {
    if (raw is! Map) {
      return null;
    }
    final json = asJsonMap(raw);
    final id = asNonEmptyString(json['id']);
    if (id == null) {
      return null;
    }
    return AccountDeviceSession(
      id: id,
      current: json['current'] == true,
      lastActiveAt:
          DateTime.tryParse(asNonEmptyString(json['lastActiveAt']) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      expiresAt:
          DateTime.tryParse(asNonEmptyString(json['expiresAt']) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      deviceName: asNonEmptyString(json['deviceName']),
      userAgent: asNonEmptyString(json['userAgent']),
    );
  }
}
