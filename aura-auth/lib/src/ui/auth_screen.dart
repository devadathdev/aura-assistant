import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../models.dart';
import '../services/auth_service.dart';
import '../camera/camera_service.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _scanController;
  AuthMethod _selectedMethod = AuthMethod.faceRecognition;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    
    _scanController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _scanController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final livenessState = ref.watch(livenessStateProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.surface,
              theme.colorScheme.surfaceContainerHighest,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(theme, authState),
              Expanded(child: _buildMainContent(theme, authState, livenessState)),
              _buildMethodSelector(theme),
              _buildActionButtons(theme, authState),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, AuthStatus authState) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              return Transform.scale(
                scale: 1.0 + _pulseController.value * 0.05,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [
                        Theme.of(context).colorScheme.primary,
                        Theme.of(context).colorScheme.secondary,
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                        blurRadius: 20,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.face,
                    size: 40,
                    color: Theme.of(context).colorScheme.onPrimary,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 24),
          Text(
            'AURA Authentication',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _getStatusText(authState),
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  String _getStatusText(AuthStatus authState) {
    if (authState is _AuthAuthenticating) {
      return 'Authenticating...';
    } else if (authState is _AuthAuthenticated) {
      return 'Authenticated';
    } else if (authState is _AuthLocked) {
      return 'Locked${authState.reason != null ? ': ${authState.reason}' : ''}';
    } else if (authState is _AuthFailed) {
      return 'Failed: ${authState.errorMessage}';
    }
    return 'Choose authentication method';
  }

  Widget _buildMainContent(BuildContext context, AuthStatus authState, LivenessStatus livenessState) {
    if (authState is _AuthAuthenticating && authState.method == AuthMethod.faceRecognition) {
      return _buildFaceAuthView(context, livenessState);
    } else if (authState is _AuthAuthenticating && authState.method == AuthMethod.faceWithLiveness) {
      return _buildLivenessView(context, livenessState);
    } else if (authState is _AuthAuthenticating && authState.method == AuthMethod.pin) {
      return _buildPinView(context);
    }
    return _buildMethodPreview(context, _selectedMethod);
  }

  Widget _buildFaceAuthView(BuildContext context, LivenessStatus livenessState) {
    return Stack(
      alignment: Alignment.center,
      children: [
        _buildCameraPreview(context),
        _buildFaceOverlay(context),
        if (livenessState is _LivenessChallenging)
          _buildLivenessInstruction(context, livenessState.challenge),
        _buildScanLine(context),
      ],
    );
  }

  Widget _buildCameraPreview(BuildContext context) {
    return Consumer(
      builder: (context, ref, child) {
        final authService = ref.read(authServiceProvider);
        return StreamBuilder<CameraFrame>(
          stream: authService.camera.frameStream,
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(150),
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                ),
                child: Center(
                  child: CircularProgressIndicator(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              );
            }
            // In real app, use CameraPreview widget
            return Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(150),
                border: Border.all(
                  color: Theme.of(context).colorScheme.primary,
                  width: 3,
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(150),
                child: CustomPaint(
                  painter: _CameraPreviewPainter(snapshot.data!.image),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildFaceOverlay(BuildContext context) {
    return CustomPaint(
      size: const Size(300, 300),
      painter: _FaceOverlayPainter(
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  Widget _buildScanLine(BuildContext context) {
    return AnimatedBuilder(
      animation: _scanController,
      builder: (context, child) {
        return Positioned(
          top: 75 + _scanController.value * 150,
          left: 75,
          right: 75,
          child: Container(
            height: 2,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary.withOpacity(0),
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.primary.withOpacity(0),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildLivenessInstruction(BuildContext context, LivenessChallenge challenge) {
    return Positioned(
      bottom: 100,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.9),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Theme.of(context).colorScheme.primary),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getLivenessIcon(challenge.type),
              size: 32,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 8),
            Text(
              challenge.instruction,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: challenge.progress,
              backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
              valueColor: AlwaysStoppedAnimation(Theme.of(context).colorScheme.primary),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getLivenessIcon(LivenessChallengeType type) {
    switch (type) {
      case LivenessChallengeType.blink: return Icons.remove_red_eye;
      case LivenessChallengeType.lookLeft: return Icons.arrow_left;
      case LivenessChallengeType.lookRight: return Icons.arrow_right;
      case LivenessChallengeType.lookUp: return Icons.arrow_upward;
      case LivenessChallengeType.lookDown: return Icons.arrow_downward;
      case LivenessChallengeType.smile: return Icons.sentiment_satisfied;
    }
  }

  Widget _buildLivenessView(BuildContext context, LivenessStatus livenessState) {
    return _buildFaceAuthView(context, livenessState);
  }

  Widget _buildPinView(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.pin,
            size: 64,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 24),
          Text(
            'Enter PIN',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 24),
          _buildPinInput(context),
          const SizedBox(height: 16),
          _buildPinKeypad(context),
        ],
      ),
    );
  }

  String _pinInput = '';
  final List<String> _pinDots = ['', '', '', ''];

  Widget _buildPinInput(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (index) {
        return Container(
          width: 20,
          height: 20,
          margin: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: _pinInput.length > index 
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.outline,
              width: 2,
            ),
            color: _pinInput.length > index
                ? Theme.of(context).colorScheme.primary
                : Colors.transparent,
          ),
        );
      }),
    );
  }

  Widget _buildPinKeypad(BuildContext context) {
    final keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];

    return Column(
      children: keys.map((row) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: row.map((key) {
            return _PinKey(
              label: key,
              onTap: () => _onPinKey(key),
              isEmpty: key.isEmpty,
            );
          }).toList(),
        );
      }).toList(),
    );
  }

  void _onPinKey(String key) {
    setState(() {
      if (key == '⌫') {
        if (_pinInput.isNotEmpty) {
          _pinInput = _pinInput.substring(0, _pinInput.length - 1);
        }
      } else if (_pinInput.length < 4 && key.isNotEmpty) {
        _pinInput += key;
        if (_pinInput.length == 4) {
          // Auto-submit
          ref.read(authServiceProvider).authenticateWithPin(_pinInput);
        }
      }
    });
  }

  Widget _buildMethodPreview(BuildContext context, AuthMethod method) {
    return Container(
      width: 300,
      height: 300,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(150),
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _getMethodIcon(method),
              size: 80,
              color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
            ),
            const SizedBox(height: 16),
            Text(
              _getMethodName(method),
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getMethodIcon(AuthMethod method) {
    switch (method) {
      case AuthMethod.faceRecognition: return Icons.face;
      case AuthMethod.faceWithLiveness: return Icons.face_unlock;
      case AuthMethod.pin: return Icons.pin;
      case AuthMethod.biometric: return Icons.fingerprint;
    }
  }

  String _getMethodName(AuthMethod method) {
    switch (method) {
      case AuthMethod.faceRecognition: return 'Face Recognition';
      case AuthMethod.faceWithLiveness: return 'Face + Liveness';
      case AuthMethod.pin: return 'PIN';
      case AuthMethod.biometric: return 'Biometric';
    }
  }

  Widget _buildMethodSelector(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: AuthMethod.values.map((method) {
            final isSelected = _selectedMethod == method;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: FilterChip(
                label: Text(_getMethodName(method)),
                icon: Icon(_getMethodIcon(method), size: 18),
                selected: isSelected,
                onSelected: (selected) {
                  if (selected) {
                    setState(() => _selectedMethod = method);
                  }
                },
                selectedColor: Theme.of(context).colorScheme.primaryContainer,
                labelStyle: TextStyle(
                  color: isSelected
                      ? Theme.of(context).colorScheme.onPrimaryContainer
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context, AuthStatus authState) {
    final isAuthenticating = authState is _AuthAuthenticating;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              icon: const Icon(Icons.close),
              label: const Text('Cancel'),
              onPressed: isAuthenticating ? null : () => context.pop(),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: FilledButton.icon(
              icon: isAuthenticating
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(_getMethodIcon(_selectedMethod)),
              label: Text(isAuthenticating ? 'Authenticating...' : 'Authenticate'),
              onPressed: isAuthenticating
                  ? null
                  : () => _startAuthentication(),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _startAuthentication() {
    final authService = ref.read(authServiceProvider);
    switch (_selectedMethod) {
      case AuthMethod.faceRecognition:
        ref.read(authStateProvider.notifier).authenticate(AuthMethod.faceRecognition);
        authService.authenticateWithFace(requireLiveness: false);
        break;
      case AuthMethod.faceWithLiveness:
        ref.read(authStateProvider.notifier).authenticate(AuthMethod.faceWithLiveness);
        authService.authenticateWithFace(requireLiveness: true);
        break;
      case AuthMethod.pin:
        ref.read(authStateProvider.notifier).authenticate(AuthMethod.pin);
        break;
      case AuthMethod.biometric:
        ref.read(authStateProvider.notifier).authenticate(AuthMethod.biometric);
        authService.authenticateWithBiometric();
        break;
    }
  }
}

class _CameraPreviewPainter extends CustomPainter {
  final CameraImage image;
  _CameraPreviewPainter(this.image);

  @override
  void paint(Canvas canvas, Size size) {
    // Would draw actual camera preview here
    final paint = Paint()..color = Colors.grey[800]!;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class _FaceOverlayPainter extends CustomPainter {
  final Color color;
  _FaceOverlayPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.4;

    // Face oval
    canvas.drawOval(
      Rect.fromCircle(center: center, radius: radius),
      paint,
    );

    // Eye positions
    final eyeOffset = radius * 0.3;
    final eyeRadius = radius * 0.15;
    canvas.drawCircle(
      Offset(center.dx - eyeOffset, center.dy - radius * 0.1),
      eyeRadius,
      paint,
    );
    canvas.drawCircle(
      Offset(center.dx + eyeOffset, center.dy - radius * 0.1),
      eyeRadius,
      paint,
    );

    // Corner brackets
    final bracketSize = 30.0;
    final corners = [
      Offset(center.dx - radius, center.dy - radius),
      Offset(center.dx + radius, center.dy - radius),
      Offset(center.dx - radius, center.dy + radius),
      Offset(center.dx + radius, center.dy + radius),
    ];

    for (final corner in corners) {
      final isLeft = corner.dx < center.dx;
      final isTop = corner.dy < center.dy;
      
      canvas.drawPath(
        Path()
          ..moveTo(corner.dx + (isLeft ? 0 : -bracketSize), corner.dy)
          ..lineTo(corner.dx + (isLeft ? bracketSize : 0), corner.dy)
          ..moveTo(corner.dx, corner.dy + (isTop ? 0 : -bracketSize))
          ..lineTo(corner.dx, corner.dy + (isTop ? bracketSize : 0)),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _PinKey extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool isEmpty;

  const _PinKey({
    required this.label,
    required this.onTap,
    this.isEmpty = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: isEmpty ? null : onTap,
      borderRadius: BorderRadius.circular(28),
      child: Container(
        width: 56,
        height: 56,
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
        ),
        child: Center(
          child: label == '⌫'
              ? Icon(Icons.backspace, color: Theme.of(context).colorScheme.onSurfaceVariant)
              : Text(
                  label,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w300,
                  ),
                ),
        ),
      ),
    );
  }
}