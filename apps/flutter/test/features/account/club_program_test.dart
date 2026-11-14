import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/account/domain/club_program.dart';

void main() {
  test('le Club n\'est pas ouvert et ne fabrique pas de code', () {
    expect(ClubProgram.launched, isFalse);
    expect(ClubProgram.introductionShareText(null), isNull);
    expect(ClubProgram.introductionShareText('  '), isNull);
    final text = ClubProgram.introductionShareText('WWW.Example.TEST');
    expect(text, contains('https://www.example.test'));
    expect(text, contains('aucune récompense'));
    expect(text!.toLowerCase().contains('code='), isFalse);
    expect(text.toLowerCase().contains('parrain='), isFalse);
  });
}
