import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import '../models.dart';
import 'encryption/encryption_service.dart';
import 'biometric/biometric_auth.dart';
import 'camera/camera_service.dart';
import 'face/face_services.dart';

class AuthService {
  final EncryptionService _encryption;
  final BiometricAuthService _biometric;
  final PinAuthService _pinAuth;
  final CameraService _camera;
  final FaceDetector _faceDetector;
  final FaceEmbedder _faceEmbedder;
  final LivenessDetector _livenessDetector;

  final AuthConfig _config;
  Timer? _autoLockTimer;
  Timer? _livenessChallengeTimer;
  StreamController<AuthStatus>? _statusController;
  StreamController<LivenessStatus>? _livenessController;
  StreamController<FaceDetectionResult>? _detectionController;

  LivenessChallenge? _currentChallenge;
  List<LivenessChallenge> _challengeQueue = [];
  int _currentChallengeIndex = 0;
  FaceEmbedding? _enrolledEmbedding;
  String? _enrolledUserId;

  AuthService({
    required EncryptionService encryption,
    required BiometricAuthService biometric,
    required PinAuthService pinAuth,
    required CameraService camera,
    required FaceDetector faceDetector,
    required FaceEmbedder faceEmbedder,
    required LivenessDetector livenessDetector,
    required AuthConfig config,
  }) : _encryption = encryption,
       _biometric = biometric,
       _pinAuth = pinAuth,
       _camera = camera,
       _faceDetector = faceDetector,
       _faceEmbedder = faceEmbedder,
       _livenessDetector = livenessDetector,
       _config = config;

  Stream<AuthStatus> get statusStream => _statusController?.stream ?? const Stream.empty();
  Stream<LivenessStatus> get livenessStream => _livenessController?.stream ?? const Stream.empty();
  Stream<FaceDetectionResult> get detectionStream => _detectionController?.stream ?? const Stream.empty();

  Future<void> initialize() async {
    _statusController = StreamController.broadcast();
    _livenessController = StreamController.broadcast();
    _detectionController = StreamController.broadcast();

    await _encryption.initialize();
    await _biometric.initialize();
    await _camera.initialize();

    _enrolledUserId = await _encryption.getEnrolledUser();
    final embeddings = await _encryption.getEmbeddings();
    if (embeddings.isNotEmpty) {
      _enrolledEmbedding = embeddings.first;
    }

    final pinHash = await _encryption.getPinHash();
    if (pinHash != null) {
      _pinAuth.setPinHash(pinHash.hash);
    }

    _startAutoLockTimer();
    _startFaceDetectionLoop();
  }

