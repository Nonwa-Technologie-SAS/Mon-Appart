import 'package:share_plus/share_plus.dart';

/// Port de partage natif. Les tests injectent une doublure.
abstract class ListingShare {
  Future<void> shareText(String text);
}

class SystemListingShare implements ListingShare {
  const SystemListingShare();

  @override
  Future<void> shareText(String text) async {
    await SharePlus.instance.share(ShareParams(text: text));
  }
}
