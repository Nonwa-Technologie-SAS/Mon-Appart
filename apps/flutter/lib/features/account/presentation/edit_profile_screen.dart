import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_rules.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../auth/presentation/auth_providers.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  String? _firstError;
  String? _lastError;
  String? _formError;
  var _hydrated = false;
  var _submitting = false;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    super.dispose();
  }

  void _hydrate(String? firstName, String? lastName) {
    if (_hydrated) {
      return;
    }
    _hydrated = true;
    _firstName.text = firstName ?? '';
    _lastName.text = lastName ?? '';
  }

  Future<void> _submit() async {
    final firstError = AuthRules.nameError(_firstName.text);
    final lastError = AuthRules.nameError(_lastName.text);
    setState(() {
      _firstError = firstError;
      _lastError = lastError;
      _formError = null;
    });
    if (firstError != null || lastError != null || _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .updateProfile(
            firstName: _firstName.text.trim(),
            lastName: _lastName.text.trim(),
          );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profil enregistré.')));
      context.pop();
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _formError = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _formError = 'L\'enregistrement du profil a échoué.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncSession = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Modifier le profil')),
      body: asyncSession.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement du profil'),
        error: (error, _) => AppEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Profil indisponible',
          message: error is AppFailure
              ? error.message
              : 'Impossible de charger le profil.',
          actionLabel: 'Réessayer',
          onAction: () => ref.invalidate(authControllerProvider),
        ),
        data: (session) {
          final user = session.user;
          if (user == null) {
            return AppEmptyState(
              icon: Icons.lock_outline,
              title: 'Connexion requise',
              message: 'Connectez-vous pour modifier votre profil.',
              actionLabel: 'Se connecter',
              onAction: () =>
                  context.push(AppRoutes.loginWithNext(AppRoutes.editProfile)),
            );
          }
          _hydrate(user.firstName, user.lastName);
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              TextField(
                controller: _firstName,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Prénom',
                  errorText: _firstError,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _lastName,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Nom',
                  errorText: _lastError,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                enabled: false,
                initialValue: user.email ?? 'Non renseigné',
                decoration: const InputDecoration(
                  labelText: 'Adresse e-mail',
                  helperText:
                      'La modification de l\'e-mail n\'est pas disponible. '
                      'Utilisez la vérification si le contact n\'est pas confirmé.',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                enabled: false,
                initialValue: user.phone ?? 'Non renseigné',
                decoration: const InputDecoration(
                  labelText: 'Téléphone',
                  helperText: 'La modification du numéro n\'est pas disponible sur ce lot.',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'La photo de profil n\'est pas prise en charge : le contrat '
                'Identity ne contient pas de champ avatar.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: AppColors.mutedForeground),
              ),
              if (_formError != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _formError!,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: AppColors.destructive),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Enregistrer',
                loading: _submitting,
                onPressed: _submit,
              ),
            ],
          );
        },
      ),
    );
  }
}
