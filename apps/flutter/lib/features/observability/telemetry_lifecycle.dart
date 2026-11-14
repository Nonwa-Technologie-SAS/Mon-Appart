import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/observability/flutter_telemetry_hooks.dart';
import '../auth/presentation/auth_providers.dart';

final telemetryLifecycleProvider = Provider<void>((ref) {
  final client = ref.watch(telemetryProvider);
  client.setPlatform(defaultTargetPlatform.name);
  FlutterTelemetryHooks.attach(client);
  ref.onDispose(() => FlutterTelemetryHooks.detach(client));

  ref.listen(authControllerProvider, (_, next) {
    final roles = next.value?.user?.roles ?? const <String>[];
    if (roles.isEmpty) {
      client.clearRole();
    } else {
      client.setRole(roles.join(','));
    }
  });

  final started = ref.watch(launchStartedAtProvider);
  WidgetsBinding.instance.addPostFrameCallback((_) {
    client.recordStartup(DateTime.now().difference(started));
  });
});
