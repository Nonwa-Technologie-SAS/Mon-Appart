import 'package:flutter_test/flutter_test.dart';

import '../helpers/test_app.dart';

void main() {
  testWidgets('signale l\'absence de API_BASE_URL', (tester) async {
    await tester.pumpWidget(pumpMonAppart(config: testConfig(url: '')));
    await tester.pumpAndSettle();

    expect(find.text('Configuration API manquante'), findsOneWidget);
    expect(find.textContaining('API_BASE_URL'), findsWidgets);
  });
}
