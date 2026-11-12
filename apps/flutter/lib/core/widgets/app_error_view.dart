import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_spacing.dart';
import '../errors/app_failure.dart';
import 'app_button.dart';

class AppErrorView extends StatelessWidget {
  const AppErrorView({
    super.key,
    required this.failure,
    this.onRetry,
    this.title = 'Connexion impossible',
    this.compact = false,
  });

  final AppFailure failure;
  final VoidCallback? onRetry;
  final String title;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      child: Column(
        mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
        mainAxisAlignment: compact
            ? MainAxisAlignment.start
            : MainAxisAlignment.center,
        children: [
          Icon(
            Icons.wifi_off_rounded,
            size: compact ? 36 : 48,
            color: AppColors.destructive,
            semanticLabel: title,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            failure.message,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: AppColors.mutedForeground),
            textAlign: TextAlign.center,
          ),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: 'Réessayer',
              icon: Icons.refresh,
              onPressed: onRetry,
            ),
          ],
        ],
      ),
    );
  }
}
