/// Réponse vérifiée de `GET /health/live`.
class HealthLive {
  const HealthLive({required this.status, required this.service, this.version});

  final String status;
  final String service;
  final String? version;

  bool get isOk => status == 'ok';

  factory HealthLive.fromJson(Map<String, Object?> json) {
    final status = json['status'];
    final service = json['service'];
    if (status is! String || status.isEmpty) {
      throw const FormatException('Health : champ "status" manquant.');
    }
    if (service is! String || service.isEmpty) {
      throw const FormatException('Health : champ "service" manquant.');
    }
    final version = json['version'];
    return HealthLive(
      status: status,
      service: service,
      version: version is String && version.isNotEmpty ? version : null,
    );
  }
}
