enum TelemetrySeverity { low, medium, high, critical }

enum TelemetryKind {
  crash,
  error,
  performance,
  network,
  sync,
  navigation,
  auth,
}

class TelemetryEvent {
  const TelemetryEvent({
    required this.at,
    required this.severity,
    required this.kind,
    required this.operation,
    required this.message,
    required this.fingerprint,
    required this.sessionId,
    required this.environment,
    required this.appVersion,
    this.count = 1,
    this.correlationId,
    this.role,
    this.platform,
    this.attributes = const {},
  });

  final DateTime at;
  final TelemetrySeverity severity;
  final TelemetryKind kind;
  final String operation;
  final String message;
  final String fingerprint;
  final String sessionId;
  final String environment;
  final String appVersion;
  final int count;
  final String? correlationId;
  final String? role;
  final String? platform;
  final Map<String, Object?> attributes;

  TelemetryEvent copyWith({
    int? count,
    String? message,
    Map<String, Object?>? attributes,
  }) {
    return TelemetryEvent(
      at: at,
      severity: severity,
      kind: kind,
      operation: operation,
      message: message ?? this.message,
      fingerprint: fingerprint,
      sessionId: sessionId,
      environment: environment,
      appVersion: appVersion,
      count: count ?? this.count,
      correlationId: correlationId,
      role: role,
      platform: platform,
      attributes: attributes ?? this.attributes,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'at': at.toUtc().toIso8601String(),
      'severity': severity.name,
      'kind': kind.name,
      'operation': operation,
      'message': message,
      'fingerprint': fingerprint,
      'count': count,
      'sessionId': sessionId,
      'environment': environment,
      'appVersion': appVersion,
      'correlationId': correlationId,
      'role': role,
      'platform': platform,
      'attributes': attributes,
    };
  }
}
