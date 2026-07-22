# AURA Authentication System

A comprehensive, secure authentication system for Android with face recognition, liveness detection, PIN fallback, and device biometrics.

## Features

### Primary Authentication
- **Face Recognition** - Registered user only, using TensorFlow Lite (MobileFaceNet embeddings)
- **Eye Liveness Detection** - Blink detection + random eye movement challenges (look left/right/up/down, smile)
- **Local Verification Only** - No cloud dependencies, all processing on-device

### Fallback Methods
- **PIN** - 4-8 digit numeric PIN with PBKDF2 hashing (100,000 iterations)
- **Device Biometric** - Fingerprint / Face Unlock via Android BiometricPrompt

### Secure Storage
- **Android Keystore** - Hardware-backed key storage
- **AES-GCM 256-bit Encryption** - Encrypt embeddings and secrets
- **No Raw Face Images** - Only encrypted embeddings stored

### Continuous Protection
- **Auto-lock** - After 5 minutes of inactivity
- **Different Face Detection** - Lock when another face appears
- **Re-authentication** - Required for sensitive actions (passwords, API keys, financial tasks)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Flutter (Material 3, Riverpod) |
| Camera | CameraX / Flutter camera plugin |
| Face & Eye Tracking | Google MediaPipe Face Landmarker / ML Kit |
| Face Recognition | TensorFlow Lite (MobileFaceNet embeddings) |
| Encryption | Android Keystore + AES-GCM |
| State Management | Riverpod |
| Navigation | go_router |

## Project Structure

```
lib/
├── main.dart                    # App entry point
├── src/
│   ├── models.dart              # Data models (AuthStatus, FaceEmbedding, etc.)
│   ├── providers.dart           # Riverpod providers
│   ├── encryption/
│   │   └── encryption_service.dart  # AES-GCM + Keystore encryption
│   ├── biometric/
│   │   └── biometric_auth.dart      # LocalAuth + BiometricPrompt
│   ├── camera/
│   │   └── camera_service.dart      # CameraX / camera plugin wrapper
│   ├── face/
│   │   └── face_services.dart       # TFLite face detection, embedding, liveness
│   ├── services/
│   │   └── auth_service.dart        # Main authentication orchestrator
│   └── ui/
│       ├── auth_screen.dart         # Main authentication UI
│       ├── enrollment_screen.dart   # Face enrollment flow
│       └── settings_screen.dart     # Security settings
```

## Getting Started

### Prerequisites
- Flutter SDK 3.2+
- Android Studio / VS Code
- Android device/emulator with camera (API 23+)
- Physical device recommended for biometrics

### Installation

```bash
# Clone/navigate to project
cd aura-auth

# Get dependencies
flutter pub get

# Generate code (Riverpod annotations)
flutter pub run build_runner build --delete-conflicting-outputs

# Download TFLite models (see below)
./download_models.sh

# Run on device
flutter run
```

### TFLite Models

Place these models in `assets/models/`:
- `face_detection.tflite` - BlazeFace or MediaPipe face detection
- `face_embedding.tflite` - MobileFaceNet (512-dim embeddings)

```bash
# Quick download script
./download_models.sh
```

Or manually download from:
- Face Detection: https://github.com/google/mediapipe/tree/master/mediapipe/models
- Face Embedding: https://github.com/deepinsight/insightface/tree/master/models

## Usage

### Authentication Flow

```dart
final authService = ref.read(authServiceProvider);

// Face recognition with liveness
final result = await authService.authenticateWithFace(requireLiveness: true);

// PIN authentication
final result = await authService.authenticateWithPin("1234");

// Device biometric
final result = await authService.authenticateWithBiometric();
```

### Enrollment

```dart
// Navigate to enrollment screen
context.go('/enroll');

// Or programmatically
final result = await authService.enrollFace("user_id");
```

### Lock/Unlock

```dart
// Manual lock
authService.lock();

// Check if locked
if (authService.isLocked) { ... }
```

### Settings

Navigate to settings:
```dart
context.go('/settings');
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Android Keystore                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Master Key (HW-backed)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Face        │ │ PIN Hash    │ │ Auth Config │
    │ Embeddings  │ │ (PBKDF2)    │ │ (Encrypted) │
    │ (AES-GCM)   │ │ (AES-GCM)   │ │             │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### Key Security Properties

1. **Keys never leave Keystore** - Hardware-backed on supported devices
2. **Face embeddings encrypted** - AES-GCM with unique IV per entry
3. **PIN never stored in plaintext** - PBKDF2 with 100k iterations + salt
4. **No raw images persisted** - Only mathematical embeddings
5. **Anti-spoofing** - Liveness challenges prevent photo/video attacks
6. **Continuous monitoring** - Background face detection for session protection

## Configuration

Edit `AuthConfig` in `models.dart`:

```dart
const AuthConfig(
  faceSimilarityThreshold: 0.75,     // Cosine similarity threshold
  autoLockTimeout: Duration(minutes: 5),
  maxPinAttempts: 5,
  pinLockoutDuration: Duration(minutes: 15),
  livenessChallengeCount: 3,
  requireLivenessForAuth: true,
  requireLivenessForEnrollment: true,
)
```

## Liveness Challenges

Randomized sequence of 3 challenges:
1. **Blink** - Natural blink detection (EAR threshold)
2. **Gaze** - Look left/right/up/down (iris position tracking)
3. **Smile** - Mouth corner elevation detection

## Building for Release

```bash
# Build APK
flutter build apk --release

# Build App Bundle (Play Store)
flutter build appbundle --release
```

### ProGuard/R8

Rules in `android/app/proguard-rules.pro` protect:
- Encryption keys and algorithms
- Biometric authentication flow
- TFLite model inference
- Camera and secure storage operations

## Testing

```bash
# Unit tests
flutter test

# Integration tests
flutter test integration_test/
```

## Platform Support

| Platform | Face Auth | Biometric | Camera | Keystore |
|----------|-----------|-----------|--------|----------|
| Android 6+ (API 23) | ✅ | ✅ | ✅ | ✅ |
| iOS | ❌ (separate impl) | ✅ (FaceID/TouchID) | ✅ | ✅ (Keychain) |

## Permissions

Required Android permissions:
- `CAMERA` - Face recognition
- `USE_BIOMETRIC` - Fingerprint/Face unlock
- `FOREGROUND_SERVICE_CAMERA` - Continuous protection
- `WAKE_LOCK` - Keep screen on during auth
- `RECEIVE_BOOT_COMPLETED` - Auto-start service

## Troubleshooting

### Camera not working
- Check `CAMERA` permission granted
- Ensure front camera exists
- Test on physical device (emulator camera limited)

### Biometric not available
- Check device has fingerprint/face hardware
- Ensure lock screen security set (PIN/pattern/password)
- Test `BiometricManager.canAuthenticate()`

### Face recognition failing
- Verify TFLite models in `assets/models/`
- Check lighting conditions
- Ensure face centered in frame
- Adjust `faceSimilarityThreshold` if needed

### Build errors
```bash
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

## License

MIT License - See LICENSE file

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit PR