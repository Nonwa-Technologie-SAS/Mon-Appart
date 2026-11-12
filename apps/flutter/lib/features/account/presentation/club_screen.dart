import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/section_header.dart';
import '../../listing/presentation/listing_providers.dart';
import '../domain/club_program.dart';

class ClubScreen extends ConsumerWidget {
  const ClubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final host = ref.watch(appConfigProvider).publicWebHost;
    final shareText = ClubProgram.introductionShareText(host);
    final body = Theme.of(context).textTheme.bodyMedium;
    return Scaffold(
      appBar: AppBar(title: const Text(ClubProgram.name)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          const SectionHeader(title: 'Programme non ouvert'),
          Text(
            'Aucun solde de points, aucun badge de fidélité et aucune '
            'récompense partenaire ne sont disponibles. Nest ne fournit pas '
            'encore de compte Club. L\'application n\'en invente pas.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Ce qui ne donne rien'),
          Text(
            'Une installation, une inscription non vérifiée, des clics '
            'répétés ou un message envoyé en masse ne seront pas récompensés. '
            'Un futur barème, s\'il est validé, sera calculé uniquement côté serveur.',
            style: body,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Parrainage'),
          Text(
            'Il n\'existe pas de code de parrainage. Partager l\'adresse du '
            'site, lorsqu\'elle est configurée, ne crée pas de filleul et ne '
            'crédite personne.',
            style: body,
          ),
          if (shareText != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              onPressed: () {
                ref.read(listingShareProvider).shareText(shareText);
              },
              child: const Text('Partager l\'adresse du site'),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Confiance des annonces'),
          Text(
            'Les badges déjà affichés sur une fiche viennent de '
            'GET /trust/listings/:id/badges. Ils décrivent un examen de pièces, '
            'pas un niveau du Club et pas une récompense.',
            style: body,
          ),
        ],
      ),
    );
  }
}
