import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/theme/app_theme.dart';
import 'package:mon_appart/core/listing/listing_summary.dart';
import 'package:mon_appart/core/widgets/property_card.dart';

import '../helpers/listing_fixtures.dart';

void main() {
  testWidgets('affiche prix, type et localisation', (tester) async {
    final listing = ListingSummary.fromJson(listingJson());
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(children: [PropertyCard(listing: listing)]),
        ),
      ),
    );

    expect(find.textContaining('F CFA'), findsOneWidget);
    expect(find.text('À louer'), findsOneWidget);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
    expect(find.textContaining('Cocody'), findsWidgets);
  });

  testWidgets('affiche Prix sur demande si le prix est absent', (tester) async {
    final listing = ListingSummary.fromJson(listingJson(price: null));
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(children: [PropertyCard(listing: listing)]),
        ),
      ),
    );
    expect(find.text('Prix sur demande'), findsOneWidget);
  });
}
