/// Club Mon Appart. Aucune récompense n'est attribuée ici.
///
/// Nest n'expose ni compte de points, ni code de parrainage, ni catalogue
/// partenaire. L'application ne calcule pas un solde.
abstract final class ClubProgram {
  static const name = 'Club Mon Appart';

  /// Tant que cette valeur est fausse, aucun avantage n'est utilisable.
  static const launched = false;

  /// Texte de présentation du site public. `null` sans hôte configuré.
  ///
  /// Ce n'est pas un lien de parrainage : aucun code n'y figure.
  static String? introductionShareText(String? publicWebHost) {
    final host = publicWebHost?.trim().toLowerCase();
    if (host == null || host.isEmpty) {
      return null;
    }
    return 'Mon Appart aide à chercher un logement en Côte d\'Ivoire.\n'
        'https://$host\n'
        'Ce lien ne contient pas de code de parrainage et n\'accorde aucune récompense.';
  }
}
