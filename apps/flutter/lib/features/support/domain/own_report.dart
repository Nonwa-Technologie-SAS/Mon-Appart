import '../../../core/listing/public_ids.dart';

/// Signalement tel que Nest le renvoie au déclarant.
///
/// `RESOLVED` regroupe une confirmation et un classement sans suite.
/// L'application ne distingue pas ces deux issues.
class OwnReport {
  const OwnReport({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.resolvedAt,
  });

  final String id;
  final String targetType;
  final String targetId;
  final String reason;
  final String status;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  static const statuses = {'OPEN', 'IN_REVIEW', 'RESOLVED'};

  static OwnReport? tryParse(Map<String, Object?> json) {
    final id = json['id'];
    final targetType = json['targetType'];
    final targetId = json['targetId'];
    final reason = json['reason'];
    final status = json['status'];
    final createdAt = DateTime.tryParse('${json['createdAt']}');
    if (id is! String ||
        !PublicIds.isUuid(id) ||
        targetType is! String ||
        targetId is! String ||
        !PublicIds.isUuid(targetId) ||
        reason is! String ||
        reason.isEmpty ||
        status is! String ||
        !statuses.contains(status) ||
        createdAt == null) {
      return null;
    }
    final resolvedRaw = json['resolvedAt'];
    final resolvedAt = resolvedRaw == null
        ? null
        : DateTime.tryParse('$resolvedRaw');
    if (resolvedRaw != null && resolvedAt == null) {
      return null;
    }
    return OwnReport(
      id: id,
      targetType: targetType,
      targetId: targetId,
      reason: reason,
      status: status,
      createdAt: createdAt,
      resolvedAt: resolvedAt,
    );
  }

  String get statusLabel => switch (status) {
    'OPEN' => 'Ouvert',
    'IN_REVIEW' => 'En examen',
    'RESOLVED' => 'Examiné',
    _ => status,
  };

  String get targetLabel => switch (targetType) {
    'LISTING' => 'Annonce',
    'USER' => 'Compte',
    'MESSAGE' => 'Message',
    'CONVERSATION' => 'Conversation',
    _ => targetType,
  };

  String get reasonLabel => switch (reason) {
    'SUSPECTED_SCAM' => 'Annonce ou contact potentiellement frauduleux',
    'DUPLICATE_LISTING' => 'Annonce dupliquée',
    'INCORRECT_PRICE' => 'Prix trompeur',
    'PROPERTY_NOT_AVAILABLE' => 'Bien indisponible',
    'UNAUTHORIZED_LISTING' => 'Annonce non autorisée',
    'MISLEADING_INFORMATION' => 'Informations incorrectes',
    'SUSPICIOUS_DOCUMENT' => 'Document suspect',
    'INAPPROPRIATE_CONTENT' => 'Contenu inapproprié',
    'OTHER' => 'Autre motif',
    _ => reason,
  };
}

abstract final class ListingReportReasons {
  static const values = <String>[
    'SUSPECTED_SCAM',
    'DUPLICATE_LISTING',
    'INCORRECT_PRICE',
    'PROPERTY_NOT_AVAILABLE',
    'MISLEADING_INFORMATION',
    'OTHER',
  ];

  static String label(String code) {
    return switch (code) {
      'SUSPECTED_SCAM' => 'Annonce potentiellement frauduleuse',
      'DUPLICATE_LISTING' => 'Annonce dupliquée',
      'INCORRECT_PRICE' => 'Prix trompeur',
      'PROPERTY_NOT_AVAILABLE' => 'Bien indisponible',
      'MISLEADING_INFORMATION' => 'Informations incorrectes',
      'OTHER' => 'Autre motif',
      _ => code,
    };
  }
}
