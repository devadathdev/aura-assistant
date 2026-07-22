enum AuthStatus {
  initial,
  unauthenticated,
  authenticating,
  authenticated,
  locked,
  failed,
}

enum AuthMethod {
  faceRecognition,
  faceWithLiveness,
  pin,
  biometric,
}

enum FaceEnrollmentStatus {
  idle,
  capturing,
  completed,
  failed,
}

enum LivenessStatus {
  idle,
  challenging,
  passed,
  failed,
}

enum LivenessChallengeType {
  blink,
  lookLeft,
  lookRight,
  lookUp,
  lookDown,
  smile,
}

class LivenessChallenge {
  final LivenessChallengeType type;
  final String instruction;
  final double progress;
  final Duration timeout;

  const LivenessChallenge({
    required this.type,
    required this.instruction,
    this.progress = 0.0,
    this.timeout = const Duration(seconds: 5),
  });

  LivenessChallenge copyWith({
    LivenessChallengeType? type,
    String? instruction,
    double? progress,
    Duration? timeout,
  }) {
    return LivenessChallenge(
      type: type ?? this.type,
      instruction: instruction ?? this.instruction,
      progress: progress ?? this.progress,
      timeout: timeout ?? this.timeout,
    );
  }
}

class LivenessStatus {
  final LivenessStatus status;
  final LivenessChallenge? challenge;
  final String? failureReason;

  const LivenessStatus._(this.status, {this.challenge, this.failureReason});

  const factory LivenessStatus.idle() = _LivenessIdle;
  const factory LivenessStatus.challenging(LivenessChallenge challenge) = _LivenessChallenging;
  const factory LivenessStatus.passed() = _LivenessPassed;
  const factory LivenessStatus.failed(String reason) = _LivenessFailed;

  bool get isIdle => this is _LivenessIdle;
  bool get isChallenging => this is _LivenessChallenging;
  bool get isPassed => this is _LivenessPassed;
  bool get isFailed => this is _LivenessFailed;

  LivenessChallenge? get challenge => this is _LivenessChallenging ? challenge : null;
  String? get failureReason => this is _LivenessFailed ? failureReason : null;
}

class _LivenessIdle extends LivenessStatus {
  const _LivenessIdle() : super._(LivenessStatus.idle);
}

class _LivenessChallenging extends LivenessStatus {
  final LivenessChallenge challenge;
  const _LivenessChallenging(this.challenge) : super._(LivenessStatus.challenging, challenge: challenge);
}

class _LivenessPassed extends LivenessStatus {
  const _LivenessPassed() : super._(LivenessStatus.passed);
}

class _LivenessFailed extends LivenessStatus {
  final String failureReason;
  const _LivenessFailed(this.failureReason) : super._(LivenessStatus.failed, failureReason: failureReason);
}

class AuthStatus {
  final AuthStatus status;
  final AuthMethod? method;
  final String? errorMessage;
  final DateTime? timestamp;

  const AuthStatus._(this.status, {this.method, this.errorMessage, this.timestamp});

  const factory AuthStatus.initial() = _AuthInitial;
  const factory AuthStatus.unauthenticated() = _AuthUnauthenticated;
  const factory AuthStatus.authenticating({AuthMethod? method}) = _AuthAuthenticating;
  const factory AuthStatus.authenticated({required AuthMethod method}) = _AuthAuthenticated;
  const factory AuthStatus.locked({String? reason}) = _AuthLocked;
  const factory AuthStatus.failed(String error) = _AuthFailed;

  bool get isAuthenticated => this is _AuthAuthenticated;
  bool get isLocked => this is _AuthLocked;
  bool get isAuthenticating => this is _AuthAuthenticating;
}

class _AuthInitial extends AuthStatus {
  const _AuthInitial() : super._(AuthStatus.initial);
}

class _AuthUnauthenticated extends AuthStatus {
  const _AuthUnauthenticated() : super._(AuthStatus.unauthenticated);
}

class _AuthAuthenticating extends AuthStatus {
  final AuthMethod? method;
  const _AuthAuthenticating({this.method}) : super._(AuthStatus.authenticating, method: method);
}

class _AuthAuthenticated extends AuthStatus {
  final AuthMethod method;
  final DateTime timestamp;
  const _AuthAuthenticated({required this.method, DateTime? timestamp})
      : super._(AuthStatus.authenticated, method: method, timestamp: timestamp ?? DateTime.now());
}

