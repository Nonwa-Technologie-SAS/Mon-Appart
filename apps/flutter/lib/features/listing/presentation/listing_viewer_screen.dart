import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/property_image.dart';
import '../domain/listing_media.dart';

class ListingViewerScreen extends StatefulWidget {
  const ListingViewerScreen({
    super.key,
    required this.items,
    required this.initialIndex,
  });

  final List<ListingMediaItem> items;
  final int initialIndex;

  @override
  State<ListingViewerScreen> createState() => _ListingViewerScreenState();
}

class _ListingViewerScreenState extends State<ListingViewerScreen> {
  late final PageController _controller;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _controller = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        backgroundColor: AppColors.darkBackground,
        foregroundColor: AppColors.darkForeground,
        title: Text('${_index + 1} / ${widget.items.length}'),
      ),
      body: PageView.builder(
        controller: _controller,
        itemCount: widget.items.length,
        onPageChanged: (value) => setState(() => _index = value),
        itemBuilder: (context, index) {
          final item = widget.items[index];
          return InteractiveViewer(
            child: Center(
              child: PropertyImage(
                url: item.viewerUrl,
                semanticLabel: 'Photo ${index + 1} en plein écran',
              ),
            ),
          );
        },
      ),
    );
  }
}
