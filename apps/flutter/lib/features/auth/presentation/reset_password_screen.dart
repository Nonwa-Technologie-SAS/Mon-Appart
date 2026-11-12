import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_rules.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/security/screen_privacy.dart';
import '../../../core/widgets/app_button.dart';
import 'auth_providers.dart';
import 'password_field.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, this.initialToken});

  final String? initialToken;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  late final TextEditingController _token;
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _tokenError;
  String? _passwordError;
  String? _confirmError;
  String? _formError;
  String? _message;
  var _submitting = false;

  @override
  void initState() {
    super.initState();
    _token = TextEditingController(text: widget.initialToken ?? '');
  }

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final tokenError = AuthRules.resetTokenError(_token.text);
    final passwordError = AuthRules.passwordError(_password.text);
    final confirmError = AuthRules.confirmPasswordError(
      _password.text,
      _confirm.text,
    );
    setState(() {
      _tokenError = tokenError;
      _passwordError = passwordError;
      _confirmError = confirmError;
      _formError = null;
    });
    if (tokenError != null ||
        passwordError != null ||
        confirmError != null ||
        _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final message = await ref
          .read(authRepositoryProvider)
          .resetPassword(
            token: _token.text.trim(),
            newPassword: _password.text,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _message = message;
      });
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _formError = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SensitiveSurface(
      child: Scaffold(
        appBar: AppBar(title: const Text('Nouveau mot de passe')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Collez le jeton reçu par e-mail ou SMS. '
                'Les liens universels ne sont pas configurés dans cette application.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: _token,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Jeton de réinitialisation',
                  errorText: _tokenError,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              PasswordField(
                controller: _password,
                label: 'Nouveau mot de passe',
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
              if (_formError != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _formError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              if (_message != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(_message!),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Mettre à jour le mot de passe',
                loading: _submitting,
                onPressed: _submit,
              ),
              TextButton(
                onPressed: () => context.go(AppRoutes.login),
                child: const Text('Retour à la connexion'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
