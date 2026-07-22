import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'src/providers.dart';
import 'src/services/auth_service.dart';
import 'src/encryption/encryption_service.dart';
import 'src/biometric/biometric_auth.dart';
import 'src/camera/camera_service.dart';
import 'src/face/face_services.dart';
import 'src/ui/auth_screen.dart';
import 'src/ui/enrollment_screen.dart';
import 'src/ui/settings_screen.dart';
import 'src/models.dart';

final authConfigProvider = Provider<AuthConfig>((ref) => const AuthConfig());

final encryptionServiceProvider = Provider<EncryptionService>((ref) {
  return EncryptionService(const FlutterSecureStorage());
});

final biometricAuthProvider = Provider<BiometricAuthService>((ref) {
  return BiometricAuthService();
});

final pinAuthProvider = Provider<PinAuthService>((ref) {
  return PinAuthService();
});

final cameraServiceProvider = Provider<CameraService>((ref) {
  return CameraService();
});

final faceDetectorProvider = Provider<FaceDetector>((ref) {
  return TFLiteFaceDetector._create();
});

final faceEmbedderProvider = Provider<FaceEmbedder>((ref) {
  return TFLiteFaceEmbedder._create();
});

final livenessDetectorProvider = Provider<LivenessDetector>((ref) {
  return MediaPipeLivenessDetector();
});

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    encryption: ref.watch(encryptionServiceProvider),
    biometric: ref.watch(biometricAuthProvider),
    pinAuth: ref.watch(pinAuthProvider),
    camera: ref.watch(cameraServiceProvider),
    faceDetector: ref.watch(faceDetectorProvider),
    faceEmbedder: ref.watch(faceEmbedderProvider),
    livenessDetector: ref.watch(livenessDetectorProvider),
    config: ref.watch(authConfigProvider),
  );
});

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/auth',
    routes: [
      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthScreen(),
      ),
      GoRoute(
        path: '/enroll',
        builder: (context, state) => const EnrollmentScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
    ],
    redirect: (context, state) {
      final authState = ref.read(authStateProvider);
      final isAuth = authState is _AuthAuthenticated;
      final isAuthRoute = state.matchedLocation.startsWith('/auth') || 
                         state.matchedLocation.startsWith('/enroll');
      
      if (!isAuth && !isAuthRoute) {
        return '/auth';
      }
      if (isAuth && isAuthRoute) {
        return '/home';
      }
      return null;
    },
  );
});

class AuraAuthApp extends ConsumerWidget {
  const AuraAuthApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    
    return MaterialApp.router(
      title: 'AURA Auth',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF00FFD1),
        brightness: Brightness.dark,
        fontFamily: 'Inter',
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF00FFD1),
        brightness: Brightness.dark,
        fontFamily: 'Inter',
      ),
    );
  }
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final authService = ref.watch(authServiceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('AURA Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push('/settings'),
          ),
          IconButton(
            icon: const Icon(Icons.lock),
            onPressed: () => authService.lock(),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.verified_user,
              size: 80,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 24),
            Text(
              'Authenticated',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            if (authState is _AuthAuthenticated) ...[
              Text(
                'Method: ${authState.method.name}',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              Text(
                'Since: ${authState.timestamp.toLocal()}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            const SizedBox(height: 32),
            FilledButton.icon(
              icon: const Icon(Icons.face),
              label: const Text('Re-authenticate with Face'),
              onPressed: () => authService.authenticateWithFace(requireLiveness: true),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              icon: const Icon(Icons.fingerprint),
              label: const Text('Re-authenticate with Biometric'),
              onPressed: () => authService.authenticateWithBiometric(),
            ),
          ],
        ),
      ),
    );
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  final encryption = EncryptionService(const FlutterSecureStorage());
  await encryption.initialize();
  
  final biometric = BiometricAuthService();
  await biometric.initialize();
  
  final camera = CameraService();
  await camera.initialize();
  
  runApp(
    ProviderScope(
      overrides: [
        encryptionServiceProvider.overrideWithValue(encryption),
        biometricAuthProvider.overrideWithValue(biometric),
        cameraServiceProvider.overrideWithValue(camera),
      ],
      child: const AuraAuthApp(),
    ),
  );
}
