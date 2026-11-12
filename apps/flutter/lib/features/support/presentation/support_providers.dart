import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/report_repository.dart';
import '../data/support_launcher.dart';
import '../domain/own_report.dart';

final supportLauncherProvider = Provider<SupportLauncher>((ref) {
  return const UrlSupportLauncher();
});

final reportRepositoryProvider = Provider<ReportRepository>((ref) {
  return ReportRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final ownReportsProvider = FutureProvider.autoDispose<List<OwnReport>>((
  ref,
) async {
  return ref.watch(reportRepositoryProvider).listOwn();
});
