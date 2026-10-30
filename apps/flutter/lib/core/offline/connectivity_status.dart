enum ConnectivityKind { unknown, offline, unreachable, online }

class ConnectivitySnapshot {
  const ConnectivitySnapshot({
    required this.kind,
    this.lastSuccessAt,
    this.lastFailureAt,
    this.lastProbeAt,
    this.pendingCount = 0,
    this.message,
  });

  static const initial = ConnectivitySnapshot(kind: ConnectivityKind.unknown);

  final ConnectivityKind kind;
  final DateTime? lastSuccessAt;
  final DateTime? lastFailureAt;
  final DateTime? lastProbeAt;
  final int pendingCount;
  final String? message;

  bool get isOffline =>
      kind == ConnectivityKind.offline || kind == ConnectivityKind.unreachable;

  bool get isOnline => kind == ConnectivityKind.online;

  String get bannerText {
    if (pendingCount > 0 && isOffline) {
      return pendingCount == 1
          ? 'Hors ligne · 1 action en attente'
          : 'Hors ligne · $pendingCount actions en attente';
    }
    return switch (kind) {
      ConnectivityKind.offline =>
        'Hors ligne. Les données affichées viennent du cache local.',
      ConnectivityKind.unreachable =>
        'Réseau détecté, mais le serveur Mon Appart est injoignable.',
      ConnectivityKind.online when pendingCount > 0 =>
        pendingCount == 1
            ? 'Connexion rétablie · 1 action à synchroniser'
            : 'Connexion rétablie · $pendingCount actions à synchroniser',
      ConnectivityKind.online => '',
      ConnectivityKind.unknown => '',
    };
  }

  ConnectivitySnapshot copyWith({
    ConnectivityKind? kind,
    DateTime? lastSuccessAt,
    DateTime? lastFailureAt,
    DateTime? lastProbeAt,
    int? pendingCount,
    String? message,
    bool clearMessage = false,
  }) {
    return ConnectivitySnapshot(
      kind: kind ?? this.kind,
      lastSuccessAt: lastSuccessAt ?? this.lastSuccessAt,
      lastFailureAt: lastFailureAt ?? this.lastFailureAt,
      lastProbeAt: lastProbeAt ?? this.lastProbeAt,
      pendingCount: pendingCount ?? this.pendingCount,
      message: clearMessage ? null : (message ?? this.message),
    );
  }
}
