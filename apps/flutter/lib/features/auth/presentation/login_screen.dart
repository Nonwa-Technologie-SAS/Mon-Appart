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

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});

  final String? next;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  String? _identifierError;
  String? _passwordError;
  String? _formError;
  var _submitting = false;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifierError = AuthRules.identifierError(_identifier.text);
    final passwordError = _password.text.isEmpty
        ? 'Saisissez votre mot de passe.'
        : null;
    setState(() {
      _identifierError = identifierError;
      _passwordError = passwordError;
      _formError = null;
    });
    if (identifierError != null || passwordError != null || _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final user = await ref
          .read(authControllerProvider.notifier)
          .login(identifier: _identifier.text.trim(), password: _password.text);
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
        _formError = 'La connexion a échoué.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connexion')),
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              Text(
                'Connectez-vous pour enregistrer des favoris, contacter un annonceur ou demander une visite.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: _identifier,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [
                  AutofillHints.username,
                  AutofillHints.email,
                  AutofillHints.telephoneNumber,
                ],
                decoration: InputDecoration(
                  labelText: 'E-mail ou téléphone',
                  errorText: _identifierError,
                ),
                onChanged: (_) {
                  if (_identifierError != null) {
                    setState(() => _identifierError = null);
                  }
                },
              ),
              const SizedBox(height: AppSpacing.md),
              PasswordField(
                controller: _password,
                errorText: _passwordError,
                onSubmitted: (_) => _submit(),
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
                label: 'Se connecter',
                loading: _submitting,
                onPressed: _submit,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => context.push(AppRoutes.forgotPassword),
                child: const Text('Mot de passe oublié'),
              ),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => context.push(
                        AppRoutes.sanitizeNext(widget.next) == null
                            ? AppRoutes.register
                            : Uri(
                                path: AppRoutes.register,
                                queryParameters: {
                                  AppRoutes.nextQuery: widget.next,
                                },
                              ).toString(),
                      ),
                child: const Text('Créer un compte'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
