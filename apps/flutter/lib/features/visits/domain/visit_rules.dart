/// Aligné sur Nest `checkVisitTime` (`APPOINTMENT_MIN_NOTICE_MINUTES` / `MAX_DAYS_AHEAD`).
abstract final class VisitRules {
  static const timezone = 'Africa/Abidjan';
  static const minNoticeMinutes = 60;
  static const maxDaysAhead = 90;
  static const minDurationMinutes = 15;
  static const maxDurationMinutes = 480;
  static const defaultDurationMinutes = 60;
  static const maxNotesLength = 1000;

  static String? scheduleError(DateTime? scheduledAt, {DateTime? now}) {
    if (scheduledAt == null) {
      return 'Choisissez une date et une heure.';
    }
    final clock = now ?? DateTime.now();
    final delta = scheduledAt.difference(clock);
    if (delta.inMinutes < minNoticeMinutes) {
      return 'Le créneau doit être au moins une heure à l\'avance.';
    }
    if (delta.inDays > maxDaysAhead) {
      return 'Le créneau ne peut pas dépasser $maxDaysAhead jours.';
    }
    return null;
  }

  static String? notesError(String raw) {
    if (raw.trim().length > maxNotesLength) {
      return 'La note est trop longue.';
    }
    return null;
  }
}
