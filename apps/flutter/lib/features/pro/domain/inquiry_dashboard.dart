import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

class InquiryTopListing {
  const InquiryTopListing({
    required this.id,
    required this.title,
    required this.contacts,
  });

  final String id;
  final String title;
  final int contacts;
}

class InquiryDashboard {
  const InquiryDashboard({
    required this.windowDays,
    required this.newContacts,
    required this.unhandled,
    required this.overdueActions,
    required this.pendingVisits,
    required this.confirmedUpcomingVisits,
    required this.completedVisits,
    required this.computedAt,
    this.responseRate,
    this.medianFirstResponseHours,
    this.contactToVisitRate,
    this.totalInquiries = 0,
    this.responded = 0,
    this.topListings = const [],
  });

  final int windowDays;
  final int newContacts;
  final int unhandled;
  final int overdueActions;
  final int pendingVisits;
  final int confirmedUpcomingVisits;
  final int completedVisits;
  final double? responseRate;
  final double? medianFirstResponseHours;
  final double? contactToVisitRate;
  final int totalInquiries;
  final int responded;
  final List<InquiryTopListing> topListings;
  final DateTime computedAt;

  static InquiryDashboard parse(Map<String, Object?> json) {
    final totals = asJsonMapOrNull(json['totals']);
    final rawTop = json['topListings'];
    return InquiryDashboard(
      windowDays: asInt(json['windowDays']) ?? 7,
      newContacts: asInt(json['newContacts']) ?? 0,
      unhandled: asInt(json['unhandled']) ?? 0,
      overdueActions: asInt(json['overdueActions']) ?? 0,
      pendingVisits: asInt(json['pendingVisits']) ?? 0,
      confirmedUpcomingVisits: asInt(json['confirmedUpcomingVisits']) ?? 0,
      completedVisits: asInt(json['completedVisits']) ?? 0,
      responseRate: asDouble(json['responseRate']),
      medianFirstResponseHours: asDouble(json['medianFirstResponseHours']),
      contactToVisitRate: asDouble(json['contactToVisitRate']),
      totalInquiries: asInt(totals?['inquiries']) ?? 0,
      responded: asInt(totals?['responded']) ?? 0,
      topListings: rawTop is List
          ? [for (final item in rawTop) ?_top(item)]
          : const [],
      computedAt:
          DateTime.tryParse(asNonEmptyString(json['computedAt']) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    );
  }

  static InquiryTopListing? _top(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final title = asNonEmptyString(json['title']);
    if (id == null || !PublicIds.isUuid(id) || title == null) {
      return null;
    }
    return InquiryTopListing(
      id: id,
      title: title,
      contacts: asInt(json['contacts']) ?? 0,
    );
  }
}
