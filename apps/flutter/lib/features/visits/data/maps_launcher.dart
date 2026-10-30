import 'package:url_launcher/url_launcher.dart';

import '../domain/external_maps.dart';

abstract class MapsLauncher {
  Future<bool> open(Uri uri);
}

class UrlMapsLauncher implements MapsLauncher {
  const UrlMapsLauncher();

  @override
  Future<bool> open(Uri uri) async {
    if (!ExternalMaps.isAllowed(uri)) {
      return false;
    }
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class RecordingMapsLauncher implements MapsLauncher {
  Uri? last;
  var opened = false;

  @override
  Future<bool> open(Uri uri) async {
    last = uri;
    opened = ExternalMaps.isAllowed(uri);
    return opened;
  }
}
