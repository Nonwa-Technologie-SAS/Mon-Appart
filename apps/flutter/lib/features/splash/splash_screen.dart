import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/router/app_routes.dart';
import '../../app/theme/app_colors.dart';
import '../../app/theme/app_spacing.dart';
import '../auth/presentation/auth_providers.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  static const delay = Duration(milliseconds: 500);

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(Future<void>.delayed(SplashScreen.delay, _goNext));
  }

  Future<void> _goNext() async {
    if (!mounted) {
      return;
    }
    final config = ref.read(appConfigProvider);
    if (config.isConfigured) {
      try {
        await ref
            .read(authControllerProvider.future)
            .timeout(const Duration(seconds: 3));
      } catch (_) {}
    }
    if (!mounted) {
      return;
    }
    context.go(config.isConfigured ? AppRoutes.home : AppRoutes.configMissing);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image(
                  image: AssetImage('assets/images/logo.png'),
                  height: 96,
                  semanticLabel: 'Mon Appart',
                ),
                SizedBox(height: AppSpacing.lg),
                Text(
                  'Mon Appart',
                  style: TextStyle(
                    color: AppColors.primaryForeground,
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: AppSpacing.xs),
                Text(
                  'Trouvez votre chez-vous',
                  style: TextStyle(
                    color: AppColors.primaryForeground,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
