import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/auth/auth_rules.dart';
import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/security/screen_privacy.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_loading.dart';
import 'auth_providers.dart';

class VerifyContactScreen extends ConsumerStatefulWidget {
  const VerifyContactScreen({super.key});

  @override
  ConsumerState<VerifyContactScreen> createState() =>
      _VerifyContactScreenState();
}

class _VerifyContactScreenState extends ConsumerState<VerifyContactScreen> {
  final _code = TextEditingController();
  final _privacy = SensitiveScreenBinding();
  var _channel = 'EMAIL';
  String? _challengeId;
  DateTime? _resendAt;
  String? _codeError;
  String? _formError;
  String? _info;
  var _sending = false;
  var _confirming = false;

  @override
  void initState() {
    super.initState();
    _privacy.attach(ref);
  }

  @override
  void dispose() {
    _privacy.detach();
    _code.dispose();
    super.dispose();
  }

  String _activeChannel(AuthUser? user) {
    final channels = <String>[
      if (user?.email != null) 'EMAIL',
      if (user?.phone != null) 'PHONE',
    ];
    if (channels.contains(_channel)) {
      return _channel;
    }
    return channels.isNotEmpty ? channels.first : 'EMAIL';
  }

  Future<void> _request() async {
    if (_sending) {
      return;
    }
    setState(() {
      _sending = true;
      _formError = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      final OtpChallenge challenge =
          _activeChannel(ref.read(authControllerProvider).value?.user) ==
              'PHONE'
          ? await repo.requestPhoneVerification()
          : await repo.requestEmailVerification();
      if (!mounted) {
        return;
      }
      setState(() {
        _sending = false;
        _challengeId = challenge.challengeId;
        _resendAt = challenge.resendAvailableAt;
        _info =
            'Un code a été demandé. Il n\'est pas stocké dans l\'application.';
      });
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _sending = false;
        _formError = error.message;
      });
    }
  }

  Future<void> _confirm() async {
    final codeError = AuthRules.otpError(_code.text);
    setState(() => _codeError = codeError);
    if (codeError != null || _confirming) {
      return;
    }
    setState(() {
      _confirming = true;
      _formError = null;
    });
    try {
      if (_activeChannel(ref.read(authControllerProvider).value?.user) ==
          'PHONE') {
        await ref
            .read(authControllerProvider.notifier)
            .confirmPhone(code: _code.text.trim(), challengeId: _challengeId);
      } else {
        await ref
            .read(authControllerProvider.notifier)
            .confirmEmail(code: _code.text.trim(), challengeId: _challengeId);
      }
      if (!mounted) {
        return;
      }
      context.go(AppRoutes.account);
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _confirming = false;
        _formError = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider);
    final user = session.value?.user;
    if (session.isLoading && user == null) {
      return const Scaffold(
        body: AppLoading(label: 'Vérification de la session'),
      );
    }
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Vérification')),
        body: const Center(
          child: Text('Connectez-vous pour vérifier le compte.'),
        ),
      );
    }
    final channels = <String>[
      if (user.email != null) 'EMAIL',
      if (user.phone != null) 'PHONE',
    ];
    final channel = channels.contains(_channel)
        ? _channel
        : (channels.isNotEmpty ? channels.first : 'EMAIL');
    final canResend = _resendAt == null || !_resendAt!.isAfter(DateTime.now());
    return Scaffold(
      appBar: AppBar(title: const Text('Vérifier le compte')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Text(
              'La vérification est confirmée uniquement par Nest. '
              'Un compte PENDING peut déjà utiliser l\'application.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            if (channels.length > 1)
              SegmentedButton<String>(
                segments: [
                  if (channels.contains('EMAIL'))
                    const ButtonSegment(value: 'EMAIL', label: Text('E-mail')),
                  if (channels.contains('PHONE'))
                    const ButtonSegment(
                      value: 'PHONE',
                      label: Text('Téléphone'),
                    ),
                ],
                selected: {channel},
                onSelectionChanged: (value) {
                  setState(() => _channel = value.first);
                },
              )
            else if (channels.length == 1)
              Text(
                channel == 'PHONE'
                    ? 'Vérification par SMS'
                    : 'Vérification par e-mail',
              ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Envoyer un code',
              variant: AppButtonVariant.outline,
              loading: _sending,
              onPressed: canResend ? _request : null,
            ),
            if (!canResend && _resendAt != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(
                  'Nouveau code possible après ${_resendAt!.toLocal()}.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              enableIMEPersonalizedLearning: false,
              autofillHints: const [AutofillHints.oneTimeCode],
              maxLength: 10,
              decoration: InputDecoration(
                labelText: 'Code reçu',
                errorText: _codeError,
              ),
            ),
            if (_info != null) Text(_info!),
            if (_formError != null)
              Text(
                _formError!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: 'Confirmer',
              loading: _confirming,
              onPressed: _confirm,
            ),
            TextButton(
              onPressed: () => context.go(AppRoutes.account),
              child: const Text('Plus tard'),
            ),
          ],
        ),
      ),
    );
  }
}
