import 'package:image_picker/image_picker.dart';

class PickedPublishFile {
  const PickedPublishFile({
    required this.localId,
    required this.bytes,
    required this.size,
    this.filename,
    this.path,
  });

  final String localId;
  final List<int> bytes;
  final int size;
  final String? filename;
  final String? path;
}

abstract class PublishImagePicker {
  Future<List<PickedPublishFile>> pickGallery();

  Future<PickedPublishFile?> pickCamera();
}

class DevicePublishImagePicker implements PublishImagePicker {
  DevicePublishImagePicker({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<List<PickedPublishFile>> pickGallery() async {
    final files = await _picker.pickMultiImage(
      maxWidth: 1920,
      imageQuality: 85,
    );
    final result = <PickedPublishFile>[];
    for (var i = 0; i < files.length; i++) {
      final file = files[i];
      final bytes = await file.readAsBytes();
      result.add(
        PickedPublishFile(
          localId: '${DateTime.now().microsecondsSinceEpoch}-$i',
          bytes: bytes,
          size: bytes.length,
          filename: file.name,
          path: file.path,
        ),
      );
    }
    return result;
  }

  @override
  Future<PickedPublishFile?> pickCamera() async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920,
      imageQuality: 85,
    );
    if (file == null) {
      return null;
    }
    final bytes = await file.readAsBytes();
    return PickedPublishFile(
      localId: '${DateTime.now().microsecondsSinceEpoch}-cam',
      bytes: bytes,
      size: bytes.length,
      filename: file.name,
      path: file.path,
    );
  }
}

class FakePublishImagePicker implements PublishImagePicker {
  FakePublishImagePicker({this.gallery = const [], this.camera});

  final List<PickedPublishFile> gallery;
  final PickedPublishFile? camera;

  @override
  Future<List<PickedPublishFile>> pickGallery() async => gallery;

  @override
  Future<PickedPublishFile?> pickCamera() async => camera;
}
