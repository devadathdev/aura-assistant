import 'dart:async';
import 'dart:ui' as ui;
import 'package:camera/camera.dart';
import '../models.dart';

class CameraService {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _isInitialized = false;
  StreamController<CameraFrame>? _frameController;

  CameraDescription? get frontCamera => _cameras.firstWhere(
    (c) => c.lensDirection == CameraLensDirection.front,
    orElse: () => _cameras.first,
  );

  bool get isInitialized => _isInitialized;
  CameraController? get controller => _controller;
  Stream<CameraFrame> get frameStream => _frameController?.stream ?? const Stream.empty();

  Future<void> initialize() async {
    _cameras = await availableCameras();
    if (_cameras.isEmpty) {
      throw Exception('No cameras available');
    }

    final frontCam = frontCamera!;
    _controller = CameraController(
      frontCam,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.yuv420,
    );

    await _controller!.initialize();
    _isInitialized = true;

    _frameController = StreamController<CameraFrame>.broadcast();
    _startFrameStream();
  }

  void _startFrameStream() {
    if (_controller == null || !_controller!.value.isInitialized) return;

    _controller!.startImageStream((CameraImage image) {
      _frameController?.add(CameraFrame(
        image: image,
        timestamp: DateTime.now(),
        width: image.width,
        height: image.height,
      ));
    });
  }

  Future<ui.Image?> captureFrame() async {
    if (_controller == null || !_controller!.value.isInitialized) return null;

    try {
      final XFile file = await _controller!.takePicture();
      final bytes = await file.readAsBytes();
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      return frame.image;
    } catch (e) {
      return null;
    }
  }

  Future<void> setFlashMode(FlashMode mode) async {
    await _controller?.setFlashMode(mode);
  }

  Future<void> setZoomLevel(double zoom) async {
    await _controller?.setZoomLevel(zoom);
  }

  double get maxZoomLevel => _controller?.value.maxZoomLevel ?? 1.0;
  double get minZoomLevel => _controller?.value.minZoomLevel ?? 1.0;

  void pausePreview() {
    _controller?.pausePreview();
  }

  void resumePreview() {
    _controller?.resumePreview();
  }

  Future<void> dispose() async {
    await _controller?.stopImageStream();
    await _controller?.dispose();
    await _frameController?.close();
    _isInitialized = false;
  }
}

class CameraFrame {
  final CameraImage image;
  final DateTime timestamp;
  final int width;
  final int height;

  CameraFrame({
    required this.image,
    required this.timestamp,
    required this.width,
    required this.height,
  });
}

extension CameraImageExtension on CameraImage {
  ui.Image toUiImage() {
    // Convert YUV420 to RGBA
    // This is a simplified version - actual implementation needs proper conversion
    return ui.Image.raw(
      width: width,
      height: height,
      bytes: planes.first.bytes,
      format: ui.ImageByteFormat.rawRgba,
    );
  }
}