import 'package:url_launcher/url_launcher.dart';

import '../domain/support_channels.dart';

abstract class SupportLauncher {
  Future<bool> open(Uri uri);
}

class UrlSupportLauncher implements SupportLauncher {
  const UrlSupportLauncher();

  @override
  Future<bool> open(Uri uri) async {
    if (!SupportChannels.isAllowed(uri)) {
      return false;
    }
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
