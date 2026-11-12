import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_spacing.dart';
import '../../core/offline/cached_envelope.dart';
import '../../core/offline/offline_providers.dart';
import 'offline_runtime.dart';

class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(connectivityControllerProvider);
    final pending =
        ref.watch(pendingCountProvider).value ?? snapshot.pendingCount;
    final text = snapshot.copyWith(pendingCount: pending).bannerText;
    if (text.isEmpty) {
      return const SizedBox.shrink();
    }
    final offline = snapshot.isOffline;
    return Material(
      color: offline ? const Color(0xFFFFF4E5) : AppColors.accent,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          child: Row(
            children: [
              Icon(
                offline ? Icons.wifi_off : Icons.sync,
                size: 18,
                color: offline ? AppColors.warning : AppColors.info,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(text, style: Theme.of(context).textTheme.bodySmall),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class StaleNotice extends StatelessWidget {
  const StaleNotice({
    super.key,
    required this.cachedAt,
    this.fromCache = false,
    this.queued = false,
    this.child,
  });

  final DateTime? cachedAt;
  final bool fromCache;
  final bool queued;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      if (queued) 'Modification en attente d\'envoi au serveur.',
      if (fromCache && cachedAt != null) formatCachedAt(cachedAt!),
      if (fromCache) 'Le prix et la disponibilité peuvent avoir changé.',
    ];
    if (parts.isEmpty) {
      return child ?? const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: AppColors.muted,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            parts.join(' '),
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.mutedForeground),
          ),
        ),
        if (child != null) ...[const SizedBox(height: AppSpacing.sm), child!],
      ],
    );
  }
}