class _AuthLocked extends AuthStatus {
  final String? reason;
  const _AuthLocked({this.reason}) : super._(AuthStatus.locked, errorMessage: reason);
}

class _AuthFailed extends AuthStatus {
  final String errorMessage;
  const _AuthFailed(this.errorMessage) : super._(AuthStatus.failed, errorMessage: errorMessage);
}

class FaceEmbedding {
  final List<double> embedding;
  final DateTime enrolledAt;
  final String userId;
  final int version;

  const FaceEmbedding({
    required this.embedding,
    required this.enrolledAt,
    required this.userId,
    this.version = 1,
  });

  Map<String, dynamic> toJson() => {
    'embedding': embedding,
    'enrolledAt': enrolledAt.toIso8601String(),
    'userId': userId,
    'version': version,
  };

  factory FaceEmbedding.fromJson(Map<String, dynamic> json) => FaceEmbedding(
    embedding: List<double>.from(json['embedding']),
    enrolledAt: DateTime.parse(json['enrolledAt']),
    userId: json['userId'],
    version: json['version'] ?? 1,
  );
}

class PinHash {
  final String hash;
  final String salt;
  final int iterations;
  final DateTime createdAt;

  const PinHash({
    required this.hash,
    required this.salt,
    required this.iterations,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
    'hash': hash,
    'salt': salt,
    'iterations': iterations,
    'createdAt': createdAt.toIso8601String(),
  };

  factory PinHash.fromJson(Map<String, dynamic> json) => PinHash(
    hash: json['hash'],
    salt: json['salt'],
    iterations: json['iterations'],
    createdAt: DateTime.parse(json['createdAt']),
  );
}

class AuthConfig {
  final int maxFaceEnrollmentAttempts;
  final int livenessChallengeCount;
  final Duration livenessChallengeTimeout;
  final double faceSimilarityThreshold;
  final Duration autoLockTimeout;
  final int maxPinAttempts;
  final Duration pinLockoutDuration;
  final bool requireLivenessForEnrollment;
  final bool requireLivenessForAuth;

  const AuthConfig({
    this.maxFaceEnrollmentAttempts = 3,
    this.livenessChallengeCount = 3,
    this.livenessChallengeTimeout = const Duration(seconds: 5),
    this.faceSimilarityThreshold = 0.75,
    this.autoLockTimeout = const Duration(minutes: 5),
    this.maxPinAttempts = 5,
    this.pinLockoutDuration = const Duration(minutes: 15),
    this.requireLivenessForEnrollment = true,
    this.requireLivenessForAuth = true,
  });
}

class AuthResult {
  final bool success;
  final AuthMethod? method;
  final String? error;
  final FaceEmbedding? embedding;
  final DateTime timestamp;

  const AuthResult({
    required this.success,
    this.method,
    this.error,
    this.embedding,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  const AuthResult.success({required AuthMethod method, FaceEmbedding? embedding, DateTime? timestamp})
      : success = true,
        method = method,
        error = null,
        embedding = embedding,
        timestamp = timestamp ?? DateTime.now();

  const AuthResult.failure(String error, {AuthMethod? method, DateTime? timestamp})
      : success = false,
        method = method,
        error = error,
        embedding = null,
        timestamp = timestamp ?? DateTime.now();
}

class FaceDetectionResult {
  final bool faceDetected;
  final List<Point<double>> landmarks;
  final Rect boundingBox;
  final double confidence;
  final Map<LivenessChallengeType, double> livenessScores;

  const FaceDetectionResult({
    required this.faceDetected,
    required this.landmarks,
    required this.boundingBox,
    required this.confidence,
    this.livenessScores = const {},
  });

  bool get hasLandmarks => landmarks.isNotEmpty;
  bool get hasFace => faceDetected && confidence > 0.5;
}

class Point<T extends num> {
  final T x;
  final T y;
  const Point(this.x, this.y);
}

class Rect {
  final double left, top, right, bottom;
  const Rect(this.left, this.top, this.right, this.bottom);
  double get width => right - left;
  double get height => bottom - top;
  Point<double> get center => Point((left + right) / 2, (top + bottom) / 2);
}