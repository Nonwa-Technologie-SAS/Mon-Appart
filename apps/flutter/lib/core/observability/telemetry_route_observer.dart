import 'package:flutter/widgets.dart';

import 'telemetry_client.dart';
import 'telemetry_event.dart';
import 'telemetry_redactor.dart';

/// Nom d'écran = chemin, sans query (texte de recherche, jetons).
class TelemetryRouteObserver extends NavigatorObserver {
  TelemetryRouteObserver(this._telemetry);

  final TelemetryClient _telemetry;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _record(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) {
      _record(newRoute);
    }
  }

  void _record(Route<dynamic> route) {
    final name = route.settings.name;
    if (name == null || name.isEmpty) {
      return;
    }
    final path = redactPath(Uri.tryParse(name)?.path ?? name.split('?').first);
    if (path.isEmpty) {
      return;
    }
    _telemetry.record(
      severity: TelemetrySeverity.low,
      kind: TelemetryKind.navigation,
      operation: 'navigation.open',
      message: 'Ouverture d\'écran',
      attributes: {'path': path},
    );
  }
}
