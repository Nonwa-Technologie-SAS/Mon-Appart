import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/location/device_location.dart';
import '../../../core/location/geolocator_location.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/search/geo_search.dart';
import '../../../core/search/map_markers.dart';
import '../../../core/search/search_catalog.dart';
import '../../../core/widgets/property_card.dart';
import '../domain/explore_feed.dart';

class ExploreMapPane extends ConsumerStatefulWidget {
  const ExploreMapPane({
    super.key,
    required this.query,
    required this.feed,
    required this.loading,
    this.stale = false,
    required this.onQueryChanged,
    required this.onOpenListing,
    required this.onFavorite,
    required this.isFavorite,
    required this.favoriteEnabled,
    required this.onRetry,
  });

  final ExploreQuery query;
  final ExploreFeed? feed;
  final bool loading;
  final bool stale;
  final ValueChanged<ExploreQuery> onQueryChanged;
  final ValueChanged<ListingSummary> onOpenListing;
  final ValueChanged<ListingSummary> onFavorite;
  final bool Function(String listingId) isFavorite;
  final bool Function(String listingId) favoriteEnabled;
  final VoidCallback onRetry;

  @override
  ConsumerState<ExploreMapPane> createState() => _ExploreMapPaneState();
}

class _ExploreMapPaneState extends ConsumerState<ExploreMapPane> {
  final _mapController = MapController();
  Timer? _moveDebounce;
  var _ignoreNextMove = true;
  String? _selectedId;
  LocationPermissionUi? _permissionHint;

  @override
  void dispose() {
    _moveDebounce?.cancel();
    super.dispose();
  }

  List<ListingSummary> get _items => widget.feed?.items ?? const [];

  List<ListingMapMarker> get _markers => MapMarkers.fromListings(_items);

  ListingSummary? get _selected {
    final id = _selectedId;
    if (id == null) {
      return null;
    }
    for (final item in _items) {
      if (item.listingId == id) {
        return item;
      }
    }
    return null;
  }

  LatLng get _initialCenter {
    final query = widget.query;
    if (query.hasGeo) {
      return LatLng(query.lat!, query.lng!);
    }
    final neighborhood = SearchCatalog.approximateCoordinates(
      query.neighborhood,
    );
    if (neighborhood != null) {
      return LatLng(neighborhood.$1, neighborhood.$2);
    }
    final first = _markers.isEmpty ? null : _markers.first;
    if (first != null) {
      return LatLng(first.latitude, first.longitude);
    }
    return LatLng(GeoSearch.abidjan.latitude, GeoSearch.abidjan.longitude);
  }

