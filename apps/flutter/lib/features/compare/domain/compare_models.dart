import '../../account/domain/housing_preferences.dart';
import '../../listing/domain/listing_detail.dart';
import '../../listing/domain/listing_trust.dart';
import 'shortlist_entry.dart';

enum CompareItemStatus { loaded, unavailable, failed }

enum BudgetFit { none, respects, overTarget, exceeds, incomparable, unknown }

class CompareItem {
  const CompareItem({
    required this.entry,
    required this.status,
    this.listing,
    this.trust = const ListingTrust(),
    this.errorMessage,
  });

  factory CompareItem.loaded(ListingDetail listing, ListingTrust trust) {
    return CompareItem(
      entry: ShortlistEntry.fromDetail(listing),
      status: CompareItemStatus.loaded,
      listing: listing,
      trust: trust,
    );
  }

  factory CompareItem.unavailable(ShortlistEntry entry) {
    return CompareItem(entry: entry, status: CompareItemStatus.unavailable);
  }

  factory CompareItem.failed(ShortlistEntry entry, String message) {
    return CompareItem(
      entry: entry,
      status: CompareItemStatus.failed,
      errorMessage: message,
    );
  }

  final ShortlistEntry entry;
  final CompareItemStatus status;
  final ListingDetail? listing;
  final ListingTrust trust;
  final String? errorMessage;

  bool get isLoaded => status == CompareItemStatus.loaded && listing != null;
}

class CriterionCell {
  const CriterionCell({
    required this.value,
    this.missing = false,
    this.emphasized = false,
  });

  final String value;
  final bool missing;
  final bool emphasized;
}

class CriterionRow {
  const CriterionRow({required this.label, required this.cells});

  final String label;
  final List<CriterionCell> cells;
}

class CompareInsight {
  const CompareInsight({required this.text, required this.kind});

  final String text;
  final String kind;
}

class CompareReport {
  const CompareReport({
    required this.items,
    required this.rows,
    required this.insights,
    required this.questions,
    this.preferences = const HousingPreferences(),
  });

  final List<CompareItem> items;
  final List<CriterionRow> rows;
  final List<CompareInsight> insights;
  final List<String> questions;
  final HousingPreferences preferences;

  List<CompareItem> get loaded => [
    for (final item in items)
      if (item.isLoaded) item,
  ];

  int get loadedCount => loaded.length;
}
