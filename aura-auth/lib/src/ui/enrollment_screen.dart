import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../models.dart';
import '../services/auth_service.dart';

class EnrollmentScreen extends ConsumerStatefulWidget {
  const EnrollmentScreen({super.key});

  @override
  ConsumerState<EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends ConsumerState<EnrollmentScreen> with TickerProviderStateMixin {
  late AnimationController _progressController;
  int _currentStep = 0;
  final List<EnrollmentStep> _steps = [
    EnrollmentStep(
      title: 'Position Face',
      instruction: 'Center your face in the frame',
      icon: Icons.face,
    ),
    EnrollmentStep(
      title: 'Liveness Check',
      instruction: 'Follow the on-screen instructions',
      icon: Icons.verified_user,
    ),
    EnrollmentStep(
      title: 'Capture',
      instruction: 'Hold still while we capture your face',
      icon: Icons.camera,
    ),
    EnrollmentStep(
      title: 'Complete',
      instruction: 'Face enrolled successfully',
      icon: Icons.check_circle,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final enrollmentState = ref.watch(faceEnrollmentStateProvider);
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
              _buildProgressIndicator(theme),
              Expanded(
                child: PageView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  controller: PageController(initialPage: _currentStep),
                  itemCount: _steps.length,
                  onPageChanged: (index) {
                    setState(() => _currentStep = index);
                    _progressController.animateTo(index / (_steps.length - 1));
                  },
                  itemBuilder: (context, index) => _buildStep(context, _steps[index], enrollmentState, livenessState),
                ),
              ),
              _buildNavigationButtons(theme, enrollmentState),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressIndicator(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            children: List.generate(_steps.length, (index) {
              final isActive = index <= _currentStep;
              return Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        height: 4,
                        decoration: BoxDecoration(
                          color: isActive
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.outline,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    if (index < _steps.length - 1) const SizedBox(width: 8),
                  ],
                ),
              );
            }),
          ),
          const SizedBox(height: 16),
          Text(
            _steps[_currentStep].title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _steps[_currentStep].instruction,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep(BuildContext context, EnrollmentStep step, FaceEnrollmentStatus enrollmentState, LivenessStatus livenessState) {
    switch (_currentStep) {
      case 0:
        return _buildPositionStep(context, enrollmentState);
      case 1:
        return _buildLivenessStep(context, livenessState);
      case 2:
        return _buildCaptureStep(context, enrollmentState);
      case 3:
        return _buildCompleteStep(context);
      default:
        return const SizedBox();
    }
  }

  Widget _buildPositionStep(BuildContext context, FaceEnrollmentStatus enrollmentState) {
    return Stack(
      alignment: Alignment.center,
      children: [
        _buildCameraPreview(context),
        _buildFaceOverlay(context),
        if (enrollmentState == FaceEnrollmentStatus.capturing)
          Positioned(
            bottom: 100,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Theme.of(context).colorScheme.primary),
              ),
              child: const Text(
                'Position your face in the frame',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLivenessStep(BuildContext context, LivenessStatus livenessState) {
    return Stack(
      alignment: Alignment.center,
      children: [
        _buildCameraPreview(context),
        _buildFaceOverlay(context),
        if (livenessState is _LivenessChallenging)
          _buildLivenessInstruction(context, livenessState.challenge),
      ],
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

  Widget _buildCaptureStep(BuildContext context, FaceEnrollmentStatus enrollmentState) {
    return Stack(
      alignment: Alignment.center,
      children: [
        _buildCameraPreview(context),
        _buildFaceOverlay(context),
        if (enrollmentState == FaceEnrollmentStatus.capturing)
          Positioned(
            bottom: 100,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Theme.of(context).colorScheme.primary),
              ),
              child: const Text(
                'Capturing... Hold still',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCompleteStep(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.check_circle,
            size: 80,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 24),
          Text(
            'Enrollment Complete!',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your face has been securely enrolled',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCameraPreview(BuildContext context) {
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
        child: Container(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: const Center(
            child: Icon(Icons.camera_alt, size: 64, color: Colors.grey),
          ),
        ),
      ),
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

  Widget _buildNavigationButtons(BuildContext context, FaceEnrollmentStatus enrollmentState) {
    final isLastStep = _currentStep == _steps.length - 1;
    final isFirstStep = _currentStep == 0;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          if (!isFirstStep)
            Expanded(
              child: OutlinedButton(
                onPressed: () {
                  setState(() => _currentStep--);
                  _progressController.animateTo(_currentStep / (_steps.length - 1));
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Back'),
              ),
            ),
          if (!isFirstStep) const SizedBox(width: 16),
          Expanded(
            child: FilledButton(
              onPressed: _getNextButtonAction(enrollmentState),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: Text(isLastStep ? 'Done' : 'Next'),
            ),
          ),
        ],
      ),
    );
  }

  VoidCallback? _getNextButtonAction(FaceEnrollmentStatus enrollmentState) {
    if (_currentStep == _steps.length - 1) {
      return () => context.go('/auth');
    }
    if (enrollmentState == FaceEnrollmentStatus.capturing || enrollmentState == FaceEnrollmentStatus.completed) {
      return () {
        setState(() => _currentStep++);
        _progressController.animateTo(_currentStep / (_steps.length - 1));
      };
    }
    return () {
      ref.read(faceEnrollmentStateProvider.notifier).startEnrollment();
      setState(() => _currentStep++);
      _progressController.animateTo(_currentStep / (_steps.length - 1));
    };
  }
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

    canvas.drawOval(
      Rect.fromCircle(center: center, radius: radius),
      paint,
    );

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

class EnrollmentStep {
  final String title;
  final String instruction;
  final IconData icon;

  const EnrollmentStep({
    required this.title,
    required this.instruction,
    required this.icon,
  });
}