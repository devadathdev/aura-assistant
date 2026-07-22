import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../models.dart';
import '../services/auth_service.dart';
import '../encryption/encryption_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _pinController = TextEditingController();
  final _newPinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  bool _showPinDialog = false;
  bool _isChangingPin = false;

  @override
  void dispose() {
    _pinController.dispose();
    _newPinController.dispose();
    _confirmPinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final authService = ref.watch(authServiceProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Security Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/home'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSectionHeader('Authentication Methods'),
          _buildAuthMethodTile(
            icon: Icons.face,
            title: 'Face Recognition',
            subtitle: 'Primary authentication with face matching',
            enabled: true,
            onTap: () => _showFaceSettings(context, authService),
          ),
          _buildAuthMethodTile(
            icon: Icons.face_unlock,
            title: 'Face + Liveness Detection',
            subtitle: 'Enhanced security with blink and gaze challenges',
            enabled: true,
            onTap: () => _showLivenessSettings(context),
          ),
          _buildAuthMethodTile(
            icon: Icons.pin,
            title: 'PIN',
            subtitle: _pinController.text.isNotEmpty ? 'PIN is set' : 'Not configured',
            enabled: true,
            onTap: () => _showPinDialog(context, authService),
            trailing: _pinController.text.isNotEmpty
                ? TextButton(
                    onPressed: () => _removePin(authService),
                    child: const Text('Remove'),
                  )
                : null,
          ),
          _buildAuthMethodTile(
            icon: Icons.fingerprint,
            title: 'Device Biometric',
            subtitle: 'Fingerprint or Face Unlock via Android BiometricPrompt',
            enabled: true,
            onTap: () => _showBiometricSettings(context),
          ),

          const SizedBox(height: 24),
          _buildSectionHeader('Continuous Protection'),
          _buildProtectionTile(
            icon: Icons.timer_off,
            title: 'Auto-lock',
            subtitle: 'Lock after 5 minutes of inactivity',
            value: true,
            onChanged: (value) {},
          ),
          _buildProtectionTile(
            icon: Icons.face_retouching_natural,
            title: 'Lock on Different Face',
            subtitle: 'Automatically lock when another face appears',
            value: true,
            onChanged: (value) {},
          ),
          _buildProtectionTile(
            icon: Icons.lock_outline,
            title: 'Require Re-auth for Sensitive Actions',
            subtitle: 'Passwords, API keys, financial tasks',
            value: true,
            onChanged: (value) {},
          ),

          const SizedBox(height: 24),
          _buildSectionHeader('Data & Privacy'),
          _buildDataTile(
            icon: Icons.encrypted,
            title: 'Encrypted Storage',
            subtitle: 'Face embeddings and secrets in Android Keystore',
            onTap: () => _showEncryptionInfo(context),
          ),
          _buildDataTile(
            icon: Icons.delete_forever,
            title: 'Clear All Data',
            subtitle: 'Remove face embeddings, PIN, and settings',
            isDestructive: true,
            onTap: () => _confirmClearData(context, authService),
          ),

          const SizedBox(height: 24),
          _buildSectionHeader('Advanced'),
          _buildDataTile(
            icon: Icons.bug_report,
            title: 'Debug Info',
            subtitle: 'View authentication logs and diagnostics',
            onTap: () => _showDebugInfo(context),
          ),
          _buildDataTile(
            icon: Icons.restore,
            title: 'Reset to Defaults',
            subtitle: 'Restore all security settings to default',
            isDestructive: true,
            onTap: () => _confirmReset(context, authService),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }

  Widget _buildAuthMethodTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool enabled,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: trailing ?? (enabled
            ? Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant)
            : Icon(Icons.lock, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        onTap: enabled ? onTap : null,
      ),
    );
  }

  Widget _buildProtectionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: SwitchListTile(
        secondary: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
        value: value,
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildDataTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: isDestructive ? Theme.of(context).colorScheme.error : Theme.of(context).colorScheme.primary),
        title: Text(title, style: TextStyle(color: isDestructive ? Theme.of(context).colorScheme.error : null)),
        subtitle: Text(subtitle),
        trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
        onTap: onTap,
      ),
    );
  }

  void _showPinDialog(BuildContext context, AuthService authService) {
    if (_pinController.text.isEmpty) {
      _showSetPinDialog(context, authService);
    } else {
      _showChangePinDialog(context, authService);
    }
  }

  void _showSetPinDialog(BuildContext context, AuthService authService) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Set PIN'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _newPinController,
              decoration: const InputDecoration(labelText: 'New PIN (4-8 digits)'),
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 8,
            ),
            TextField(
              controller: _confirmPinController,
              decoration: const InputDecoration(labelText: 'Confirm PIN'),
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 8,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (_newPinController.text == _confirmPinController.text &&
                  _newPinController.text.length >= 4) {
                await authService.setPin(_newPinController.text);
                setState(() => _pinController.text = '****');
                Navigator.pop(context);
              }
            },
            child: const Text('Set PIN'),
          ),
        ],
      ),
    );
  }

  void _showChangePinDialog(BuildContext context, AuthService authService) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Change PIN'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _pinController,
              decoration: const InputDecoration(labelText: 'Current PIN'),
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 8,
            ),
            TextField(
              controller: _newPinController,
              decoration: const InputDecoration(labelText: 'New PIN (4-8 digits)'),
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 8,
            ),
            TextField(
              controller: _confirmPinController,
              decoration: const InputDecoration(labelText: 'Confirm New PIN'),
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 8,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final result = await authService.authenticateWithPin(_pinController.text);
              if (result.success && _newPinController.text == _confirmPinController.text) {
                await authService.setPin(_newPinController.text);
                Navigator.pop(context);
              }
            },
            child: const Text('Change PIN'),
          ),
        ],
      ),
    );
  }

  Future<void> _removePin(AuthService authService) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove PIN'),
        content: const Text('Are you sure you want to remove the PIN?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
        ],
      ),
    );
    
    if (confirmed == true) {
      // Implementation to remove PIN from secure storage
      setState(() => _pinController.clear());
    }
  }

  void _showFaceSettings(BuildContext context, AuthService authService) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.add_a_photo),
              title: const Text('Re-enroll Face'),
              onTap: () {
                Navigator.pop(context);
                context.go('/enroll');
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete),
              title: const Text('Remove Face Data'),
              textColor: Theme.of(context).colorScheme.error,
              iconColor: Theme.of(context).colorScheme.error,
              onTap: () async {
                Navigator.pop(context);
                await _confirmClearFaceData(context, authService);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showLivenessSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Liveness Challenges', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            _buildLivenessChallengeTile(
              icon: Icons.remove_red_eye,
              title: 'Blink Detection',
              subtitle: 'Natural blink detection',
              enabled: true,
            ),
            _buildLivenessChallengeTile(
              icon: Icons.arrow_left,
              title: 'Gaze Left',
              subtitle: 'Look left on command',
              enabled: true,
            ),
            _buildLivenessChallengeTile(
              icon: Icons.arrow_right,
              title: 'Gaze Right',
              subtitle: 'Look right on command',
              enabled: true,
            ),
            _buildLivenessChallengeTile(
              icon: Icons.arrow_upward,
              title: 'Gaze Up',
              subtitle: 'Look up on command',
              enabled: true,
            ),
            _buildLivenessChallengeTile(
              icon: Icons.arrow_downward,
              title: 'Gaze Down',
              subtitle: 'Look down on command',
              enabled: true,
            ),
            _buildLivenessChallengeTile(
              icon: Icons.sentiment_satisfied,
              title: 'Smile Detection',
              subtitle: 'Smile on command',
              enabled: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLivenessChallengeTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool enabled,
  }) {
    return SwitchListTile(
      secondary: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      value: enabled,
      onChanged: (value) {},
    );
  }

  void _showBiometricSettings(BuildContext context) {
    final biometric = ref.read(biometricAuthProvider);
    
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Available Biometrics', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            if (biometric.hasFingerprint)
              ListTile(
                leading: const Icon(Icons.fingerprint),
                title: const Text('Fingerprint'),
                subtitle: const Text('Available'),
              ),
            if (biometric.hasFace)
              ListTile(
                leading: const Icon(Icons.face),
                title: const Text('Face Unlock'),
                subtitle: const Text('Available'),
              ),
            if (!biometric.hasFingerprint && !biometric.hasFace)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Text('No biometric hardware available'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showEncryptionInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Encryption Details'),
        content: const SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('• Android Keystore for key management'),
              Text('• AES-GCM 256-bit encryption'),
              Text('• Face embeddings encrypted at rest'),
              Text('• PIN hashed with PBKDF2 (100,000 iterations)'),
              Text('• No raw face images stored'),
              Text('• Keys never leave secure enclave'),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      ),
    );
  }

  Future<void> _confirmClearData(BuildContext context, AuthService authService) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear All Data'),
        content: const Text('This will permanently delete all face embeddings, PIN, and settings. This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete Everything'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await authService.dispose();
      // Re-initialize
    }
  }

  Future<void> _confirmClearFaceData(BuildContext context, AuthService authService) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Face Data'),
        content: const Text('This will delete your enrolled face data. You will need to re-enroll to use face recognition.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove Face'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      // Clear face embeddings
    }
  }

  void _showDebugInfo(BuildContext context) {
    final authState = ref.read(authStateProvider);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Debug Information'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Auth State: ${authState.runtimeType}'),
              if (authState is _AuthAuthenticated) ...[
                Text('Method: ${authState.method}'),
                Text('Timestamp: ${authState.timestamp}'),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      ),
    );
  }

  Future<void> _confirmReset(BuildContext context, AuthService authService) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset to Defaults'),
        content: const Text('This will reset all security settings to their default values.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Reset')),
        ],
      ),
    );

    if (confirmed == true) {
      // Reset settings
    }
  }
}