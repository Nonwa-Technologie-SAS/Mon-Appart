import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/auth/auth_user.dart';

void completeAuthNavigation(
  BuildContext context, {
  AuthUser? user,
  String? next,
}) {
  final resolved = AppRoutes.sanitizeNext(
    next ?? GoRouterState.of(context).uri.queryParameters[AppRoutes.nextQuery],
  );
  if (resolved != null) {
    context.go(resolved);
    return;
  }
  if (user != null && user.needsVerification) {
    context.go(AppRoutes.verifyContact);
    return;
  }
  context.go(AppRoutes.account);
}
