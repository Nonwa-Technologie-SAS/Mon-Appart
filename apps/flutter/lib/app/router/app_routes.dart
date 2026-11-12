/// Chemins go_router. Les permissions réelles restent côté Nest.
abstract final class AppRoutes {
  static const splash = '/';
  static const configMissing = '/config-missing';
  static const home = '/home';
  static const explore = '/explore';
  static const exploreFilters = '/explore/filters';
  static const assistant = '/assistant';
  static const compare = '/compare';
  static const favorites = '/favorites';
  static const notifications = '/notifications';
  static const account = '/account';
  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/reset-password';
  static const verifyContact = '/verify-contact';
  static const editProfile = '/account/edit';
  static const housingPreferences = '/account/preferences';
  static const savedSearches = '/account/saved-searches';
  static const savedSearchParam = 'savedSearchId';
  static const savedSearchIdQuery = 'savedSearchId';
  static const accountSecurity = '/account/security';
  static const changePassword = '/account/password';
  static const accountSessions = '/account/sessions';
  static const notificationPreferences = '/account/notifications';
  static const accountPrivacy = '/account/privacy';
  static const club = '/account/club';
  static const help = '/help';
  static const helpArticleParam = 'articleId';
  static const myReports = '/account/reports';

  static String helpArticle(String articleId) => '/help/article/$articleId';
  static const publish = '/publish';
  static const listingIdQuery = 'listingId';
  static const invalidLink = '/lien-invalide';
  static const messages = '/messages';
  static const visits = '/visits';
  static const visitTour = '/visits/tour';
  static const pro = '/pro';
  static const proListings = '/pro/listings';
  static const proLeads = '/pro/leads';
  static const inquiryParam = 'inquiryId';
  static const conversationParam = 'conversationId';
  static const appointmentParam = 'appointmentId';
  static const appScheme = 'monappart';

  static const listingParam = 'listingId';
  static const nextQuery = 'next';

  static String listing(String listingId) => '/listings/$listingId';

  static String publishListing(String listingId) {
    return Uri(
      path: publish,
      queryParameters: {listingIdQuery: listingId},
    ).toString();
  }

  static String savedSearch(String id) => '/account/saved-searches/$id';

  static String conversation(String id) => '/conversations/$id';

  static String appointment(String id) => '/appointments/$id';

  static String proLead(String id) => '/pro/leads/$id';

  static String resetPasswordLocation(String? token) {
    if (token == null || token.trim().isEmpty) {
      return resetPassword;
    }
    return Uri(
      path: resetPassword,
      queryParameters: {'token': token.trim()},
    ).toString();
  }

  /// Retour interne uniquement : chemin commençant par `/`, sans URL externe.
  static String? sanitizeNext(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }
    final decoded = Uri.decodeComponent(raw);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) {
      return null;
    }
    if (decoded.contains('://') || decoded.contains('\\')) {
      return null;
    }
    return decoded;
  }

  static String loginWithNext(String? next) {
    final safe = sanitizeNext(next);
    if (safe == null) {
      return login;
    }
    return Uri(path: login, queryParameters: {nextQuery: safe}).toString();
  }
}
