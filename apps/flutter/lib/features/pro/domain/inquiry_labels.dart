import '../../../core/widgets/status_badge.dart';

abstract final class InquiryLabels {
  static String stage(String code) {
    return switch (code) {
      'NEW' => 'Nouveau',
      'CONTACTED' => 'Contacté',
      'QUALIFIED' => 'Qualifié',
      'VISIT_PLANNED' => 'Visite planifiée',
      'VISIT_DONE' => 'Visite effectuée',
      'FOLLOW_UP' => 'Relance',
      'CONVERTED' => 'Conclu',
      'LOST' => 'Perdu',
      'ARCHIVED' => 'Archivé',
      _ => code,
    };
  }

  static String status(String code) {
    return switch (code) {
      'OPEN' => 'Ouverte',
      'IN_PROGRESS' => 'En cours',
      'RESOLVED' => 'Résolue',
      'CLOSED' => 'Fermée',
      _ => code,
    };
  }

  static String lostReason(String code) {
    return switch (code) {
      'BUDGET' => 'Budget',
      'LOCATION' => 'Localisation',
      'TIMING' => 'Délais',
      'NO_RESPONSE' => 'Sans réponse',
      'PROPERTY_UNAVAILABLE' => 'Bien indisponible',
      'OTHER' => 'Autre',
      _ => code,
    };
  }

  static String origin(String type) {
    return switch (type) {
      'CONTACT' => 'Demande de contact',
      'VISIT' => 'Demande de visite',
      _ => type,
    };
  }

  static StatusBadgeTone tone(String stage) {
    return switch (stage) {
      'CONVERTED' => StatusBadgeTone.success,
      'LOST' || 'ARCHIVED' => StatusBadgeTone.neutral,
      'VISIT_PLANNED' || 'VISIT_DONE' => StatusBadgeTone.accent,
      _ => StatusBadgeTone.warning,
    };
  }

  static const stages = <String>[
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'VISIT_PLANNED',
    'VISIT_DONE',
    'FOLLOW_UP',
    'CONVERTED',
    'LOST',
    'ARCHIVED',
  ];

  static const lostReasons = <String>[
    'BUDGET',
    'LOCATION',
    'TIMING',
    'NO_RESPONSE',
    'PROPERTY_UNAVAILABLE',
    'OTHER',
  ];
}

/// Aligné sur Nest `canTransitionInquiryStage`.
abstract final class InquiryStageRules {
  static const allowed = <String, List<String>>{
    'NEW': ['CONTACTED', 'QUALIFIED', 'VISIT_PLANNED', 'LOST', 'ARCHIVED'],
    'CONTACTED': [
      'QUALIFIED',
      'VISIT_PLANNED',
      'FOLLOW_UP',
      'LOST',
      'ARCHIVED',
    ],
    'QUALIFIED': [
      'VISIT_PLANNED',
      'FOLLOW_UP',
      'CONTACTED',
      'LOST',
      'ARCHIVED',
    ],
    'VISIT_PLANNED': [
      'VISIT_DONE',
      'FOLLOW_UP',
      'QUALIFIED',
      'LOST',
      'ARCHIVED',
    ],
    'VISIT_DONE': ['FOLLOW_UP', 'CONVERTED', 'LOST', 'ARCHIVED'],
    'FOLLOW_UP': [
      'QUALIFIED',
      'VISIT_PLANNED',
      'CONVERTED',
      'LOST',
      'ARCHIVED',
    ],
    'CONVERTED': ['ARCHIVED', 'FOLLOW_UP'],
    'LOST': ['NEW', 'FOLLOW_UP', 'ARCHIVED'],
    'ARCHIVED': ['NEW', 'FOLLOW_UP'],
  };

  static List<String> nextStages(String from) {
    return allowed[from] ?? const [];
  }

  static bool canTransition(String from, String to) {
    if (from == to) {
      return true;
    }
    return nextStages(from).contains(to);
  }
}
