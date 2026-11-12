import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/security/screen_privacy.dart';
import '../features/messaging/presentation/messaging_providers.dart';
import '../features/notifications/presentation/push_lifecycle.dart';
import '../features/observability/telemetry_lifecycle.dart';
import '../features/offline/offline_lifecycle.dart';
import 'providers.dart';
import 'theme/app_theme.dart';

class MonAppartApp extends ConsumerWidget {
  const MonAppartApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);
    ref.watch(pushLifecycleProvider);
    ref.watch(messagingRealtimeLifecycleProvider);
    ref.watch(offlineLifecycleProvider);
    ref.watch(telemetryLifecycleProvider);
    return MaterialApp.router(
      title: 'Mon Appart',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.light,
      routerConfig: router,
      builder: (context, child) {
        return ScreenPrivacyOverlay(child: child ?? const SizedBox.shrink());
      },
    );
  }
}
