import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:image/image.dart' as img;
import '../models.dart';

abstract class FaceDetector {
  Future<FaceDetectionResult> detect(ui.Image image);
  Future<void> close();
}

abstract class FaceEmbedder {
  Future<FaceEmbedding?> extractEmbedding(ui.Image image, FaceDetectionResult detection);
  Future<void> close();
}

abstract class LivenessDetector {
  Future<LivenessStatus> evaluate(ui.Image image, FaceDetectionResult detection, LivenessChallenge challenge);
  Future<void> close();
}

class TFLiteFaceDetector implements FaceDetector {
  late Interpreter _interpreter;
  static const int _inputSize = 320;
  static const double _scoreThreshold = 0.5;
  static const double _iouThreshold = 0.5;

  TFLiteFaceDetector._(this._interpreter);

  static Future<TFLiteFaceDetector> create() async {
    final interpreter = await Interpreter.fromAsset('models/face_detection.tflite');
    return TFLiteFaceDetector._(interpreter);
  }

  @override
  Future<FaceDetectionResult> detect(ui.Image image) async {
    final input = _preprocessImage(image);
    final output = _runInference(input);
    return _postprocess(output, image.width, image.height);
  }

  Uint8List _preprocessImage(ui.Image image) {
    final img.Image resized = img.copyResize(
      img.Image.fromBytes(image.width, image.height, image.toByteData(format: ui.ImageByteFormat.rawRgba)!.buffer.asUint8List()),
      width: _inputSize,
      height: _inputSize,
    );
    
    final input = Uint8List(_inputSize * _inputSize * 3);
    final bytes = resized.getBytes(format: img.Format.rgb);
    for (int i = 0; i < bytes.length; i++) {
      input[i] = bytes[i];
    }
    return input;
  }

  List<dynamic> _runInference(Uint8List input) {
    var output = [
      List.filled(1 * 896 * 16, 0.0), // boxes
      List.filled(1 * 896, 0.0),       // scores
    ];
    _interpreter.run(input, output);
    return output;
  }

  FaceDetectionResult _postprocess(List<dynamic> output, int origWidth, int origHeight) {
    final boxes = output[0] as List<double>;
    final scores = output[1] as List<double>;

    double bestScore = 0;
    int bestIdx = -1;

    for (int i = 0; i < scores.length; i++) {
      if (scores[i] > bestScore && scores[i] > _scoreThreshold) {
        bestScore = scores[i];
        bestIdx = i;
      }
    }

    if (bestIdx == -1) {
      return FaceDetectionResult(
        faceDetected: false,
        landmarks: [],
        boundingBox: Rect(0, 0, 0, 0),
        confidence: 0,
      );
    }

    final box = [
      boxes[bestIdx * 16 + 0],
      boxes[bestIdx * 16 + 1],
      boxes[bestIdx * 16 + 2],
      boxes[bestIdx * 16 + 3],
    ];

    final left = (box[1] * origWidth).round();
    final top = (box[0] * origHeight).round();
    final right = (box[3] * origWidth).round();
    final bottom = (box[2] * origHeight).round();

    return FaceDetectionResult(
      faceDetected: true,
      landmarks: _generateLandmarks(left, top, right, bottom),
      boundingBox: Rect(left.toDouble(), top.toDouble(), right.toDouble(), bottom.toDouble()),
      confidence: bestScore,
    );
  }

  List<Point<double>> _generateLandmarks(int left, int top, int right, int bottom) {
    final cx = (left + right) / 2.0;
    final cy = (top + bottom) / 2.0;
    final w = right - left;
    final h = bottom - top;
    
    return [
      Point(cx - w * 0.15, cy - h * 0.1),  // left eye
      Point(cx + w * 0.15, cy - h * 0.1),  // right eye
      Point(cx, cy + h * 0.05),            // nose
      Point(cx - w * 0.1, cy + h * 0.15),  // left mouth
      Point(cx + w * 0.1, cy + h * 0.15),  // right mouth
    ];
  }

  @override
  Future<void> close() async {
    await _interpreter.close();
  }
}

class TFLiteFaceEmbedder implements FaceEmbedder {
  late Interpreter _interpreter;
  static const int _embeddingSize = 512;
  static const int _inputSize = 112;

  TFLiteFaceEmbedder._(this._interpreter);

  static Future<TFLiteFaceEmbedder> create() async {
    final interpreter = await Interpreter.fromAsset('models/face_embedding.tflite');
    return TFLiteFaceEmbedder._(interpreter);
  }

  @override
  Future<FaceEmbedding?> extractEmbedding(ui.Image image, FaceDetectionResult detection) async {
    if (!detection.faceDetected) return null;

    final aligned = _alignAndCrop(image, detection);
    if (aligned == null) return null;

    final input = _preprocess(aligned);
    final output = _runInference(input);
    final embedding = _normalize(output);

    return FaceEmbedding(
      embedding: embedding,
      enrolledAt: DateTime.now(),
      userId: 'user',
    );
  }

  ui.Image? _alignAndCrop(ui.Image image, FaceDetectionResult detection) {
    final landmarks = detection.landmarks;
    if (landmarks.length < 5) return null;

    final leftEye = landmarks[0];
    final rightEye = landmarks[1];
    
    final dx = rightEye.x - leftEye.x;
    final dy = rightEye.y - leftEye.y;
    final angle = atan2(dy, dx) * 180 / pi;

    // Would need image rotation here - simplified
    final box = detection.boundingBox;
    return image; // Simplified - would need actual alignment
  }

