import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import '../models.dart';

class BiometricAuthService {
  final LocalAuthentication _localAuth = LocalAuthentication();
  bool _isAvailable = false;
  List<BiometricType> _availableBiometrics = [];

  Future<void> initialize() async {
    _isAvailable = await _localAuth.canCheckBiometrics;
    if (_isAvailable) {
      _availableBiometrics = await _localAuth.getAvailableBiometrics();
    }
  }

  bool get isAvailable => _isAvailable;
  List<BiometricType> get availableBiometrics => _availableBiometrics;

  bool get hasFingerprint => _availableBiometrics.contains(BiometricType.fingerprint);
  bool get hasFace => _availableBiometrics.contains(BiometricType.face);
  bool get hasStrong => _availableBiometrics.contains(BiometricType.strong);
  bool get hasWeak => _availableBiometrics.contains(BiometricType.weak);

  Future<AuthResult> authenticate({
    required String reason,
    bool useErrorDialogs = true,
    bool stickyAuth = true,
    List<BiometricType>? preferredTypes,
  }) async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          useErrorDialogs: useErrorDialogs,
          stickyAuth: stickyAuth,
          biometricOnly: true,
          preferredTypes: preferredTypes,
        ),
        authMessages: const [
          AndroidAuthMessages(
            signInTitle: 'AURA Authentication',
            cancelButton: 'Cancel',
            biometricHint: 'Use fingerprint or face unlock',
            biometricNotRecognized: 'Not recognized, try again',
            deviceCredentialsRequired: 'Device credentials required',
            deviceCredentialsSetupDescription: 'Set up device credentials',
          ),
        ],
      );

      if (authenticated) {
        return AuthResult.success(method: AuthMethod.biometric);
      } else {
        return AuthResult.failure('Authentication cancelled', method: AuthMethod.biometric);
      }
    } on Exception catch (e) {
      return AuthResult.failure('Biometric auth failed: $e', method: AuthMethod.biometric);
    }
  }

  Future<void> dispose() async {
    // No explicit dispose needed for local_auth
  }
}

class PinAuthService {
  final int _maxAttempts;
  final Duration _lockoutDuration;
  int _failedAttempts = 0;
  DateTime? _lockoutUntil;
  String? _storedPinHash;

  PinAuthService({
    int maxAttempts = 5,
    Duration lockoutDuration = const Duration(minutes: 15),
  }) : _maxAttempts = maxAttempts,
       _lockoutDuration = lockoutDuration;

  bool get isLocked => _lockoutUntil != null && DateTime.now().isBefore(_lockoutUntil!);
  Duration? get remainingLockout => _lockoutUntil != null 
      ? _lockoutUntil!.difference(DateTime.now()) 
      : null;
  int get failedAttempts => _failedAttempts;
  int get remainingAttempts => _maxAttempts - _failedAttempts;

  void setPinHash(String hash) {
    _storedPinHash = hash;
  }

  Future<AuthResult> verifyPin(String pin) async {
    if (isLocked) {
      return AuthResult.failure('PIN locked. Try again in ${remainingLockout!.inMinutes} minutes');
    }

    if (_storedPinHash == null) {
      return AuthResult.failure('PIN not set');
    }

    // In real implementation, use PBKDF2 verification
    // This is simplified - actual verification in EncryptionService
    if (pin.length >= 4 && pin == _storedPinHash) {
      _failedAttempts = 0;
      _lockoutUntil = null;
      return AuthResult.success(method: AuthMethod.pin);
    }

    _failedAttempts++;
    if (_failedAttempts >= _maxAttempts) {
      _lockoutUntil = DateTime.now().add(_lockoutDuration);
      return AuthResult.failure('Too many attempts. Locked for ${_lockoutDuration.inMinutes} minutes');
    }

    return AuthResult.failure('Incorrect PIN. ${_maxAttempts - _failedAttempts} attempts remaining');
  }

  void reset() {
    _failedAttempts = 0;
    _lockoutUntil = null;
  }
}