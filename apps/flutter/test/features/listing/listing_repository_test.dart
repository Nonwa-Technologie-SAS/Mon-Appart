import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/listing/data/listing_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('refuse un identifiant qui n\'est pas un UUID', () async {
    final repo = ListingRepository(
      client: FakeApiClient(handler: (uri) async => listingDetailJson()),
      endpoints: endpoints,
    );
    await expectLater(
      repo.getById('pas-un-uuid'),
      throwsA(isA<InvalidListingIdFailure>()),
    );
  });

  test('traduit un 404 Nest en annonce indisponible', () async {
    final repo = ListingRepository(
      client: FakeApiClient(
        handler: (_) async =>
            throw const HttpFailure(message: 'absent', statusCode: 404),
      ),
      endpoints: endpoints,
    );
    await expectLater(
      repo.getById('11111111-1111-1111-1111-111111111111'),
      throwsA(isA<ListingUnavailableFailure>()),
    );
  });

  test('charge la fiche GET /listings/:id', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        expect(
          uri.path,
          '/api/v1/listings/11111111-1111-1111-1111-111111111111',
        );
        return listingDetailJson();
      },
    );
    final repo = ListingRepository(client: client, endpoints: endpoints);
    final listing = await repo.getById('11111111-1111-1111-1111-111111111111');
    expect(listing.title, startsWith('Appartement'));
  });
}