  Future<void> _aroundMe() async {
    final location = ref.read(deviceLocationProvider);
    final status = await location.status();
    if (!mounted) {
      return;
    }
    if (status == LocationPermissionUi.unavailable) {
      setState(() => _permissionHint = status);
      return;
    }
    if (status == LocationPermissionUi.serviceDisabled ||
        status == LocationPermissionUi.permanentlyDenied) {
      setState(() => _permissionHint = status);
      return;
    }
    if (status != LocationPermissionUi.granted) {
      final accepted = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Autour de moi'),
          content: const Text(
            'La position sert uniquement à chercher des biens dans un rayon. '
            'Elle n\'est pas enregistrée sur votre compte et n\'est pas suivie '
            'en arrière-plan.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Pas maintenant'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Autoriser'),
            ),
          ],
        ),
      );
      if (accepted != true || !mounted) {
        return;
      }
      final requested = await location.request();
      if (!mounted) {
        return;
      }
      if (requested != LocationPermissionUi.granted) {
        setState(() => _permissionHint = requested);
        return;
      }
    }
    try {
      final position = await location.current();
      if (!mounted) {
        return;
      }
      final radius = widget.query.radius ?? GeoSearch.defaultRadiusKm;
      _ignoreNextMove = true;
      _mapController.move(
        LatLng(position.latitude, position.longitude),
        GeoSearch.defaultZoom,
      );
      widget.onQueryChanged(
        widget.query.copyWith(
          lat: GeoSearch.roundCoord(position.latitude),
          lng: GeoSearch.roundCoord(position.longitude),
          radius: radius,
          view: 'map',
        ),
      );
      setState(() => _permissionHint = LocationPermissionUi.granted);
    } catch (_) {
      if (mounted) {
        setState(() => _permissionHint = LocationPermissionUi.unavailable);
      }
    }
  }

  void _onMapEvent(MapEvent event) {
    if (event is! MapEventMoveEnd && event is! MapEventFlingAnimationEnd) {
      return;
    }
    if (_ignoreNextMove) {
      _ignoreNextMove = false;
      return;
    }
    _moveDebounce?.cancel();
    _moveDebounce = Timer(const Duration(milliseconds: 700), _searchViewport);
  }

  void _searchViewport() {
    if (!mounted) {
      return;
    }
    final camera = _mapController.camera;
    final bounds = camera.visibleBounds;
    final center = camera.center;
    final radius = GeoSearch.radiusFromBounds(
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
      centerLatitude: center.latitude,
      centerLongitude: center.longitude,
    );
    final next = widget.query.copyWith(
      lat: GeoSearch.roundCoord(center.latitude),
      lng: GeoSearch.roundCoord(center.longitude),
      radius: radius,
      view: 'map',
    );
    if (next.lat == widget.query.lat &&
        next.lng == widget.query.lng &&
        next.radius == widget.query.radius) {
      return;
    }
    widget.onQueryChanged(next);
  }

  void _recenter() {
    _ignoreNextMove = true;
    _mapController.move(_initialCenter, GeoSearch.defaultZoom);
  }

  @override
  Widget build(BuildContext context) {
    final tilesEnabled = ref.watch(mapTilesEnabledProvider);
    final config = ref.watch(appConfigProvider);
    final zoom = _tryZoom() ?? GeoSearch.defaultZoom;
    final clusters = MapMarkers.cluster(_markers, zoom: zoom);
    final selected = _selected;
    final hiddenCount = _items.length - _markers.length;

    return Stack(
      children: [
        if (!tilesEnabled)
          const ColoredBox(color: AppColors.muted, child: SizedBox.expand()),
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _initialCenter,
            initialZoom: GeoSearch.defaultZoom,
            minZoom: GeoSearch.minZoom,
            maxZoom: GeoSearch.maxZoom,
            onMapEvent: _onMapEvent,
            onTap: (_, _) => setState(() => _selectedId = null),
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            if (tilesEnabled)
              TileLayer(
                urlTemplate: config.resolvedMapTileUrl,
                userAgentPackageName: 'ci.monappart.mon_appart',
              ),
            MarkerLayer(
              markers: [
                for (final cluster in clusters)
                  Marker(
                    point: LatLng(cluster.latitude, cluster.longitude),
                    width: cluster.isSingle ? 88 : 40,
                    height: cluster.isSingle ? 36 : 40,
                    child: cluster.isSingle
                        ? _PriceMarker(
                            listing: cluster.first.listing,
                            selected:
                                cluster.first.listing.listingId == _selectedId,
                            onTap: () => setState(
                              () =>
                                  _selectedId = cluster.first.listing.listingId,
                            ),
                          )
                        : _ClusterMarker(
                            count: cluster.count,
                            onTap: () {
                              _ignoreNextMove = true;
                              _mapController.move(
                                LatLng(cluster.latitude, cluster.longitude),
                                (zoom + 1.5).clamp(
                                  GeoSearch.minZoom,
                                  GeoSearch.maxZoom,
                                ),
                              );
                            },
                          ),
                  ),
              ],
            ),
            if (widget.query.hasGeo)
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: LatLng(widget.query.lat!, widget.query.lng!),
                    radius:
                        (widget.query.radius ?? GeoSearch.defaultRadiusKm) *
                        1000,
                    useRadiusInMeter: true,
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderStrokeWidth: 1,
                    borderColor: AppColors.primary.withValues(alpha: 0.4),
                  ),
                ],
              ),
          ],
        ),
        Positioned(
          top: AppSpacing.sm,
          left: AppSpacing.md,
          right: AppSpacing.md,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.loading) const LinearProgressIndicator(),
              if (widget.stale)
                _MapBanner(
                  text: 'Résultats peut-être obsolètes.',
                  action: 'Réessayer',
                  onAction: widget.onRetry,
                ),
              if (_permissionHint == LocationPermissionUi.denied)
                const _MapBanner(
                  text: 'Recherche manuelle toujours disponible : déplacez la carte ou choisissez une commune.',
                ),
              if (_permissionHint == LocationPermissionUi.permanentlyDenied)
                _MapBanner(
                  text: 'Activez la localisation dans les réglages.',
                  action: 'Réglages',
                  onAction: () {
                    unawaited(ref.read(deviceLocationProvider).openSettings());
                  },
                ),
              if (_permissionHint == LocationPermissionUi.serviceDisabled)
                _MapBanner(
                  text: 'Le service de localisation de l\'appareil est désactivé.',
                  action: 'Réglages',
                  onAction: () {
                    unawaited(ref.read(deviceLocationProvider).openSettings());
                  },
                ),
              if (_permissionHint == LocationPermissionUi.unavailable)
                const _MapBanner(
                  text: 'Géolocalisation indisponible sur cet appareil.',
                ),
              if (hiddenCount > 0)
                _MapBanner(
                  text:
                      '$hiddenCount annonce(s) sans coordonnées publiques : visibles dans la liste seulement.',
                ),
            ],
          ),
        ),
        Positioned(
          right: AppSpacing.md,
          bottom: selected == null ? 96 : 220,
          child: Column(
            children: [
              _RoundMapButton(
                tooltip: 'Autour de moi',
                icon: Icons.my_location,
                onPressed: _aroundMe,
              ),
              const SizedBox(height: AppSpacing.xs),
              _RoundMapButton(
                tooltip: 'Recentrer',
                icon: Icons.filter_center_focus,
                onPressed: _recenter,
              ),
            ],
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    AppSpacing.xs,
                  ),
                  child: PropertyCard(
                    listing: selected,
                    onTap: () => widget.onOpenListing(selected),
                    onFavorite: () => widget.onFavorite(selected),
                    isFavorite: widget.isFavorite(selected.listingId),
                    favoriteEnabled: widget.favoriteEnabled(selected.listingId),
                  ),
                ),
              Material(
                color: AppColors.card,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.xs,
                    AppSpacing.md,
                    AppSpacing.sm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _caption(),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Wrap(
                        spacing: AppSpacing.xs,
                        children: [
                          for (final option in GeoSearch.radiusOptionsKm)
                            ChoiceChip(
                              label: Text(GeoSearch.formatRadiusKm(option)),
                              selected:
                                  (widget.query.radius ??
                                      GeoSearch.defaultRadiusKm) ==
                                  option,
                              onSelected: widget.query.hasGeo
                                  ? (_) => widget.onQueryChanged(
                                      widget.query.copyWith(
                                        radius: option,
                                        view: 'map',
                                      ),
                                    )
                                  : null,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _caption() {
    final onMap = _markers.length;
    final total = _items.length;
    if (total == 0) {
      return 'Aucun bien dans cette recherche.';
    }
    if (widget.query.hasGeo) {
      final radius = GeoSearch.formatRadiusKm(
        widget.query.radius ?? GeoSearch.defaultRadiusKm,
      );
      return '$onMap bien(s) géolocalisé(s) dans un rayon de $radius (vol d\'oiseau).';
    }
    if (onMap == total) {
      return '$onMap bien(s) sur la carte. Déplacez-la pour chercher dans la zone visible.';
    }
    return '$onMap sur $total avec une position publique.';
  }

  double? _tryZoom() {
    try {
      return _mapController.camera.zoom;
    } catch (_) {
      return null;
    }
  }
}

class _PriceMarker extends StatelessWidget {
  const _PriceMarker({
    required this.listing,
    required this.selected,
    required this.onTap,
  });

  final ListingSummary listing;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${listing.title}, ${listing.priceLabel}',
      child: Material(
        color: selected ? AppColors.primary : AppColors.card,
        elevation: selected ? 4 : 1,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Text(
              listing.priceLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected
                    ? AppColors.primaryForeground
                    : AppColors.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ClusterMarker extends StatelessWidget {
  const _ClusterMarker({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$count biens regroupés',
      child: Material(
        color: AppColors.accent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Center(
            child: Text(
              '$count',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: AppColors.accentForeground,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundMapButton extends StatelessWidget {
  const _RoundMapButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      elevation: 2,
      shape: const CircleBorder(),
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        icon: Icon(icon),
      ),
    );
  }
}

class _MapBanner extends StatelessWidget {
  const _MapBanner({required this.text, this.action, this.onAction});

  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      color: AppColors.card.withValues(alpha: 0.94),
      child: Row(
        children: [
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodySmall),
          ),
          if (action != null && onAction != null)
            TextButton(onPressed: onAction, child: Text(action!)),
        ],
      ),
    );
  }
}

final deviceLocationProvider = Provider<DeviceLocation>((ref) {
  return const GeolocatorLocation();
});

final mapTilesEnabledProvider = Provider<bool>((ref) => true);
