import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_radii.dart';
import '../../app/theme/app_spacing.dart';

enum StatusBadgeTone { neutral, accent, success, warning }

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.tone = StatusBadgeTone.accent,
  });

  final String label;
  final StatusBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (Color background, Color foreground) = switch (tone) {
      StatusBadgeTone.accent => (AppColors.accent, AppColors.accentForeground),
      StatusBadgeTone.success => (
        AppColors.success.withValues(alpha: 0.12),
        AppColors.success,
      ),
      StatusBadgeTone.warning => (
        AppColors.secondary.withValues(alpha: 0.2),
        AppColors.secondaryForeground,
      ),
      StatusBadgeTone.neutral => (AppColors.muted, AppColors.mutedForeground),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium
            ?.copyWith(color: foreground),
      ),
    );
  }
}
