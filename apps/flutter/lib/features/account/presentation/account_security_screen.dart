import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/section_header.dart';
import '../../auth/presentation/auth_providers.dart';

class AccountSecurityScreen extends ConsumerStatefulWidget {
  const AccountSecurityScreen({super.key});

  @override
  ConsumerState<AccountSecurityScreen> createState() =>
      _AccountSecurityScreenState();
}

class _AccountSecurityScreenState extends ConsumerState<AccountSecurityScreen> {
  var _loggingOutAll = false;

  Future<void> _logoutAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Déconnexion de tous les appareils'),
          content: const Text(
            'Toutes les sessions, y compris celle-ci, seront révoquées. '
            'Vous devrez vous reconnecter.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Annuler'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirmer'),
            ),
          ],
        );
      },
    );
    if (confirmed != true || _loggingOutAll) {
      return;
    }
    setState(() => _loggingOutAll = true);
    try {
      await ref.read(authControllerProvider.notifier).logoutAll();
      if (!mounted) {
        return;
      }
      context.go(AppRoutes.account);
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _loggingOutAll = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sécurité')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          const SectionHeader(title: 'Compte'),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.password_outlined),
            title: const Text('Modifier le mot de passe'),
            subtitle: const Text(
              'Les autres sessions seront révoquées après succès.',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AppRoutes.changePassword),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.devices_outlined),
            title: const Text('Sessions actives'),
            subtitle: const Text('Appareils connectés à votre compte'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AppRoutes.accountSessions),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.verified_outlined),
            title: const Text('Vérifier e-mail ou téléphone'),
            subtitle: const Text(
              'Réutilise le parcours de vérification existant',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AppRoutes.verifyContact),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Déconnecter tous les appareils',
            variant: AppButtonVariant.outline,
            loading: _loggingOutAll,
            onPressed: _logoutAll,
          ),
        ],
      ),
    );
  }
}
