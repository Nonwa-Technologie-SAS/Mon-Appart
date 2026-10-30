/// Durées et plafonds locaux. Nest reste la source de vérité métier.
abstract final class OfflinePolicy {
  static const maxListings = 30;
  static const maxQueue = 50;
  static const maxRetries = 5;
  static const listingRetention = Duration(days: 7);
  static const staleListings = Duration(hours: 6);
  static const staleHome = Duration(hours: 6);
  static const staleFavorites = Duration(hours: 6);
  static const staleSavedSearches = Duration(hours: 12);
  static const stalePreferences = Duration(hours: 24);
  static const staleVisits = Duration(hours: 2);
  static const staleProfile = Duration(hours: 24);

  static const guestScope = 'guest';

  static Duration backoff(int attempts) {
    final clamped = attempts.clamp(1, 6);
    return Duration(seconds: 1 << clamped);
  }
}
