import 'dart:convert';
import 'dart:typed_data';
import 'package:encrypt/encrypt.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pointycastle/export.dart';
import '../models.dart';

class EncryptionService {
  static const String _keystoreAlias = 'aura_auth_key';
  static const String _embeddingsKey = 'face_embeddings';
  static const String _pinHashKey = 'pin_hash';
  static const String _authConfigKey = 'auth_config';
  static const String _lastActivityKey = 'last_activity';
  static const String _enrolledUserKey = 'enrolled_user';

  final FlutterSecureStorage _secureStorage;
  final Encrypter _encrypter;
  late final Key _key;
  late final IV _iv;

  EncryptionService(this._secureStorage) 
      : _encrypter = Encrypter(AES(Key.fromLength(32), mode: AESMode.gcm));

  Future<void> initialize() async {
    final keyBytes = await _getOrCreateKey();
    _key = Key(keyBytes);
    _iv = IV.fromLength(16);
  }

  Future<Uint8List> _getOrCreateKey() async {
    const storage = FlutterSecureStorage(
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
        keyCipherAlgorithm: KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
        storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
      ),
    );

    String? existingKey = await storage.read(key: _keystoreAlias);
    if (existingKey != null) {
      return base64.decode(existingKey);
    }

    final key = Key.fromSecureRandom(32);
    await storage.write(key: _keystoreAlias, value: base64.encode(key.bytes));
    return key.bytes;
  }

  Future<void> storeEmbeddings(List<FaceEmbedding> embeddings) async {
    final json = jsonEncode(embeddings.map((e) => e.toJson()).toList());
    final encrypted = _encrypter.encrypt(json, iv: _iv);
    await _secureStorage.write(key: _embeddingsKey, value: base64.encode(encrypted.bytes));
  }

  Future<List<FaceEmbedding>> getEmbeddings() async {
    final encryptedData = await _secureStorage.read(key: _embeddingsKey);
    if (encryptedData == null) return [];
    
    try {
      final encrypted = Encrypted(base64.decode(encryptedData), iv: _iv);
      final decrypted = _encrypter.decrypt(encrypted);
      final List<dynamic> json = jsonDecode(decrypted);
      return json.map((e) => FaceEmbedding.fromJson(e)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> storePinHash(PinHash pinHash) async {
    final json = jsonEncode(pinHash.toJson());
    final encrypted = _encrypter.encrypt(json, iv: _iv);
    await _secureStorage.write(key: _pinHashKey, value: base64.encode(encrypted.bytes));
  }

  Future<PinHash?> getPinHash() async {
    final encryptedData = await _secureStorage.read(key: _pinHashKey);
    if (encryptedData == null) return null;
    
    try {
      final encrypted = Encrypted(base64.decode(encryptedData), iv: _iv);
      final decrypted = _encrypter.decrypt(encrypted);
      return PinHash.fromJson(jsonDecode(decrypted));
    } catch (e) {
      return null;
    }
  }

  Future<void> storeAuthConfig(AuthConfig config) async {
    final json = jsonEncode({
      'maxFaceEnrollmentAttempts': config.maxFaceEnrollmentAttempts,
      'livenessChallengeCount': config.livenessChallengeCount,
      'livenessChallengeTimeout': config.livenessChallengeTimeout.inMilliseconds,
      'faceSimilarityThreshold': config.faceSimilarityThreshold,
      'autoLockTimeout': config.autoLockTimeout.inMilliseconds,
      'maxPinAttempts': config.maxPinAttempts,
      'pinLockoutDuration': config.pinLockoutDuration.inMilliseconds,
      'requireLivenessForEnrollment': config.requireLivenessForEnrollment,
      'requireLivenessForAuth': config.requireLivenessForAuth,
    });
    final encrypted = _encrypter.encrypt(json, iv: _iv);
    await _secureStorage.write(key: _authConfigKey, value: base64.encode(encrypted.bytes));
  }

  Future<AuthConfig> getAuthConfig() async {
    final encryptedData = await _secureStorage.read(key: _authConfigKey);
    if (encryptedData == null) return const AuthConfig();
    
    try {
      final encrypted = Encrypted(base64.decode(encryptedData), iv: _iv);
      final decrypted = _encrypter.decrypt(encrypted);
      final Map<String, dynamic> json = jsonDecode(decrypted);
      return AuthConfig(
        maxFaceEnrollmentAttempts: json['maxFaceEnrollmentAttempts'] ?? 3,
        livenessChallengeCount: json['livenessChallengeCount'] ?? 3,
        livenessChallengeTimeout: Duration(milliseconds: json['livenessChallengeTimeout'] ?? 5000),
        faceSimilarityThreshold: (json['faceSimilarityThreshold'] ?? 0.75).toDouble(),
        autoLockTimeout: Duration(milliseconds: json['autoLockTimeout'] ?? 300000),
        maxPinAttempts: json['maxPinAttempts'] ?? 5,
        pinLockoutDuration: Duration(milliseconds: json['pinLockoutDuration'] ?? 900000),
        requireLivenessForEnrollment: json['requireLivenessForEnrollment'] ?? true,
        requireLivenessForAuth: json['requireLivenessForAuth'] ?? true,
      );
    } catch (e) {
      return const AuthConfig();
    }
  }

  Future<void> updateLastActivity() async {
    final timestamp = DateTime.now().toIso8601String();
    final encrypted = _encrypter.encrypt(timestamp, iv: _iv);
    await _secureStorage.write(key: _lastActivityKey, value: base64.encode(encrypted.bytes));
  }

  Future<DateTime?> getLastActivity() async {
    final encryptedData = await _secureStorage.read(key: _lastActivityKey);
    if (encryptedData == null) return null;
    
    try {
      final encrypted = Encrypted(base64.decode(encryptedData), iv: _iv);
      final decrypted = _encrypter.decrypt(encrypted);
      return DateTime.parse(decrypted);
    } catch (e) {
      return null;
    }
  }

  Future<void> setEnrolledUser(String userId) async {
    final encrypted = _encrypter.encrypt(userId, iv: _iv);
    await _secureStorage.write(key: _enrolledUserKey, value: base64.encode(encrypted.bytes));
  }

  Future<String?> getEnrolledUser() async {
    final encryptedData = await _secureStorage.read(key: _enrolledUserKey);
    if (encryptedData == null) return null;
    
    try {
      final encrypted = Encrypted(base64.decode(encryptedData), iv: _iv);
      return _encrypter.decrypt(encrypted);
    } catch (e) {
      return null;
    }
  }

  Future<void> clearAll() async {
    await _secureStorage.deleteAll();
  }

  static String hashPin(String pin, String salt, {int iterations = 100000}) {
    final keyDerivator = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64))
      ..init(Pbkdf2Parameters(salt.codeUnits, iterations, 32));
    final key = keyDerivator.process(pin.codeUnits);
    return base64.encode(key);
  }

  static bool verifyPin(String pin, PinHash pinHash) {
    final computedHash = hashPin(pin, pinHash.salt, iterations: pinHash.iterations);
    return computedHash == pinHash.hash;
  }

  static PinHash createPinHash(String pin, {int iterations = 100000}) {
    final salt = _generateSalt(16);
    final hash = hashPin(pin, salt, iterations: iterations);
    return PinHash(
      hash: hash,
      salt: salt,
      iterations: iterations,
      createdAt: DateTime.now(),
    );
  }

  static String _generateSalt(int length) {
    final random = SecureRandom('AES/CTR/AUTO-SEED-PRNG')
      ..init(ParametersWithIV(KeyParameter(Uint8List.fromList(List.generate(32, (i) => i))), Uint8List(16)));
    return base64.encode(random.nextBytes(length));
  }
}