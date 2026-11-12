/// Version alignée sur `pubspec.yaml` (`1.0.0+1`).
///
/// Pas de plugin natif : le binaire n'embarque pas de secret, et les tests
/// n'ont pas besoin d'un canal plateforme.
abstract final class AppBuild {
  static const version = '1.0.0';
  static const number = '1';
  static const label = '$version+$number';
}