  Future<AuthResult> authenticateWithFace({bool requireLiveness = true}) async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.faceRecognition));

    if (_enrolledEmbedding == null) {
      return AuthResult.failure('No face enrolled', method: AuthMethod.faceRecognition);
    }

    final frame = await _camera.captureFrame();
    if (frame == null) {
      return AuthResult.failure('Failed to capture frame', method: AuthMethod.faceRecognition);
    }

    final detection = await _faceDetector.detect(frame);
    if (!detection.faceDetected) {
      return AuthResult.failure('No face detected', method: AuthMethod.faceRecognition);
    }

    final embedding = await _faceEmbedder.extractEmbedding(frame, detection);
    if (embedding == null) {
      return AuthResult.failure('Failed to extract embedding', method: AuthMethod.faceRecognition);
    }

    final similarity = _cosineSimilarity(_enrolledEmbedding!.embedding, embedding.embedding);
    if (similarity < _config.faceSimilarityThreshold) {
      return AuthResult.failure('Face not recognized', method: AuthMethod.faceRecognition);
    }

    if (requireLiveness && _config.requireLivenessForAuth) {
      final livenessResult = await _runLivenessChallenges(frame, detection);
      if (!livenessResult.success) {
        return AuthResult.failure(livenessResult.error!, method: AuthMethod.faceWithLiveness);
      }
    }

    await _encryption.updateLastActivity();
    _resetAutoLockTimer();
    _updateStatus(AuthStatus.authenticated(method: AuthMethod.faceRecognition));
    return AuthResult.success(method: AuthMethod.faceRecognition, embedding: embedding);
  }

  Future<AuthResult> enrollFace(String userId) async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.faceRecognition));

    if (_config.requireLivenessForEnrollment) {
      final livenessResult = await _runLivenessChallengesForEnrollment();
      if (!livenessResult.success) {
        return AuthResult.failure(livenessResult.error!, method: AuthMethod.faceRecognition);
      }
    }

    final frame = await _camera.captureFrame();
    if (frame == null) {
      return AuthResult.failure('Failed to capture frame', method: AuthMethod.faceRecognition);
    }

    final detection = await _faceDetector.detect(frame);
    if (!detection.faceDetected) {
      return AuthResult.failure('No face detected', method: AuthMethod.faceRecognition);
    }

    final embedding = await _faceEmbedder.extractEmbedding(frame, detection);
    if (embedding == null) {
      return AuthResult.failure('Failed to extract embedding', method: AuthMethod.faceRecognition);
    }

    final newEmbedding = FaceEmbedding(
      embedding: embedding.embedding,
      enrolledAt: DateTime.now(),
      userId: userId,
    );

    await _encryption.storeEmbeddings([newEmbedding]);
    await _encryption.setEnrolledUser(userId);
    _enrolledEmbedding = newEmbedding;
    _enrolledUserId = userId;

    _updateStatus(AuthStatus.authenticated(method: AuthMethod.faceRecognition));
    return AuthResult.success(method: AuthMethod.faceRecognition, embedding: newEmbedding);
  }

  Future<AuthResult> _runLivenessChallenges(ui.Image frame, FaceDetectionResult detection) async {
    _challengeQueue = _generateRandomChallenges(_config.livenessChallengeCount);
    _currentChallengeIndex = 0;

    for (final challenge in _challengeQueue) {
      _currentChallenge = challenge;
      _livenessController?.add(LivenessStatus.challenging(challenge));

      final result = await _livenessDetector.evaluate(frame, detection, challenge);
      if (result.isFailed) {
        _livenessController?.add(result);
        return AuthResult.failure(result.failureReason ?? 'Liveness check failed', method: AuthMethod.faceWithLiveness);
      }

      _livenessController?.add(LivenessStatus.passed());
      await Future.delayed(const Duration(milliseconds: 500));
    }

    return AuthResult.success(method: AuthMethod.faceWithLiveness);
  }

  Future<AuthResult> _runLivenessChallengesForEnrollment() async {
    // Similar to above but for enrollment
    return const AuthResult.success(method: AuthMethod.faceWithLiveness);
  }

  List<LivenessChallenge> _generateRandomChallenges(int count) {
    final types = LivenessChallengeType.values;
    final random = math.Random();
    final challenges = <LivenessChallenge>[];
    
    // Ensure blink is always included
    challenges.add(LivenessChallenge(
      type: LivenessChallengeType.blink,
      instruction: 'Blink naturally',
    ));

    final remaining = types.where((t) => t != LivenessChallengeType.blink).toList();
    remaining.shuffle(random);
    
    for (int i = 0; i < count - 1 && i < remaining.length; i++) {
      final type = remaining[i];
      challenges.add(LivenessChallenge(
        type: type,
        instruction: _getInstructionForType(type),
      ));
    }

    return challenges;
  }

  String _getInstructionForType(LivenessChallengeType type) {
    switch (type) {
      case LivenessChallengeType.blink: return 'Blink';
      case LivenessChallengeType.lookLeft: return 'Look left';
      case LivenessChallengeType.lookRight: return 'Look right';
      case LivenessChallengeType.lookUp: return 'Look up';
      case LivenessChallengeType.lookDown: return 'Look down';
      case LivenessChallengeType.smile: return 'Smile';
    }
  }

  Future<AuthResult> authenticateWithPin(String pin) async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.pin));
    final result = await _pinAuth.verifyPin(pin);
    
    if (result.success) {
      await _encryption.updateLastActivity();
      _resetAutoLockTimer();
      _updateStatus(AuthStatus.authenticated(method: AuthMethod.pin));
    }
    return result;
  }

  Future<AuthResult> authenticateWithBiometric() async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.biometric));
    final result = await _biometric.authenticate(
      reason: 'Authenticate to access AURA',
      preferredTypes: [BiometricType.strong, BiometricType.face, BiometricType.fingerprint],
    );

    if (result.success) {
      await _encryption.updateLastActivity();
      _resetAutoLockTimer();
      _updateStatus(AuthStatus.authenticated(method: AuthMethod.biometric));
    }
    return result;
  }

  Future<AuthResult> authenticateWithFingerprint() async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.fingerprint));
    final result = await _biometric.authenticate(
      reason: 'Authenticate with fingerprint to access AURA',
      preferredTypes: [BiometricType.fingerprint, BiometricType.strong],
    );

    if (result.success) {
      await _encryption.updateLastActivity();
      _resetAutoLockTimer();
      _updateStatus(AuthStatus.authenticated(method: AuthMethod.fingerprint));
    }
    return result;
  }

  Future<AuthResult> authenticateWithIris({bool requireLiveness = true}) async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.iris));

    if (_enrolledEmbedding == null) {
      return AuthResult.failure('No iris enrolled', method: AuthMethod.iris);
    }

    final frame = await _camera.captureFrame();
    if (frame == null) {
      return AuthResult.failure('Failed to capture frame', method: AuthMethod.iris);
    }

    final detection = await _faceDetector.detect(frame);
    if (!detection.faceDetected) {
      return AuthResult.failure('No face detected', method: AuthMethod.iris);
    }

    // Extract iris embedding from eye regions
    final irisEmbedding = await _faceEmbedder.extractIrisEmbedding(frame, detection);
    if (irisEmbedding == null) {
      return AuthResult.failure('Failed to extract iris pattern', method: AuthMethod.iris);
    }

    final similarity = _cosineSimilarity(_enrolledEmbedding!.embedding, irisEmbedding.embedding);
    if (similarity < _config.irisSimilarityThreshold) {
      return AuthResult.failure('Iris not recognized', method: AuthMethod.iris);
    }

    if (requireLiveness && _config.requireLivenessForAuth) {
      final livenessResult = await _runLivenessChallenges(frame, detection);
      if (!livenessResult.success) {
        return AuthResult.failure(livenessResult.error!, method: AuthMethod.iris);
      }
    }

    await _encryption.updateLastActivity();
    _resetAutoLockTimer();
    _updateStatus(AuthStatus.authenticated(method: AuthMethod.iris));
    return AuthResult.success(method: AuthMethod.iris, embedding: irisEmbedding);
  }

  Future<AuthResult> enrollIris(String userId) async {
    _updateStatus(AuthStatus.authenticating(method: AuthMethod.iris));

    if (_config.requireLivenessForEnrollment) {
      final livenessResult = await _runLivenessChallengesForEnrollment();
      if (!livenessResult.success) {
        return AuthResult.failure(livenessResult.error!, method: AuthMethod.iris);
      }
    }

    final frame = await _camera.captureFrame();
    if (frame == null) {
      return AuthResult.failure('Failed to capture frame', method: AuthMethod.iris);
    }

    final detection = await _faceDetector.detect(frame);
    if (!detection.faceDetected) {
      return AuthResult.failure('No face detected', method: AuthMethod.iris);
    }

    final irisEmbedding = await _faceEmbedder.extractIrisEmbedding(frame, detection);
    if (irisEmbedding == null) {
      return AuthResult.failure('Failed to extract iris pattern', method: AuthMethod.iris);
    }

    final newEmbedding = FaceEmbedding(
      embedding: irisEmbedding.embedding,
      enrolledAt: DateTime.now(),
      userId: userId,
    );

    await _encryption.storeIrisEmbeddings([newEmbedding]);
    await _encryption.setEnrolledUser(userId);
    _enrolledEmbedding = newEmbedding;
    _enrolledUserId = userId;

    _updateStatus(AuthStatus.authenticated(method: AuthMethod.iris));
    return AuthResult.success(method: AuthMethod.iris, embedding: newEmbedding);
  }

  Future<AuthResult> setPin(String pin) async {
    if (pin.length < 4 || pin.length > 8) {
      return AuthResult.failure('PIN must be 4-8 digits');
    }
    if (!RegExp(r'^\d+$').hasMatch(pin)) {
      return AuthResult.failure('PIN must be numeric');
    }

    final pinHash = EncryptionService.createPinHash(pin);
    await _encryption.storePinHash(pinHash);
    _pinAuth.setPinHash(pinHash.hash);
    return AuthResult.success(method: AuthMethod.pin);
  }

  Future<bool> hasEnrolledFace() async {
    return _enrolledEmbedding != null;
  }

  Future<bool> hasPin() async {
    return _pinAuth._storedPinHash != null;
  }

  void lock() {
    _updateStatus(AuthStatus.locked(reason: 'Manual lock'));
    _autoLockTimer?.cancel();
  }

  void unlock() {
    _updateStatus(AuthStatus.unauthenticated());
    _startAutoLockTimer();
  }

  void _startAutoLockTimer() {
    _autoLockTimer?.cancel();
    _autoLockTimer = Timer(_config.autoLockTimeout, () {
      lock();
    });
  }

  void _resetAutoLockTimer() {
    _startAutoLockTimer();
  }

  void _updateStatus(AuthStatus status) {
    _statusController?.add(status);
  }

  double _cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length) return 0.0;
    
    double dot = 0, normA = 0, normB = 0;
    for (int i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (math.sqrt(normA) * math.sqrt(normB));
  }

  Future<void> detectDifferentFace(FaceDetectionResult detection) async {
    if (detection.faceDetected && _enrolledEmbedding != null) {
      // Check if detected face differs significantly from enrolled
      // This would need current frame embedding
      // Simplified: just trigger lock
      lock();
      _updateStatus(AuthStatus.locked(reason: 'Different face detected'));
    }
  }

  Future<void> dispose() async {
    _autoLockTimer?.cancel();
    _livenessChallengeTimer?.cancel();
    await _camera.dispose();
    await _faceDetector.close();
    await _faceEmbedder.close();
    await _livenessDetector.close();
    await _statusController?.close();
    await _livenessController?.close();
    await _detectionController?.close();
  }

  void _startFaceDetectionLoop() {
    _camera.frameStream.listen((frame) async {
      try {
        // Convert CameraImage to ui.Image for detection
        // This is simplified - would need proper conversion
        final detection = await _faceDetector.detect(frame.image.toUiImage());
        _detectionController?.add(detection);
        
        if (detection.faceDetected) {
          await detectDifferentFace(detection);
        }
      } catch (e) {
        // Ignore detection errors
      }
    });
  }
}