import '../../core/listing/public_ids.dart';
import '../../features/notifications/domain/notification_destination.dart';
import 'app_routes.dart';

/// Résolution contrôlée des liens profonds (schéma app, HTTPS allowlist).
///
/// Ne navigue jamais vers une URL arbitraire. Les jetons d'accès n'ont pas
/// leur place dans une URI : ils sont rejetés.
class DeepLinkResolver {
  DeepLinkResolver({Set<String> allowedHttpsHosts = const {}})
    : allowedHttpsHosts = {
        for (final host in allowedHttpsHosts)
          if (host.trim().isNotEmpty) host.trim().toLowerCase(),
      };

  final Set<String> allowedHttpsHosts;

  static const _blockedQueryKeys = {
    'access_token',
    'accesstoken',
    'refresh_token',
    'refreshtoken',
    'authorization',
    'password',
    'code',
  };

  /// Redirection go_router : `null` si l'URI n'est pas un lien externe.
  String? redirect(Uri uri) {
    if (!_isIncomingExternal(uri)) {
      return null;
    }
    return resolveToLocation(uri) ?? AppRoutes.invalidLink;
  }

  bool _isIncomingExternal(Uri uri) {
    if (uri.scheme == AppRoutes.appScheme) {
      return true;
    }
    if (uri.scheme == 'https' || uri.scheme == 'http') {
      final host = uri.host.toLowerCase();
      if (host.isEmpty || host == 'localhost' || host == '127.0.0.1') {
        return false;
      }
      return allowedHttpsHosts.contains(host);
    }
    return false;
  }

  /// Chemin interne go_router, ou `null` si le lien est rejeté.
  String? resolveToLocation(Uri uri) {
    if (uri.scheme == AppRoutes.appScheme) {
      return _fromAppScheme(uri);
    }
    if (uri.scheme == 'https' || uri.scheme == 'http') {
      if (!_isIncomingExternal(uri)) {
        return null;
      }
      return _fromPath(uri.path, uri.queryParameters);
    }
    if (uri.scheme.isEmpty && uri.path.startsWith('/')) {
      return _fromPath(uri.path, uri.queryParameters);
    }
    return null;
  }

  String? locationFor(NotificationDestination destination) {
    return switch (destination.kind) {
      NotificationKind.listing => AppRoutes.listing(destination.id!),
      NotificationKind.savedSearch => AppRoutes.savedSearch(destination.id!),
      NotificationKind.conversation => AppRoutes.conversation(destination.id!),
      NotificationKind.appointment => AppRoutes.appointment(destination.id!),
      NotificationKind.explore => _explore(destination.query),
      NotificationKind.notifications => AppRoutes.notifications,
      NotificationKind.favorites => AppRoutes.favorites,
      NotificationKind.resetPassword => AppRoutes.resetPasswordLocation(
        destination.query['token'],
      ),
      NotificationKind.unknown => null,
    };
  }

  /// URL publique web d'une fiche. `null` si le domaine n'est pas configuré.
  static String? publicListingUrl({
    required String? host,
    required String listingId,
  }) {
    final normalized = host?.trim().toLowerCase();
    if (normalized == null ||
        normalized.isEmpty ||
        !PublicIds.isUuid(listingId)) {
      return null;
    }
    return Uri(
      scheme: 'https',
      host: normalized,
      path: '/biens/${listingId.trim()}',
    ).toString();
  }

  String? _fromAppScheme(Uri uri) {
    final host = uri.host.toLowerCase();
    if (host.isNotEmpty) {
      final id = uri.pathSegments.isEmpty ? null : uri.pathSegments.first;
      return _fromHost(host, id, uri.queryParameters);
    }
    return _fromPath(uri.path, uri.queryParameters);
  }

  String? _fromHost(String host, String? id, Map<String, String> query) {
    return switch (host) {
      'listings' || 'biens' => _listing(id),
      'explore' || 'recherche' || 'search' => _explore(query),
      'notifications' => AppRoutes.notifications,
      'favorites' || 'favoris' => AppRoutes.favorites,
      'saved-searches' => _savedSearch(id),
      'conversations' => _conversation(id),
      'appointments' || 'visites' => _appointment(id),
      'reset-password' => _resetPassword(query),
      _ => null,
    };
  }

  String? _fromPath(String path, Map<String, String> query) {
    final segments = path
        .split('/')
        .where((segment) => segment.isNotEmpty)
        .toList(growable: false);
    if (segments.isEmpty) {
      return null;
    }
    if (segments.length == 2 &&
        (segments[0] == 'listings' ||
            segments[0] == 'biens' ||
            segments[0] == 'annonces')) {
      return _listing(segments[1]);
    }
    if (segments.length == 1 &&
        (segments[0] == 'explore' ||
            segments[0] == 'recherche' ||
            segments[0] == 'search')) {
      return _explore(query);
    }
    if (segments.length == 1 && segments[0] == 'notifications') {
      return AppRoutes.notifications;
    }
    if (segments.length == 1 &&
        (segments[0] == 'favorites' || segments[0] == 'favoris')) {
      return AppRoutes.favorites;
    }
    if (segments.length == 3 &&
        segments[0] == 'account' &&
        segments[1] == 'saved-searches') {
      return _savedSearch(segments[2]);
    }
    if (segments.length == 2 && segments[0] == 'saved-searches') {
      return _savedSearch(segments[1]);
    }
    if (segments.length == 2 && segments[0] == 'conversations') {
      return _conversation(segments[1]);
    }
    if (segments.length == 2 &&
        (segments[0] == 'appointments' || segments[0] == 'visites')) {
      return _appointment(segments[1]);
    }
    if (segments.length == 1 && segments[0] == 'reset-password') {
      return _resetPassword(query);
    }
    return null;
  }

  String? _listing(String? id) {
    final uuid = _requireUuid(id);
    if (uuid == null) {
      return null;
    }
    return AppRoutes.listing(uuid);
  }

  String? _savedSearch(String? id) {
    final uuid = _requireUuid(id);
    if (uuid == null) {
      return null;
    }
    return AppRoutes.savedSearch(uuid);
  }

  String? _conversation(String? id) {
    final uuid = _requireUuid(id);
    if (uuid == null) {
      return null;
    }
    return AppRoutes.conversation(uuid);
  }

  String? _appointment(String? id) {
    final uuid = _requireUuid(id);
    if (uuid == null) {
      return null;
    }
    return AppRoutes.appointment(uuid);
  }

  String? _explore(Map<String, String> query) {
    if (!_querySafe(query, allowResetToken: false)) {
      return null;
    }
    if (query.isEmpty) {
      return AppRoutes.explore;
    }
    return Uri(path: AppRoutes.explore, queryParameters: query).toString();
  }

  String? _resetPassword(Map<String, String> query) {
    if (!_querySafe(query, allowResetToken: true)) {
      return null;
    }
    return AppRoutes.resetPasswordLocation(query['token']);
  }

  String? _requireUuid(String? value) {
    if (value == null) {
      return null;
    }
    final trimmed = value.trim();
    return PublicIds.isUuid(trimmed) ? trimmed : null;
  }

  bool _querySafe(Map<String, String> query, {required bool allowResetToken}) {
    for (final entry in query.entries) {
      final key = entry.key.trim().toLowerCase();
      final value = entry.value;
      if (key.contains('://') ||
          value.contains('://') ||
          value.contains('//')) {
        return false;
      }
      if (_blockedQueryKeys.contains(key)) {
        return false;
      }
      if (key == 'token' && !allowResetToken) {
        return false;
      }
    }
    return true;
  }
}
