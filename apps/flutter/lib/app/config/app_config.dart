import 'app_environment.dart';

/// Configuration compilée du client mobile.
///
/// Les valeurs proviennent de `--dart-define` / `--dart-define-from-file`.
/// Elles peuvent être extraites du binaire : aucun secret n'y figure.
class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.enableNetworkLogs,
    this.telemetryEnabled = true,
    this.publicWebHost,
    this.mapTileUrl,
    this.supportPhone,
    this.supportWhatsapp,
  });

  final AppEnvironment environment;
  final Uri? apiBaseUrl;
  final bool enableNetworkLogs;

  /// Collecte locale. `false` coupe la télémétrie sans empêcher l'application de tourner.
  final bool telemetryEnabled;

  /// Hôte HTTPS public (sans schéma). `null` si aucun domaine n'est configuré.
  final String? publicWebHost;

  /// Gabarit de tuiles `{z}/{x}/{y}`. Vide = OpenStreetMap (dev). Pas un secret.
  final String? mapTileUrl;

  /// Numéro E.164 du support. `null` si `SUPPORT_PHONE` est absent.
  final String? supportPhone;

  /// Numéro E.164 WhatsApp. `null` si `SUPPORT_WHATSAPP` est absent.
  /// Un lien `wa.me` n'est pas une intégration WhatsApp Business.
  final String? supportWhatsapp;

  static const defaultMapTileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  String get resolvedMapTileUrl => (mapTileUrl == null || mapTileUrl!.isEmpty)
      ? defaultMapTileUrl
      : mapTileUrl!;

  bool get isConfigured => apiBaseUrl != null;

  /// Lit les defines de compilation.
  ///
  /// [API_BASE_URL] est obligatoire pour parler à l'API. S'il est absent,
  /// [apiBaseUrl] reste null et l'UI affiche l'écran de configuration manquante.
  factory AppConfig.fromEnvironment() {
    const rawEnv = String.fromEnvironment('APP_ENV', defaultValue: 'local');
    const rawUrl = String.fromEnvironment('API_BASE_URL');
    const rawLogs = String.fromEnvironment('ENABLE_NETWORK_LOGS');
    const rawTelemetry = String.fromEnvironment('TELEMETRY_ENABLED');
    const rawHost = String.fromEnvironment('PUBLIC_WEB_HOST');
    const rawTiles = String.fromEnvironment('MAP_TILE_URL');
    const rawPhone = String.fromEnvironment('SUPPORT_PHONE');
    const rawWhatsapp = String.fromEnvironment('SUPPORT_WHATSAPP');

    final environment = AppEnvironment.parse(rawEnv);
    final apiBaseUrl = parseApiBaseUrl(rawUrl, environment: environment);
    final enableNetworkLogs = parseBoolFlag(
      rawLogs,
      defaultValue: environment.isLocal,
    );

    return AppConfig(
      environment: environment,
      apiBaseUrl: apiBaseUrl,
      enableNetworkLogs: environment.isProduction ? false : enableNetworkLogs,
      telemetryEnabled: parseBoolFlag(
        rawTelemetry,
        defaultValue: true,
        name: 'TELEMETRY_ENABLED',
      ),
      publicWebHost: parsePublicWebHost(rawHost),
      mapTileUrl: parseMapTileUrl(rawTiles, environment: environment),
      supportPhone: parseSupportNumber(rawPhone, name: 'SUPPORT_PHONE'),
      supportWhatsapp: parseSupportNumber(
        rawWhatsapp,
        name: 'SUPPORT_WHATSAPP',
      ),
    );
  }

  /// Analyse une URL d'API. Retourne null si la valeur est vide.
  ///
  /// En production, seul HTTPS est accepté. TLS n'est jamais désactivé.
  static Uri? parseApiBaseUrl(
    String raw, {
    required AppEnvironment environment,
  }) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(trimmed);
    if (uri == null || uri.host.isEmpty || !uri.hasScheme) {
      throw FormatException(
        'API_BASE_URL invalide "$raw". '
        'Attendu : URL absolue http(s), par exemple http://10.0.2.2:4000',
      );
    }

    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw FormatException(
        'API_BASE_URL doit utiliser http ou https (reçu : ${uri.scheme}).',
      );
    }

    if (environment.isProduction && uri.scheme != 'https') {
      throw const FormatException(
        'En production, API_BASE_URL doit être en HTTPS.',
      );
    }

    final path = uri.path.endsWith('/') && uri.path.length > 1
        ? uri.path.substring(0, uri.path.length - 1)
        : uri.path == '/'
        ? ''
        : uri.path;

    return Uri(
      scheme: uri.scheme,
      host: uri.host,
      port: uri.hasPort ? uri.port : null,
      path: path,
    );
  }

  static bool parseBoolFlag(
    String raw, {
    required bool defaultValue,
    String name = 'ENABLE_NETWORK_LOGS',
  }) {
    final normalized = raw.trim().toLowerCase();
    if (normalized.isEmpty) {
      return defaultValue;
    }
    if (normalized == 'true' || normalized == '1' || normalized == 'yes') {
      return true;
    }
    if (normalized == 'false' || normalized == '0' || normalized == 'no') {
      return false;
    }
    throw FormatException('$name invalide "$raw". Attendu : true ou false.');
  }

  /// Hôte public pour App Links / Universal Links. Jamais localhost.
  static String? parsePublicWebHost(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return null;
    }
    final uri = Uri.tryParse(
      trimmed.contains('://') ? trimmed : 'https://$trimmed',
    );
    final host = uri?.host.trim().toLowerCase() ?? '';
    if (host.isEmpty ||
        host == 'localhost' ||
        host == '127.0.0.1' ||
        host == '::1') {
      return null;
    }
    return host;
  }

  /// Gabarit public de tuiles. Jamais un secret serveur.
  static String? parseMapTileUrl(
    String raw, {
    AppEnvironment environment = AppEnvironment.local,
  }) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return null;
    }
    if (!trimmed.contains('{z}') ||
        !trimmed.contains('{x}') ||
        !trimmed.contains('{y}')) {
      return null;
    }
    final uri = Uri.tryParse(trimmed);
    if (uri == null || uri.host.isEmpty) {
      return null;
    }
    if (uri.scheme != 'https' && uri.scheme != 'http') {
      return null;
    }
    if (!environment.isLocal && uri.scheme != 'https') {
      return null;
    }
    return trimmed;
  }

  /// Numéro public de support, format E.164. Vide = canal absent.
  static String? parseSupportNumber(String raw, {required String name}) {
    final compact = raw.trim().replaceAll(RegExp(r'[\s().-]'), '');
    if (compact.isEmpty) {
      return null;
    }
    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(compact)) {
      throw FormatException(
        '$name invalide "$raw". Attendu : indicatif et numéro, commençant par +.',
      );
    }
    return compact;
  }
}
