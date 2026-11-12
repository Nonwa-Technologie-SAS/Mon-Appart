import '../logging/sensitive_data.dart';
import 'telemetry_event.dart';

final _email = RegExp(
  r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}',
  caseSensitive: false,
);
final _bearer = RegExp(r'Bearer\s+\S+', caseSensitive: false);
final _secretQuery = RegExp(
  r'(password|token|code|otp|refreshToken|accessToken|authorization)=([^&\s]+)',
  caseSensitive: false,
);
final _userPath = RegExp(r'[/\\]Users[/\\][^/\\]+');
final _uuid = RegExp(
  r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
);

String redactText(String raw) {
  final compact = raw.replaceAll(_userPath, '/Users/***');
  final withoutMail = compact.replaceAll(_email, '***');
  final withoutBearer = withoutMail.replaceAll(_bearer, 'Bearer ***');
  final withoutSecrets = withoutBearer.replaceAllMapped(_secretQuery, (match) {
    return '${match.group(1)}=***';
  });
  if (withoutSecrets.length <= 300) {
    return withoutSecrets;
  }
  return '${withoutSecrets.substring(0, 300)}…';
}

String redactPath(String path) {
  final withoutQuery = path.split('?').first;
  return withoutQuery.replaceAll(_uuid, ':id');
}

Map<String, Object?> redactAttributes(Map<String, Object?> raw) {
  final next = <String, Object?>{};
  raw.forEach((key, value) {
    if (isSensitiveJsonKey(key) || isSensitiveHeader(key)) {
      return;
    }
    if (value is String) {
      next[key] = redactText(value);
    } else if (value is num || value is bool || value == null) {
      next[key] = value;
    }
  });
  return next;
}

TelemetryEvent redactEvent(TelemetryEvent event) {
  return event.copyWith(
    message: redactText(event.message),
    attributes: redactAttributes(event.attributes),
  );
}
