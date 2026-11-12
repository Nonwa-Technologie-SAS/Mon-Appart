import '../errors/app_failure.dart';
import 'sync_rules.dart';

abstract final class OfflineMessages {
  static const explore =
      'La recherche de nouvelles annonces nécessite une connexion. '
      'Vos recherches enregistrées restent consultables.';

  static const visitMutation =
      'Confirmer, reporter ou annuler une visite nécessite une connexion.';

  static const queuedFavorite =
      'Favori enregistré sur l\'appareil. Il sera envoyé au serveur à la reconnexion.';

  static const queuedPreferences =
      'Préférences enregistrées localement. Elles seront envoyées au serveur à la reconnexion.';

  static AppFailure exploreFailure(AppFailure failure) {
    if (SyncRules.isTransient(failure)) {
      return const NetworkFailure(message: explore);
    }
    return failure;
  }
}
