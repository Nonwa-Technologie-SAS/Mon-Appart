import '../../../core/widgets/status_badge.dart';
import 'visit.dart';

abstract final class VisitLabels {
  static String status(String code) {
    return switch (code) {
      'PENDING' => 'En attente de confirmation',
      'CONFIRMED' => 'Confirmée',
      'RESCHEDULE_REQUESTED' => 'Nouvelle date proposée',
      'CANCELLED' => 'Annulée',
      'COMPLETED' => 'Effectuée',
      'NO_SHOW' => 'Non honorée',
      _ => code,
    };
  }

  static String action(String code) {
    return switch (code) {
      'CONFIRM' => 'Confirmer',
      'RESCHEDULE' => 'Proposer une autre date',
      'CANCEL' => 'Annuler',
      'COMPLETE' => 'Marquer comme effectuée',
      'NO_SHOW' => 'Client absent',
      _ => code,
    };
  }

  static String side(String code) {
    return switch (code) {
      'LISTING_SIDE' => 'Annonceur',
      'REQUESTER' => 'Demandeur',
      _ => code,
    };
  }

  static String cancelReason(String code) {
    return switch (code) {
      'SCHEDULE_CONFLICT' => 'Conflit d\'horaire',
      'NO_LONGER_INTERESTED' => 'Plus intéressé',
      'PROPERTY_UNAVAILABLE' => 'Bien indisponible',
      'OTHER' => 'Autre motif',
      _ => code,
    };
  }

  static String feedbackOutcome(String code) {
    return switch (code) {
      'PENDING_DECISION' => 'Réflexion en cours',
      'STILL_INTERESTED' => 'Toujours intéressé',
      'NEED_INFO' => 'Besoin d\'informations',
      'WANT_ANOTHER_VISIT' => 'Souhaite une autre visite',
      'NOT_A_FIT' => 'Ne convient pas',
      'UNAVAILABLE' => 'Bien indisponible',
      'PROJECT_ABANDONED' => 'Projet abandonné',
      'PROJECT_COMPLETED' => 'Projet abouti',
      _ => code,
    };
  }

  static String counterpart(Visit visit) {
    if (visit.isRequester) {
      return visit.listingTitle;
    }
    return visit.requester.displayName;
  }

  static String dateTime(DateTime value) {
    final local = value.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month/${local.year} $hour:$minute';
  }

  static String dayHeader(DateTime value) {
    final local = value.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    return '$day/$month/${local.year}';
  }

  static StatusBadgeTone tone(String status) {
    return switch (status) {
      'CONFIRMED' => StatusBadgeTone.success,
      'PENDING' || 'RESCHEDULE_REQUESTED' => StatusBadgeTone.warning,
      'COMPLETED' => StatusBadgeTone.accent,
      _ => StatusBadgeTone.neutral,
    };
  }
}

abstract final class VisitCancelReasons {
  static const values = <String>[
    'SCHEDULE_CONFLICT',
    'NO_LONGER_INTERESTED',
    'PROPERTY_UNAVAILABLE',
    'OTHER',
  ];
}

abstract final class VisitFeedbackOutcomes {
  static const values = <String>[
    'PENDING_DECISION',
    'STILL_INTERESTED',
    'NEED_INFO',
    'WANT_ANOTHER_VISIT',
    'NOT_A_FIT',
    'UNAVAILABLE',
    'PROJECT_ABANDONED',
    'PROJECT_COMPLETED',
  ];
}
