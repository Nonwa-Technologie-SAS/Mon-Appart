import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

class ListingStatsItem {
  const ListingStatsItem({
    required this.listingId,
    required this.title,
    required this.status,
    required this.detailViews,
    required this.contactsSubmitted,
    required this.appointmentsRequested,
    this.contactRate,
    this.appointmentRate,
  });

  final String listingId;
  final String title;
  final String status;
  final int detailViews;
  final int contactsSubmitted;
  final int appointmentsRequested;
  final double? contactRate;
  final double? appointmentRate;
}

class ListingStatsPage {
  const ListingStatsPage({
    required this.items,
    this.from,
    this.to,
    this.computedAt,
  });

  final List<ListingStatsItem> items;
  final String? from;
  final String? to;
  final DateTime? computedAt;

  int get detailViews =>
      items.fold<int>(0, (sum, item) => sum + item.detailViews);

  int get contactsSubmitted =>
      items.fold<int>(0, (sum, item) => sum + item.contactsSubmitted);

  static ListingStatsPage parse(Map<String, Object?> json) {
    final range = asJsonMapOrNull(json['range']);
    final meta = asJsonMapOrNull(json['meta']);
    final raw = json['items'];
    return ListingStatsPage(
      items: raw is List ? [for (final item in raw) ?_item(item)] : const [],
      from: asNonEmptyString(range?['from']),
      to: asNonEmptyString(range?['to']),
      computedAt: DateTime.tryParse(
        asNonEmptyString(meta?['computedAt']) ?? '',
      ),
    );
  }

  static ListingStatsItem? _item(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final listing = asJsonMapOrNull(json['listing']);
    final id = asNonEmptyString(listing?['id']);
    final title = asNonEmptyString(listing?['title']);
    if (id == null || !PublicIds.isUuid(id) || title == null) {
      return null;
    }
    final totals = asJsonMapOrNull(json['totals']);
    final rates = asJsonMapOrNull(json['rates']);
    return ListingStatsItem(
      listingId: id,
      title: title,
      status: asNonEmptyString(listing?['status']) ?? 'DRAFT',
      detailViews: asInt(totals?['detailViews']) ?? 0,
      contactsSubmitted: asInt(totals?['contactsSubmitted']) ?? 0,
      appointmentsRequested: asInt(totals?['appointmentsRequested']) ?? 0,
      contactRate: asDouble(rates?['contactRate']),
      appointmentRate: asDouble(rates?['appointmentRate']),
    );
  }
}

abstract final class ProPercent {
  static String format(double? rate) {
    if (rate == null) {
      return '—';
    }
    return '${(rate * 100).round()} %';
  }
}
