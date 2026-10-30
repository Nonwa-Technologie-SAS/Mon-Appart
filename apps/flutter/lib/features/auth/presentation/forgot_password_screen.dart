import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_rules.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import 'auth_providers.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _identifier = TextEditingController();
  String? _fieldError;
  String? _formError;
  String? _message;
  var _submitting = false;

  @override
  void dispose() {
    _identifier.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final fieldError = AuthRules.identifierError(_identifier.text);
    setState(() {
      _fieldError = fieldError;
      _formError = null;
    });
    if (fieldError != null || _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final message = await ref
          .read(authRepositoryProvider)
          .forgotPassword(_identifier.text.trim());
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
    return Scaffold(
      appBar: AppBar(title: const Text('Mot de passe oublié')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Text(
              'Saisissez l\'e-mail ou le numéro associé au compte. '
              'Le message affiché est volontairement identique, que le compte existe ou non.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _identifier,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'E-mail ou téléphone',
                errorText: _fieldError,
              ),
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
              label: 'Envoyer la demande',
              loading: _submitting,
              onPressed: _submit,
            ),
            TextButton(
              onPressed: () => context.push(AppRoutes.resetPassword),
              child: const Text('J\'ai déjà un code de réinitialisation'),
            ),
          ],
        ),
      ),
    );
  }
}
