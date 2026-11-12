import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../auth/presentation/auth_providers.dart';

class ProAccessScope extends ConsumerWidget {
  const ProAccessScope({
    super.key,
    required this.title,
    required this.nextRoute,
    required this.child,
  });

  final String title;
  final String nextRoute;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    final user = session?.user;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.lock_outline,
              title: 'Connexion requise',
              message:
                  'Connectez-vous avec un compte propriétaire, agence ou agent. '
                  'L\'accès aux données reste contrôlé par le serveur.',
              actionLabel: 'Se connecter',
              onAction: () => context.push(AppRoutes.loginWithNext(nextRoute)),
            )
          : user?.isPublisher != true
          ? const AppEmptyState(
              icon: Icons.apartment_outlined,
              title: 'Espace professionnel',
              message:
                  'Réservé aux propriétaires, agences et agents. '
                  'Un compte particulier ne voit pas les demandes des autres.',
            )
          : child,
    );
  }
}

Widget proFailureView({
  required BuildContext context,
  required AppFailure failure,
  required String loginNext,
  required VoidCallback onRetry,
}) {
  if (failure is NeedsAuthFailure ||
      (failure is HttpFailure && failure.isUnauthenticated)) {
    return AppEmptyState(
      icon: Icons.lock_outline,
      title: 'Session expirée',
      message: failure.message,
      actionLabel: 'Se connecter',
      onAction: () => context.push(AppRoutes.loginWithNext(loginNext)),
    );
  }
  if (failure is HttpFailure && failure.isForbidden) {
    return AppEmptyState(
      icon: Icons.apartment_outlined,
      title: 'Accès refusé',
      message: failure.message,
    );
  }
  return AppErrorView(failure: failure, onRetry: onRetry);
}

AppFailure asAppFailure(Object error) {
  if (error is AppFailure) {
    return error;
  }
  return UnexpectedFailure(message: error.toString());
}
