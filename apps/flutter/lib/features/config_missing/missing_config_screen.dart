import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_spacing.dart';
import '../../core/widgets/app_empty_state.dart';

class MissingConfigScreen extends StatelessWidget {
  const MissingConfigScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              const Expanded(
                child: AppEmptyState(
                  icon: Icons.settings_suggest_outlined,
                  title: 'Configuration API manquante',
                  message:
                      'L\'application n\'embarque aucune URL d\'API. '
                      'Fournissez API_BASE_URL au lancement.',
                ),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Exemple (émulateur Android) :\n'
                  'flutter run --dart-define-from-file=config/local.example.json\n\n'
                  'iOS simulateur : http://127.0.0.1:4000\n'
                  'Appareil physique : IP locale de la machine, port 4000.',
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: AppColors.accentForeground),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