  Float32List _preprocess(ui.Image image) {
    final resized = img.copyResize(
      img.Image.fromBytes(image.width, image.height, image.toByteData(format: ui.ImageByteFormat.rawRgba)!.buffer.asUint8List()),
      width: _inputSize,
      height: _inputSize,
    );
    
    final input = Float32List(_inputSize * _inputSize * 3);
    final bytes = resized.getBytes(format: img.Format.rgb);
    for (int i = 0; i < bytes.length; i++) {
      input[i] = (bytes[i] / 255.0 - 0.5) / 0.5; // Normalize to [-1, 1]
    }
    return input;
  }

  Float32List _runInference(Float32List input) {
    var output = [Float32List(_embeddingSize)];
    _interpreter.run(input, output);
    return output[0];
  }

  List<double> _normalize(Float32List embedding) {
    final norm = sqrt(embedding.map((v) => v * v).reduce((a, b) => a + b));
    return embedding.map((v) => v / norm).toList();
  }

  @override
  Future<void> close() async {
    await _interpreter.close();
  }
}

class MediaPipeLivenessDetector implements LivenessDetector {
  final Map<LivenessChallengeType, double> _thresholds = {
    LivenessChallengeType.blink: 0.3,
    LivenessChallengeType.lookLeft: 0.4,
    LivenessChallengeType.lookRight: 0.4,
    LivenessChallengeType.lookUp: 0.35,
    LivenessChallengeType.lookDown: 0.35,
    LivenessChallengeType.smile: 0.3,
  };

  @override
  Future<LivenessStatus> evaluate(
    ui.Image image, 
    FaceDetectionResult detection, 
    LivenessChallenge challenge,
  ) async {
    if (!detection.faceDetected || detection.landmarks.length < 5) {
      return LivenessStatus.failed('No face detected');
    }

    final score = _evaluateChallenge(detection, challenge.type);
    final passed = score >= (_thresholds[challenge.type] ?? 0.3);

    if (passed) {
      return LivenessStatus.passed();
    } else {
      return LivenessStatus.failed('Challenge failed: ${_getFailureReason(challenge.type, score)}');
    }
  }

  double _evaluateChallenge(FaceDetectionResult detection, LivenessChallengeType type) {
    final landmarks = detection.landmarks;
    if (landmarks.length < 5) return 0.0;

    final leftEye = landmarks[0];
    final rightEye = landmarks[1];
    final nose = landmarks[2];
    final leftMouth = landmarks[3];
    final rightMouth = landmarks[4];

    switch (type) {
      case LivenessChallengeType.blink:
        return _calculateEyeAspectRatio(leftEye, rightEye, landmarks);
      case LivenessChallengeType.lookLeft:
        return _calculateGazeRatio(leftEye, rightEye, nose, -1);
      case LivenessChallengeType.lookRight:
        return _calculateGazeRatio(leftEye, rightEye, nose, 1);
      case LivenessChallengeType.lookUp:
        return _calculateVerticalGaze(leftEye, rightEye, nose, -1);
      case LivenessChallengeType.lookDown:
        return _calculateVerticalGaze(leftEye, rightEye, nose, 1);
      case LivenessChallengeType.smile:
        return _calculateSmileRatio(leftMouth, rightMouth, leftEye, rightEye);
    }
  }

  double _calculateEyeAspectRatio(Point leftEye, Point rightEye, List<Point> landmarks) {
    // Simplified EAR calculation
    final eyeWidth = (rightEye.x - leftEye.x).abs();
    final eyeHeight = 20.0; // Simplified
    return eyeHeight / eyeWidth;
  }

  double _calculateGazeRatio(Point leftEye, Point rightEye, Point nose, int direction) {
    final eyeCenter = Point((leftEye.x + rightEye.x) / 2, (leftEye.y + rightEye.y) / 2);
    final noseOffset = (nose.x - eyeCenter.x) * direction;
    final eyeDistance = (rightEye.x - leftEye.x).abs();
    return (noseOffset / eyeDistance).clamp(0.0, 1.0);
  }

  double _calculateVerticalGaze(Point leftEye, Point rightEye, Point nose, int direction) {
    final eyeCenter = Point((leftEye.x + rightEye.x) / 2, (leftEye.y + rightEye.y) / 2);
    final noseOffset = (nose.y - eyeCenter.y) * direction;
    final eyeDistance = (rightEye.x - leftEye.x).abs();
    return (noseOffset / eyeDistance).clamp(0.0, 1.0);
  }

  double _calculateSmileRatio(Point leftMouth, Point rightMouth, Point leftEye, Point rightEye) {
    final mouthWidth = (rightMouth.x - leftMouth.x).abs();
    final eyeDistance = (rightEye.x - leftEye.x).abs();
    final mouthHeight = (leftMouth.y + rightMouth.y) / 2 - (leftEye.y + rightEye.y) / 2;
    return (mouthWidth / eyeDistance - mouthHeight / eyeDistance).clamp(0.0, 1.0);
  }

  String _getFailureReason(LivenessChallengeType type, double score) {
    return 'Score ${(score * 100).toInt()}% below threshold';
  }

  @override
  Future<void> close() async {}
}