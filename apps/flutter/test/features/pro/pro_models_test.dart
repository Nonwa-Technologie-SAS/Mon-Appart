import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/auth/auth_user.dart';
import 'package:mon_appart/core/listing/listing_status_labels.dart';
import 'package:mon_appart/core/listing/money_format.dart';
import 'package:mon_appart/features/pro/domain/inquiry.dart';
import 'package:mon_appart/features/pro/domain/inquiry_dashboard.dart';
import 'package:mon_appart/features/pro/domain/inquiry_labels.dart';
import 'package:mon_appart/features/pro/domain/listing_stats.dart';
import 'package:mon_appart/features/pro/domain/managed_listing.dart';

import '../../helpers/auth_fixtures.dart';
import '../../helpers/pro_fixtures.dart';

void main() {
  test('les rôles éditeur correspondent à Nest PUBLISHER_PERMISSIONS', () {
    final customer = AuthUser.fromJson(authUserJson());
    final owner = AuthUser.fromJson(authUserJson(roles: const ['OWNER']));
    final agency = AuthUser.fromJson(authUserJson(roles: const ['AGENCY']));
    expect(customer.isPublisher, isFalse);
    expect(owner.isPublisher, isTrue);
    expect(owner.publisherSpaceLabel, 'Espace propriétaire');
    expect(agency.publisherSpaceLabel, 'Espace agence');
  });

  test('parse une annonce gérée scope=mine (id / coverUrl / status)', () {
    final listing = ManagedListing.tryParse(managedListingJson());
    expect(listing, isNotNull);
    expect(listing!.id, testManagedListingId);
    expect(listing.status, 'DRAFT');
    expect(listing.coverUrl, 'https://cdn.example/cover.jpg');
    expect(listing.locationLabel, contains('Cocody'));
    expect(MoneyFormat.formatPrice(listing.price), contains('F CFA'));
    expect(ListingStatusLabels.of('PENDING_REVIEW'), 'En revue');
    expect(ListingManagerActions.canPublish('DRAFT'), isTrue);
    expect(ListingManagerActions.canPublish('PENDING_REVIEW'), isFalse);
    expect(ListingManagerActions.canMarkRented('PUBLISHED', 'SALE'), isFalse);
    expect(ListingManagerActions.canMarkSold('PUBLISHED', 'SALE'), isTrue);
  });

  test('ignore un identifiant d\'annonce gérée invalide', () {
    expect(
      ManagedListing.tryParse(managedListingJson(id: 'pas-un-uuid')),
      isNull,
    );
  });

  test('parse une demande CRM et refuse CONVERTED depuis NEW', () {
    final inquiry = Inquiry.parse(inquiryJson());
    expect(inquiry.prospect.displayName, 'Koffi Yao');
    expect(inquiry.listingTitle, contains('Cocody'));
    expect(InquiryLabels.stage('NEW'), 'Nouveau');
    expect(InquiryLabels.origin('VISIT'), 'Demande de visite');
    expect(InquiryStageRules.canTransition('NEW', 'CONTACTED'), isTrue);
    expect(InquiryStageRules.canTransition('NEW', 'CONVERTED'), isFalse);
  });

  test('un taux CRM nul s\'affiche comme indisponible, pas comme zéro', () {
    final dashboard = InquiryDashboard.parse(
      inquiryDashboardJson(responseRate: null, contactToVisitRate: null),
    );
    expect(dashboard.windowDays, 7);
    expect(ProPercent.format(dashboard.responseRate), '—');
    expect(ProPercent.format(0.4), '40 %');
  });

  test('parse les statistiques d\'audience sans inventer un taux', () {
    final page = ListingStatsPage.parse(
      listingStatsPageJson(contactRate: null),
    );
    expect(page.detailViews, 12);
    expect(page.items.single.appointmentRate, isNull);
    expect(ProPercent.format(page.items.single.contactRate), '—');
  });
}
