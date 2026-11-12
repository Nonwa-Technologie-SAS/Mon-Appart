/// Libellé relatif simple, sans locale Flutter à initialiser.
abstract final class RelativeTime {
  static String format(DateTime createdAt, {DateTime? now}) {
    final local = createdAt.toLocal();
    final clock = now ?? DateTime.now();
    final diff = clock.difference(local);
    if (diff.inSeconds.abs() < 45) {
      return 'À l\'instant';
    }
    if (diff.inMinutes < 60) {
      return 'Il y a ${diff.inMinutes} min';
    }
    if (diff.inHours < 24) {
      return 'Il y a ${diff.inHours} h';
    }
    if (diff.inDays < 7) {
      return 'Il y a ${diff.inDays} j';
    }
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    return '$day/$month/${local.year}';
  }
}
