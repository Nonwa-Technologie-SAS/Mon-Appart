/// Champs et en-têtes qui ne doivent jamais apparaître dans les journaux.
const sensitiveHeaderNames = <String>{
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-auth-transport',
};

const sensitiveJsonKeys = <String>{
  'accessToken',
  'refreshToken',
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'code',
  'otp',
  'identifier',
};

bool isSensitiveHeader(String name) =>
    sensitiveHeaderNames.contains(name.toLowerCase());

bool isSensitiveJsonKey(String key) => sensitiveJsonKeys.contains(key);

/// Remplace les valeurs sensibles d'une carte d'en-têtes.
Map<String, String> redactHeaders(Map<String, dynamic> headers) {
  final redacted = <String, String>{};
  headers.forEach((key, value) {
    if (isSensitiveHeader(key)) {
      redacted[key] = '***';
    } else {
      redacted[key] = value.toString();
    }
  });
  return redacted;
}

Object? redactJson(Object? value) {
  if (value is Map) {
    return value.map((key, child) {
      final name = key.toString();
      if (isSensitiveJsonKey(name)) {
        return MapEntry(name, '***');
      }
      return MapEntry(name, redactJson(child));
    });
  }
  if (value is List) {
    return value.map(redactJson).toList(growable: false);
  }
  return value;
}
