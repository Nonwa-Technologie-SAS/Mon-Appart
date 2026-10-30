/// Environnements reconnus par le binaire mobile.
///
/// Les URL associées ne sont pas embarquées : elles arrivent par `--dart-define`.
enum AppEnvironment {
  local,
  staging,
  production;

  static const _aliases = <String, AppEnvironment>{
    'local': AppEnvironment.local,
    'development': AppEnvironment.local,
    'dev': AppEnvironment.local,
    'staging': AppEnvironment.staging,
    'recette': AppEnvironment.staging,
    'production': AppEnvironment.production,
    'prod': AppEnvironment.production,
  };

  /// Interprète la valeur `APP_ENV`. Valeurs inconnues → [FormatException].
  static AppEnvironment parse(String raw) {
    final normalized = raw.trim().toLowerCase();
    final match = _aliases[normalized];
    if (match == null) {
      throw FormatException(
        'APP_ENV invalide "$raw". '
        'Valeurs acceptées : local, staging, production.',
      );
    }
    return match;
  }

  bool get isLocal => this == AppEnvironment.local;
  bool get isProduction => this == AppEnvironment.production;
}
