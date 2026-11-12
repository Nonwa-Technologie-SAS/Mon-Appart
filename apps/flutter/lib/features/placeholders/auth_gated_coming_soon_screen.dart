import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router/app_routes.dart';
import '../../app/theme/app_spacing.dart';
import '../../core/widgets/app_empty_state.dart';
import '../auth/presentation/auth_providers.dart';

class AuthGatedComingSoonScreen extends ConsumerWidget {
  const AuthGatedComingSoonScreen({
    super.key,
    required this.title,
    required this.message,
    required this.loginNext,
  });

  final String title;
  final String message;
  final String loginNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: session?.isAuthenticated != true
            ? AppEmptyState(
                icon: Icons.lock_outline,
                title: 'Connexion requise',
                message:
                    'Connectez-vous pour ouvrir cette destination. '
                    'L\'accès définitif reste contrôlé par le serveur.',
                actionLabel: 'Se connecter',
                onAction: () =>
                    context.push(AppRoutes.loginWithNext(loginNext)),
              )
            : AppEmptyState(
                icon: Icons.hourglass_empty,
                title: title,
                message: message,
              ),
      ),
    );
  }
}
