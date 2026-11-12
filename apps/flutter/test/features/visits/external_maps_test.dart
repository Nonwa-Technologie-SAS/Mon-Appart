import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/visits/domain/external_maps.dart';

void main() {
  test('refuse des coordonnées invalides', () {
    expect(ExternalMaps.destination(latitude: 91, longitude: -4), isNull);
    expect(ExternalMaps.destination(latitude: 5.36, longitude: 200), isNull);
    expect(
      ExternalMaps.isAllowed(Uri.parse('https://evil.example/maps')),
      isFalse,
    );
    expect(ExternalMaps.isAllowed(Uri.parse('javascript:alert(1)')), isFalse);
  });

  test('construit une destination Google Maps sans adresse privée', () {
    final uri = ExternalMaps.destination(latitude: 5.36, longitude: -3.98)!;
    expect(uri.host, 'www.google.com');
    expect(uri.path, '/maps/dir/');
    expect(uri.queryParameters['destination'], '5.36000,-3.98000');
    expect(uri.queryParameters['travelmode'], 'driving');
    expect(ExternalMaps.isAllowed(uri), isTrue);
  });

  test('une tournée encode origine, destination et étapes', () {
    final uri = ExternalMaps.tour(const [
      (5.36, -3.98),
      (5.30, -4.00),
      (5.25, -3.90),
    ])!;
    expect(uri.queryParameters['origin'], '5.36000,-3.98000');
    expect(uri.queryParameters['destination'], '5.25000,-3.90000');
    expect(uri.queryParameters['waypoints'], '5.30000,-4.00000');
  });
}
