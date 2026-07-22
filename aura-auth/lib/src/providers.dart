// Generated file - do not edit manually
// ignore_for_file: invalid_annotation_target
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'providers.g.dart';

@riverpod
class AuthState extends _$AuthState {
  @override
  AuthStatus build() => AuthStatus.initial;

  Future<void> authenticate(AuthMethod method) async {
    state = AuthStatus.authenticating;
    // Implementation will be in the service
  }

  void lock() => state = AuthStatus.locked;
  void unlock() => state = AuthStatus.authenticated;
  void logout() => state = AuthStatus.unauthenticated;
}

@riverpod
class FaceEnrollmentState extends _$FaceEnrollmentState {
  @override
  FaceEnrollmentStatus build() => FaceEnrollmentStatus.idle;

  void startEnrollment() => state = FaceEnrollmentStatus.capturing;
  void captureProgress(double progress) => state = FaceEnrollmentStatus.capturing;
  void complete() => state = FaceEnrollmentStatus.completed;
  void fail(String error) => state = FaceEnrollmentStatus.failed;
  void reset() => state = FaceEnrollmentStatus.idle;
}

@riverpod
class LivenessState extends _$LivenessState {
  @override
  LivenessStatus build() => LivenessStatus.idle;

  void startChallenge(LivenessChallenge challenge) {
    state = LivenessStatus.challenging(challenge);
  }

  void updateProgress(double progress) {
    if (state case LivenessStatus.challenging(_)) {
      state = LivenessStatus.challenging(state.challenge.copyWith(progress: progress));
    }
  }

  void pass() => state = LivenessStatus.passed;
  void fail(String reason) => state = LivenessStatus.failed(reason);
  void reset() => state = LivenessStatus.idle;
}