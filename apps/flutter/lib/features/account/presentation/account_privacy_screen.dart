import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/section_header.dart';

class AccountPrivacyScreen extends StatelessWidget {
  const AccountPrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final body = Theme.of(context).textTheme.bodyMedium;
    return Scaffold(
      appBar: AppBar(title: const Text('Confidentialité')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          const SectionHeader(title: 'Données de profil'),
          Text(
            'Le compte mobile enregistre le prénom, le nom, l\'e-mail et/ou le '
            'téléphone fournis à Identity. Seuls le prénom et le nom sont '
            'modifiables depuis l\'application (PATCH /auth/me). '
            'L\'e-mail et le téléphone restent en lecture seule tant que les '
            'parcours /auth/email/change et /auth/phone/change n\'existent pas.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Préférences immobilières'),
          Text(
            'Budget, zones, types de biens et équipements sont envoyés à '
            'GET/PUT /recommendations/preferences. Ils servent au moteur de '
            'recommandation Nest (niveaux GENERIC, PREFERENCES, BEHAVIOR). '
            'Ils ne sont pas partagés avec un propriétaire ou une agence. '
            'Aucune position GPS n\'est collectée pour les définir.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Notifications'),
          Text(
            'Les interrupteurs correspondent aux cellules catégorie × canal '
            'stockées par Nest. Ils ne contrôlent pas les permissions push '
            'natives Android ou iOS, qui ne sont pas demandées dans ce lot.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Photo de profil'),
          Text(
            'UserResponseDto ne contient pas d\'avatar. Aucune image n\'est '
            'téléversée depuis cet écran.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Données sur l\'appareil'),
          Text(
            'Les jetons de session restent dans le trousseau Android ou le '
            'Keychain iOS. Le fichier de cache hors ligne ne conserve ni '
            'e-mail, ni téléphone, ni mot de passe. Il est effacé à la '
            'déconnexion, à la révocation de session et lors d\'un changement '
            'de compte. La sauvegarde cloud Android de l\'application est '
            'désactivée. Les conversations ne sont pas écrites sur le disque.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Suppression du compte'),
          Text(
            'Aucun endpoint utilisateur de suppression n\'est exposé. La purge '
            'suit le traitement IdentityRetention côté serveur. L\'application '
            'ne simule pas une suppression locale.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Documents légaux'),
          Text(
            'Les conditions d\'utilisation et la politique de confidentialité '
            'n\'ont pas d\'URL publique configurée dans l\'application. '
            'Elles restent celles du produit web lorsque le domaine sera branché.',
            style: body,
          ),
        ],
      ),
    );
  }
}
