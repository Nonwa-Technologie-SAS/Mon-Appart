import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_providers.dart';
import 'push_providers.dart';

/// Enregistre le jeton à la connexion. La désinscription se fait avant logout.
final pushLifecycleProvider = Provider<void>((ref) {
  ref.listen(authControllerProvider, (previous, next) {
    final was = previous?.asData?.value.isAuthenticated == true;
    final now = next.asData?.value.isAuthenticated == true;
    if (!was && now) {
      unawaited(ref.read(pushCoordinatorProvider).sync());
    }
  });
});
