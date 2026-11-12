import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_rules.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/security/screen_privacy.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../auth/presentation/password_field.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _currentError;
  String? _nextError;
  String? _confirmError;
  String? _formError;
  var _submitting = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final currentError = _current.text.isEmpty
        ? 'Saisissez votre mot de passe actuel.'
        : null;
    final nextError = AuthRules.passwordError(_next.text);
    final confirmError = AuthRules.confirmPasswordError(
      _next.text,
      _confirm.text,
    );
    setState(() {
      _currentError = currentError;
      _nextError = nextError;
      _confirmError = confirmError;
      _formError = null;
    });
    if (currentError != null ||
        nextError != null ||
        confirmError != null ||
        _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final revoked = await ref
          .read(authControllerProvider.notifier)
          .changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            revoked > 0
                ? 'Mot de passe mis à jour. $revoked autre(s) session(s) révoquée(s).'
                : 'Mot de passe mis à jour.',
          ),
        ),
      );
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
        _formError = 'Le changement de mot de passe a échoué.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SensitiveSurface(
      child: Scaffold(
        appBar: AppBar(title: const Text('Mot de passe')),
        body: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            PasswordField(
              controller: _current,
              label: 'Mot de passe actuel',
              errorText: _currentError,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.password],
            ),
            const SizedBox(height: AppSpacing.md),
            PasswordField(
              controller: _next,
              label: 'Nouveau mot de passe',
              errorText: _nextError,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
            ),
            const SizedBox(height: AppSpacing.md),
            PasswordField(
              controller: _confirm,
              label: 'Confirmation',
              errorText: _confirmError,
              onSubmitted: (_) => _submit(),
              autofillHints: const [AutofillHints.newPassword],
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
              label: 'Mettre à jour',
              loading: _submitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
