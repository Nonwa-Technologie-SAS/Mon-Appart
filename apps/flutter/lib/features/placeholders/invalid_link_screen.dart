import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/router/app_routes.dart';
import '../../app/theme/app_spacing.dart';
import '../../core/widgets/app_empty_state.dart';

class InvalidLinkScreen extends StatelessWidget {
  const InvalidLinkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lien invalide')),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: AppEmptyState(
          icon: Icons.link_off,
          title: 'Lien non reconnu',
          message:
              'Cette adresse n\'est pas une destination Mon Appart, '
              'ou l\'identifiant est invalide.',
          actionLabel: 'Accueil',
          onAction: () => context.go(AppRoutes.home),
        ),
      ),
    );
  }
}
