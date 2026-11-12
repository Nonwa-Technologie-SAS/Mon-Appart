import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_rules.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import 'auth_navigation.dart';
import 'auth_providers.dart';
import 'password_field.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.next});

  final String? next;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _contactError;
  String? _passwordError;
  String? _confirmError;
  String? _formError;
  var _submitting = false;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final contactError = AuthRules.contactError(
      email: _email.text,
      phone: _phone.text,
    );
    final passwordError = AuthRules.passwordError(
      _password.text,
      email: _email.text,
      phone: _phone.text,
    );
    final confirmError = AuthRules.confirmPasswordError(
      _password.text,
      _confirm.text,
    );
    setState(() {
      _contactError = contactError;
      _passwordError = passwordError;
      _confirmError = confirmError;
      _formError = null;
    });
    if (contactError != null ||
        passwordError != null ||
        confirmError != null ||
        _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final user = await ref
          .read(authControllerProvider.notifier)
          .register(
            password: _password.text,
            email: _email.text.trim().isEmpty ? null : _email.text.trim(),
            phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
            firstName: _firstName.text.trim().isEmpty
                ? null
                : _firstName.text.trim(),
            lastName: _lastName.text.trim().isEmpty
                ? null
                : _lastName.text.trim(),
          );
      if (!mounted) {
        return;
      }
      completeAuthNavigation(context, user: user, next: widget.next);
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
        _formError = 'L\'inscription a échoué.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Créer un compte')),
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              Text(
                'Un e-mail ou un numéro ivoirien suffit. Le compte est créé en attente de vérification, avec une session ouverte.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: _firstName,
                textInputAction: TextInputAction.next,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.givenName],
                decoration: const InputDecoration(
                  labelText: 'Prénom (facultatif)',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _lastName,
                textInputAction: TextInputAction.next,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.familyName],
                decoration: const InputDecoration(
                  labelText: 'Nom (facultatif)',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: InputDecoration(
                  labelText: 'E-mail',
                  errorText: _contactError,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.telephoneNumber],
                decoration: const InputDecoration(
                  labelText: 'Téléphone',
                  hintText: '07 01 02 03 04 ou +225…',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              PasswordField(
                controller: _password,
                errorText: _passwordError,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
              ),
              const SizedBox(height: AppSpacing.md),
              PasswordField(
                controller: _confirm,
                label: 'Confirmer le mot de passe',
                errorText: _confirmError,
                autofillHints: const [AutofillHints.newPassword],
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'En créant un compte, vous acceptez les conditions d\'utilisation de Mon Appart. '
                'L\'API n\'exige pas de case à cocher : aucun champ supplémentaire n\'est envoyé.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (_formError != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _formError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Créer le compte',
                loading: _submitting,
                onPressed: _submit,
              ),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => context.go(AppRoutes.loginWithNext(widget.next)),
                child: const Text('J\'ai déjà un compte'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
