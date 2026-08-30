// AURA Enhanced Authentication Module
// Adds: Liveness detection, PIN fallback, encryption, auto-lock, continuous protection

const AUTH_CONFIG = {
  // Face recognition
  faceSimilarityThreshold: 0.68,
  maxEnrollSamples: 5,
  minEnrollSamples: 4,
  maxEnrollAttempts: 18,
  enrollmentSampleDelay: 450,
  minDetectionScore: 0.45,
  minFaceBoxRatio: 0.08,
  maxFaceBoxRatio: 0.72,
  maxFaceOffsetRatio: 0.28,
  maxEnrollSampleDistance: 0.52,
  authenticationAttempts: 24,
  authenticationRetryDelay: 250,
  
  // Liveness detection
  livenessEnabled: true,
  livenessChallenges: ['blink', 'lookLeft', 'lookRight', 'lookUp', 'lookDown', 'smile'],
  livenessChallengeCount: 3,
  livenessChallengeTimeout: 7000,
  blinkThreshold: 0.22,
  gazeThreshold: 0.12,
  smileThreshold: 0.3,
  
  // PIN
  pinLength: { min: 4, max: 8 },
  pinMaxAttempts: 5,
  pinLockoutDuration: 15 * 60 * 1000,
  
  // Encryption
  encryptionAlgorithm: 'AES-GCM',
  keyLength: 256,
  pbkdf2Iterations: 200000,
  encryptionVersion: 2,
  
  // Session
  autoLockTimeout: 30 * 1000,
  lockOnBlur: true,
  lockOnVisibilityChange: true,
  continuousProtectionEnabled: true,
  continuousCheckInterval: 1000,
  noFaceLockGrace: 5000,
  continuousMismatchLimit: 2,
  
  // Sensitive actions requiring re-auth
  sensitiveActions: [
    'password', 'api key', 'apikey', 'secret', 'token',
    'financial', 'payment', 'transfer', 'withdraw', 'deposit',
    'delete account', 'export data', 'reset', 'clear all'
  ],
  
  // Fingerprint (WebAuthn)
  fingerprintEnabled: true,
  fingerprintUserVerification: 'required',
  fingerprintTimeout: 60000,
  
  // Iris/Eye scanning (camera-based)
  irisEnabled: true,
  irisSimilarityThreshold: 0.72,
  maxIrisEnrollSamples: 4,
  minIrisEnrollSamples: 3,
  irisEnrollSampleDelay: 500,
  irisAuthenticationAttempts: 20,
  irisAuthenticationRetryDelay: 300,
  minEyeBoxRatio: 0.02,
  maxEyeBoxRatio: 0.15,
};

const AUTH_STORAGE_KEYS = {
  faceDescriptors: 'aura.face.descriptors.v2',
  faceAuthEnabled: 'aura.face.auth.enabled.v2',
  pinHash: 'aura.pin.hash.v2',
  pinSalt: 'aura.pin.salt.v2',
  pinAttempts: 'aura.pin.attempts.v2',
  pinLockoutUntil: 'aura.pin.lockout.v2',
  encryptionKey: 'aura.enc.key.v2',
  encryptionSalt: 'aura.enc.salt.v2',
  lastActivity: 'aura.auth.lastActivity.v2',
  enrolledUser: 'aura.auth.user.v2',
  sensitiveActionTimestamp: 'aura.auth.sensitive.v2',
  
  // Fingerprint (WebAuthn credential ID)
  fingerprintCredentialId: 'aura.fingerprint.credential.v1',
  fingerprintEnabled: 'aura.fingerprint.enabled.v1',
  
  // Iris/Eye scanning
  irisDescriptors: 'aura.iris.descriptors.v1',
  irisAuthEnabled: 'aura.iris.auth.enabled.v1',
};

class AuraAuth {
  constructor() {
    this.state = {
      faceAuthEnabled: false,
      faceDescriptors: [],
      pinSet: false,
      pinAttempts: 0,
      pinLockoutUntil: null,
      authenticated: false,
      authMethod: null,
      lastActivity: Date.now(),
      currentLivenessChallenge: null,
      livenessChallengeIndex: 0,
      livenessChallenges: [],
      livenessPassed: false,
      continuousProtectionActive: false,
      enrolledFaceDescriptor: null,
      
      // Fingerprint (WebAuthn)
      fingerprintEnabled: false,
      fingerprintCredentialId: null,
      
      // Iris/Eye scanning
      irisAuthEnabled: false,
      irisDescriptors: [],
      enrolledIrisDescriptor: null,
    };
    
    this.cryptoKey = null;
    this.encryptionSalt = null;
    this.autoLockTimer = null;
    this.continuousCheckTimer = null;
    this.activityListeners = new Set();
    this.sensitiveActionCallback = null;
    this.lastDetectionIssue = '';
    this.lastSeenFaceAt = 0;
    this.continuousMismatchCount = 0;
    this.activityTrackingBound = false;
    this.instantLockListenersBound = false;
  }

  async init() {
    await this.initEncryption();
    await this.loadState();
    this.setupActivityTracking();
    // Don't start auto-lock timer until after first authentication
    // this.startAutoLockTimer();
    // this.startContinuousProtection();
  }

  setupInstantLockListeners() {
    if (this.instantLockListenersBound) return;
    
    if (AUTH_CONFIG.lockOnBlur) {
      window.addEventListener('blur', () => {
        if (this.state.authenticated) {
          this.lock('Window lost focus');
        }
      });
    }
    
    if (AUTH_CONFIG.lockOnVisibilityChange) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state.authenticated) {
          this.lock('Tab hidden');
        }
      });
    }
    
    this.instantLockListenersBound = true;
  }

  // ==================== STATE MANAGEMENT ====================

  async loadState() {
    const storedFaceEnabled = this.parseStoredBoolean(localStorage.getItem(AUTH_STORAGE_KEYS.faceAuthEnabled));
    const legacyFaceEnabled = this.parseStoredBoolean(localStorage.getItem('aura.face-auth-enabled.v1'));
    this.state.faceAuthEnabled = storedFaceEnabled ?? legacyFaceEnabled ?? false;
    this.state.faceDescriptors = await this.loadFaceDescriptors();
    this.state.pinSet = !!localStorage.getItem(AUTH_STORAGE_KEYS.pinHash);
    this.state.pinAttempts = this.parseStoredInteger(localStorage.getItem(AUTH_STORAGE_KEYS.pinAttempts), 0);
    this.state.pinLockoutUntil = this.parseStoredInteger(localStorage.getItem(AUTH_STORAGE_KEYS.pinLockoutUntil), 0);
    this.state.lastActivity = this.parseStoredInteger(localStorage.getItem(AUTH_STORAGE_KEYS.lastActivity), Date.now());
    this.state.enrolledUser = localStorage.getItem(AUTH_STORAGE_KEYS.enrolledUser);
    
    // Fingerprint
    this.state.fingerprintEnabled = this.parseStoredBoolean(localStorage.getItem(AUTH_STORAGE_KEYS.fingerprintEnabled)) ?? false;
    this.state.fingerprintCredentialId = localStorage.getItem(AUTH_STORAGE_KEYS.fingerprintCredentialId);
    
    // Iris/Eye scanning
    this.state.irisAuthEnabled = this.parseStoredBoolean(localStorage.getItem(AUTH_STORAGE_KEYS.irisAuthEnabled)) ?? false;
    this.state.irisDescriptors = await this.loadIrisDescriptors();
    
    if (this.state.faceDescriptors.length > 0) {
      this.state.enrolledFaceDescriptor = this.averageDescriptors(this.state.faceDescriptors);
      if (this.state.faceAuthEnabled) {
        localStorage.setItem(AUTH_STORAGE_KEYS.faceAuthEnabled, 'true');
      }
    }
    
    if (this.state.irisDescriptors.length > 0) {
      this.state.enrolledIrisDescriptor = this.averageDescriptors(this.state.irisDescriptors);
      if (this.state.irisAuthEnabled) {
        localStorage.setItem(AUTH_STORAGE_KEYS.irisAuthEnabled, 'true');
      }
    }
  }

  async loadFaceDescriptors() {
    const payload = localStorage.getItem(AUTH_STORAGE_KEYS.faceDescriptors);
    let descriptors = [];

    if (payload) {
      try {
        descriptors = await this.decryptData(payload, 'aura:face-descriptors:v2');
      } catch (error) {
        if (error.message && error.message.includes('Encryption key not initialized')) {
          console.debug('Encrypted face descriptors unavailable - will load after authentication');
        } else {
          console.warn('Failed to load stored face descriptors:', error);
        }
      }
    }

    descriptors = this.normalizeDescriptors(descriptors);
    return descriptors;
  }

  async loadIrisDescriptors() {
    const payload = localStorage.getItem(AUTH_STORAGE_KEYS.irisDescriptors);
    let descriptors = [];

    if (payload) {
      try {
        descriptors = await this.decryptData(payload, 'aura:iris-descriptors:v2');
      } catch (error) {
        if (error.message && error.message.includes('Encryption key not initialized')) {
          console.debug('Encrypted iris descriptors unavailable - will load after authentication');
        } else {
          console.warn('Failed to load stored iris descriptors:', error);
        }
      }
    }

    descriptors = this.normalizeDescriptors(descriptors);
    return descriptors;
  }

  async loadEncryptedDescriptors() {
    this.state.faceDescriptors = await this.loadFaceDescriptors();
    this.state.enrolledFaceDescriptor = this.state.faceDescriptors.length > 0
      ? this.averageDescriptors(this.state.faceDescriptors)
      : null;
    this.state.irisDescriptors = await this.loadIrisDescriptors();
    this.state.enrolledIrisDescriptor = this.state.irisDescriptors.length > 0
      ? this.averageDescriptors(this.state.irisDescriptors)
      : null;
  }

  parseStoredBoolean(value) {
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(value) === true;
    } catch {
      return value === 'true';
    }
  }

  parseStoredInteger(value, fallback) {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  normalizeDescriptors(descriptors) {
    if (!Array.isArray(descriptors)) return [];
    return descriptors
      .map((descriptor) => Array.from(descriptor || []).map(Number))
      .filter((descriptor) => descriptor.length === 128 && descriptor.every(Number.isFinite));
  }

  saveState() {
    localStorage.setItem(AUTH_STORAGE_KEYS.faceAuthEnabled, JSON.stringify(this.state.faceAuthEnabled));
    localStorage.setItem(AUTH_STORAGE_KEYS.pinAttempts, this.state.pinAttempts.toString());
    localStorage.setItem(AUTH_STORAGE_KEYS.pinLockoutUntil, this.state.pinLockoutUntil.toString());
    localStorage.setItem(AUTH_STORAGE_KEYS.lastActivity, this.state.lastActivity.toString());
    if (this.state.enrolledUser) {
      localStorage.setItem(AUTH_STORAGE_KEYS.enrolledUser, this.state.enrolledUser);
    }
    if (this.encryptionSalt) {
      localStorage.setItem(AUTH_STORAGE_KEYS.encryptionSalt, this.bytesToBase64(this.encryptionSalt));
    }
    console.log('[Auth] saveState - faceAuthEnabled:', this.state.faceAuthEnabled, 'key:', AUTH_STORAGE_KEYS.faceAuthEnabled);
  }

  async saveFaceDescriptors(descriptors = this.state.faceDescriptors) {
    const normalized = this.normalizeDescriptors(descriptors);
    this.state.faceDescriptors = normalized;
    this.state.enrolledFaceDescriptor = normalized.length > 0 ? this.averageDescriptors(normalized) : null;

    if (normalized.length === 0) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.faceDescriptors);
      console.log('[Auth] Removed face descriptors from storage');
      return;
    }

    const encrypted = await this.encryptData(normalized, 'aura:face-descriptors:v2');
    localStorage.setItem(AUTH_STORAGE_KEYS.faceDescriptors, encrypted);
    console.log('[Auth] Saved encrypted face descriptors to:', AUTH_STORAGE_KEYS.faceDescriptors);
  }

  async saveIrisDescriptors(descriptors = this.state.irisDescriptors) {
    const normalized = this.normalizeDescriptors(descriptors);
    this.state.irisDescriptors = normalized;
    this.state.enrolledIrisDescriptor = normalized.length > 0 ? this.averageDescriptors(normalized) : null;

    if (normalized.length === 0) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.irisDescriptors);
      return;
    }

    const encrypted = await this.encryptData(normalized, 'aura:iris-descriptors:v2');
    localStorage.setItem(AUTH_STORAGE_KEYS.irisDescriptors, encrypted);
  }


  // ==================== ENCRYPTION ====================

  async initEncryption(userSecret = null) {
    const saltB64 = localStorage.getItem(AUTH_STORAGE_KEYS.encryptionSalt);
    if (saltB64) {
      this.encryptionSalt = this.base64ToBytes(saltB64);
    } else {
      this.encryptionSalt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(AUTH_STORAGE_KEYS.encryptionSalt, this.bytesToBase64(this.encryptionSalt));
    }
    
    if (!userSecret) {
      this.cryptoKey = null;
      return;
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(userSecret),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.encryptionSalt,
        iterations: AUTH_CONFIG.pbkdf2Iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: AUTH_CONFIG.encryptionAlgorithm, length: AUTH_CONFIG.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptData(data, aad = '') {
    if (!this.cryptoKey) throw new Error('Encryption key not initialized. Authenticate first.');
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const aadBuffer = new TextEncoder().encode(aad);
    const encrypted = await crypto.subtle.encrypt(
      { name: AUTH_CONFIG.encryptionAlgorithm, iv, additionalData: aadBuffer },
      this.cryptoKey,
      encoded
    );
    const version = new Uint8Array([AUTH_CONFIG.encryptionVersion]);
    return this.bytesToBase64(new Uint8Array([...version, ...iv, ...new Uint8Array(encrypted)]));
  }

  async decryptData(encryptedB64, aad = '') {
    if (!this.cryptoKey) throw new Error('Encryption key not initialized. Authenticate first.');
    
    const combined = this.base64ToBytes(encryptedB64);
    if (combined.length < 13) throw new Error('Invalid ciphertext: too short');
    
    const version = combined[0];
    if (version !== AUTH_CONFIG.encryptionVersion) {
      throw new Error(`Unsupported encryption version: ${version}. Expected ${AUTH_CONFIG.encryptionVersion}`);
    }
    
    const iv = combined.slice(1, 13);
    const data = combined.slice(13);
    const aadBuffer = new TextEncoder().encode(aad);
    const decrypted = await crypto.subtle.decrypt(
      { name: AUTH_CONFIG.encryptionAlgorithm, iv, additionalData: aadBuffer },
      this.cryptoKey,
      data
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  // ==================== PIN AUTHENTICATION ====================

  async setPin(pin) {
    if (!this.validatePin(pin)) throw new Error('Invalid PIN format');
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await this.hashPin(pin, salt);
    
    localStorage.setItem(AUTH_STORAGE_KEYS.pinHash, this.bytesToBase64(hash));
    localStorage.setItem(AUTH_STORAGE_KEYS.pinSalt, this.bytesToBase64(salt));
    this.state.pinSet = true;
    this.state.pinAttempts = 0;
    this.state.pinLockoutUntil = 0;
    this.saveState();
    
    await this.initEncryption(pin);
  }

  async verifyPin(pin) {
    if (this.state.pinLockoutUntil > Date.now()) {
      const remaining = Math.ceil((this.state.pinLockoutUntil - Date.now()) / 1000 / 60);
      throw new Error(`PIN locked. Try again in ${remaining} minutes.`);
    }

    const saltB64 = localStorage.getItem(AUTH_STORAGE_KEYS.pinSalt);
    const hashB64 = localStorage.getItem(AUTH_STORAGE_KEYS.pinHash);
    if (!saltB64 || !hashB64) throw new Error('PIN not set');

    const salt = this.base64ToBytes(saltB64);
    const storedHash = this.base64ToBytes(hashB64);
    const inputHash = await this.hashPin(pin, salt);

    const match = this.constantTimeCompare(inputHash, storedHash);
    
    if (match) {
      this.state.pinAttempts = 0;
      this.state.pinLockoutUntil = 0;
      this.saveState();
      
      await this.initEncryption(pin);
      
      return true;
    } else {
      this.state.pinAttempts++;
      if (this.state.pinAttempts >= AUTH_CONFIG.pinMaxAttempts) {
        this.state.pinLockoutUntil = Date.now() + AUTH_CONFIG.pinLockoutDuration;
      }
      this.saveState();
      throw new Error(`Incorrect PIN. ${AUTH_CONFIG.pinMaxAttempts - this.state.pinAttempts} attempts remaining.`);
    }
  }

  async hashPin(pin, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: AUTH_CONFIG.pbkdf2Iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    ));
  }

  validatePin(pin) {
    return /^\d{4,8}$/.test(pin);
  }

  constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
    return result === 0;
  }

  // ==================== FACE RECOGNITION ====================

  async enrollFace(videoElement, onProgress) {
    if (!window.faceapi) throw new Error('face-api.js not loaded');
    await this.waitForVideoReady(videoElement);
    
    const samples = [];
    const maxSamples = AUTH_CONFIG.maxEnrollSamples;
    const maxAttempts = AUTH_CONFIG.maxEnrollAttempts;
    let message = 'Center your face in the frame';
    
    for (let attempt = 1; samples.length < maxSamples && attempt <= maxAttempts; attempt++) {
      onProgress?.({
        phase: 'enroll',
        captured: samples.length,
        total: maxSamples,
        attempt,
        maxAttempts,
        progress: samples.length / maxSamples,
        message,
      });

      const detection = await this.detectFaceWithLandmarks(videoElement, { requireSingleFace: true });
      if (!detection) {
        message = this.lastDetectionIssue || 'No face detected';
        await this.sleep(AUTH_CONFIG.enrollmentSampleDelay);
        continue;
      }

      const quality = this.evaluateFaceQuality(detection, videoElement);
      if (!quality.passed) {
        message = quality.message;
        await this.sleep(AUTH_CONFIG.enrollmentSampleDelay);
        continue;
      }

      if (samples.length > 0) {
        const average = this.averageDescriptors(samples);
        const distance = this.descriptorDistance(detection.descriptor, average);
        if (distance > AUTH_CONFIG.maxEnrollSampleDistance) {
          message = 'Face changed between samples. Keep only your face visible.';
          await this.sleep(AUTH_CONFIG.enrollmentSampleDelay);
          continue;
        }
      }
      
      samples.push(Array.from(detection.descriptor));
      message = 'Captured sample ' + samples.length + '/' + maxSamples;
      onProgress?.({
        phase: 'enroll',
        captured: samples.length,
        total: maxSamples,
        attempt,
        maxAttempts,
        progress: samples.length / maxSamples,
        message,
        quality,
      });
      await this.sleep(AUTH_CONFIG.enrollmentSampleDelay);
    }
    
    if (samples.length < AUTH_CONFIG.minEnrollSamples) {
      throw new Error('Only captured ' + samples.length + ' reliable samples. Improve lighting and try again.');
    }
    
    this.state.faceDescriptors = samples;
    this.state.enrolledFaceDescriptor = this.averageDescriptors(samples);
    this.state.faceAuthEnabled = true;
    await this.initEncryption('aura-biometric-secret');
    console.log('[Auth] Enrolling face, saving descriptors...');
    await this.saveFaceDescriptors();
    console.log('[Auth] Face descriptors saved, saving state...');
    this.saveState();
    console.log('[Auth] Face enrollment complete');
    
    return { success: true, samples: samples.length };
  }

  async authenticateFace(videoElement, options = {}) {
    const requireLiveness = typeof options === 'boolean' ? options : options.requireLiveness !== false;
    const onProgress = typeof options === 'object' ? options.onProgress : null;

    if (!this.state.faceAuthEnabled || this.state.faceDescriptors.length === 0) {
      return { success: true, method: 'none' };
    }

    if (!this.state.enrolledFaceDescriptor) {
      this.state.enrolledFaceDescriptor = this.averageDescriptors(this.state.faceDescriptors);
    }

    try {
      await this.waitForVideoReady(videoElement);
    } catch (error) {
      return { success: false, error: error.message, method: 'face' };
    }

    if (requireLiveness && AUTH_CONFIG.livenessEnabled) {
      const livenessResult = await this.runLivenessChallenges(videoElement, onProgress);
      if (!livenessResult.passed) {
        return { success: false, error: 'Liveness check failed', method: 'face' };
      }
    }

    let bestMatch = 0;
    for (let attempt = 1; attempt <= AUTH_CONFIG.authenticationAttempts; attempt++) {
      const detection = await this.detectFaceWithLandmarks(videoElement, { requireSingleFace: true });
      if (!detection) {
        onProgress?.({
          phase: 'matching',
          attempt,
          attempts: AUTH_CONFIG.authenticationAttempts,
          progress: attempt / AUTH_CONFIG.authenticationAttempts,
          confidence: bestMatch,
          message: this.lastDetectionIssue || 'Scanning for face...',
        });
        await this.sleep(AUTH_CONFIG.authenticationRetryDelay);
        continue;
      }

      const quality = this.evaluateFaceQuality(detection, videoElement, { relaxed: true });
      if (!quality.passed) {
        onProgress?.({
          phase: 'matching',
          attempt,
          attempts: AUTH_CONFIG.authenticationAttempts,
          progress: attempt / AUTH_CONFIG.authenticationAttempts,
          confidence: bestMatch,
          message: quality.message,
        });
        await this.sleep(AUTH_CONFIG.authenticationRetryDelay);
        continue;
      }

      const similarity = this.compareDescriptors(detection.descriptor, this.state.enrolledFaceDescriptor);
      bestMatch = Math.max(bestMatch, similarity);
      onProgress?.({
        phase: 'matching',
        attempt,
        attempts: AUTH_CONFIG.authenticationAttempts,
        progress: attempt / AUTH_CONFIG.authenticationAttempts,
        confidence: similarity,
        message: 'Verifying face match (' + Math.round(similarity * 100) + '%)',
      });
      
      if (similarity >= AUTH_CONFIG.faceSimilarityThreshold) {
        this.lastSeenFaceAt = Date.now();
        this.continuousMismatchCount = 0;
        return { success: true, method: 'face', confidence: similarity };
      }

      await this.sleep(AUTH_CONFIG.authenticationRetryDelay);
    }

    return { success: false, error: 'Face not recognized', method: 'face', confidence: bestMatch };
  }

  async detectFaceWithLandmarks(video, options = {}) {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.lastDetectionIssue = 'Camera is still starting';
      return null;
    }

    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: AUTH_CONFIG.minDetectionScore,
    });

    if (options.requireSingleFace) {
      const detections = await faceapi
        .detectAllFaces(video, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      this.drawFaceDetections(video, detections, options.draw !== false);

      if (detections.length === 0) {
        this.lastDetectionIssue = 'No face detected';
        return null;
      }
      if (detections.length > 1) {
        this.lastDetectionIssue = 'Only one face should be visible';
        return null;
      }

      this.lastDetectionIssue = '';
      return detections[0];
    }

    const detection = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    this.drawFaceDetections(video, detection ? [detection] : [], options.draw !== false);
    this.lastDetectionIssue = detection ? '' : 'No face detected';
    return detection || null;
  }

  drawFaceDetections(video, detections, shouldDraw = true) {
    const canvas = document.getElementById('face-auth-canvas');
    if (!canvas || !shouldDraw) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;
    faceapi.draw.drawDetections(canvas, detections);
    faceapi.draw.drawFaceLandmarks(canvas, detections);
  }

  evaluateFaceQuality(detection, video, options = {}) {
    const score = detection.detection?.score ?? 1;
    if (score < AUTH_CONFIG.minDetectionScore) {
      return { passed: false, message: 'Improve lighting and face the camera', score };
    }

    const box = detection.detection?.box;
    const width = video?.videoWidth || 0;
    const height = video?.videoHeight || 0;
    if (!box || width === 0 || height === 0) {
      return { passed: true, message: 'Face quality accepted', score };
    }

    const areaRatio = (box.width * box.height) / (width * height);
    if (areaRatio < AUTH_CONFIG.minFaceBoxRatio) {
      return { passed: false, message: 'Move closer to the camera', score, areaRatio };
    }
    if (areaRatio > AUTH_CONFIG.maxFaceBoxRatio) {
      return { passed: false, message: 'Move slightly back from the camera', score, areaRatio };
    }

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const offsetX = Math.abs(centerX - width / 2) / width;
    const offsetY = Math.abs(centerY - height / 2) / height;
    const maxOffset = options.relaxed ? AUTH_CONFIG.maxFaceOffsetRatio + 0.12 : AUTH_CONFIG.maxFaceOffsetRatio;
    if (Math.max(offsetX, offsetY) > maxOffset) {
      return { passed: false, message: 'Center your face in the frame', score, areaRatio, offsetX, offsetY };
    }

    return { passed: true, message: 'Face quality accepted', score, areaRatio, offsetX, offsetY };
  }

  averageDescriptors(descriptors) {
    if (!descriptors || descriptors.length === 0) return null;
    const avg = new Float32Array(128);
    for (const d of descriptors) {
      for (let i = 0; i < 128; i++) avg[i] += Number(d[i]) || 0;
    }
    for (let i = 0; i < 128; i++) avg[i] /= descriptors.length;
    return avg;
  }

  compareDescriptors(d1, d2) {
    if (!d1 || !d2) return 0;
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < 128; i++) {
      const a = Number(d1[i]) || 0;
      const b = Number(d2[i]) || 0;
      dot += a * b;
      norm1 += a * a;
      norm2 += b * b;
    }
    if (norm1 === 0 || norm2 === 0) return 0;
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  descriptorDistance(d1, d2) {
    if (!d1 || !d2) return Infinity;
    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const diff = (Number(d1[i]) || 0) - (Number(d2[i]) || 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  async waitForVideoReady(video) {
    if (!video) throw new Error('Camera unavailable');
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) return;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Camera did not become ready'));
      }, 5000);
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', handleReady);
        video.removeEventListener('playing', handleReady);
      };
      const handleReady = () => {
        if (video.videoWidth > 0) {
          cleanup();
          resolve();
        }
      };
      video.addEventListener('loadedmetadata', handleReady);
      video.addEventListener('playing', handleReady);
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== IRIS/EYE SCANNING ====================

  async enrollIris(videoElement, onProgress) {
    if (!window.faceapi) throw new Error('face-api.js not loaded');
    await this.waitForVideoReady(videoElement);
    
    const samples = [];
    const maxSamples = AUTH_CONFIG.maxIrisEnrollSamples;
    const maxAttempts = AUTH_CONFIG.maxEnrollAttempts;
    let message = 'Center your eyes in the frame. Look directly at the camera.';
    
    for (let attempt = 1; samples.length < maxSamples && attempt <= maxAttempts; attempt++) {
      onProgress?.({
        phase: 'enroll',
        captured: samples.length,
        total: maxSamples,
        attempt,
        maxAttempts,
        progress: samples.length / maxSamples,
        message,
      });

      const detection = await this.detectEyesWithLandmarks(videoElement, { requireSingleFace: true });
      if (!detection) {
        message = this.lastDetectionIssue || 'No eyes detected';
        await this.sleep(AUTH_CONFIG.irisEnrollSampleDelay);
        continue;
      }

      const quality = this.evaluateEyeQuality(detection, videoElement);
      if (!quality.passed) {
        message = quality.message;
        await this.sleep(AUTH_CONFIG.irisEnrollSampleDelay);
        continue;
      }

      if (samples.length > 0) {
        const average = this.averageDescriptors(samples);
        const distance = this.descriptorDistance(detection.irisDescriptor, average);
        if (distance > AUTH_CONFIG.maxEnrollSampleDistance) {
          message = 'Eye position changed between samples. Keep your head still.';
          await this.sleep(AUTH_CONFIG.irisEnrollSampleDelay);
          continue;
        }
      }
      
      samples.push(Array.from(detection.irisDescriptor));
      message = 'Captured sample ' + samples.length + '/' + maxSamples;
      onProgress?.({
        phase: 'enroll',
        captured: samples.length,
        total: maxSamples,
        attempt,
        maxAttempts,
        progress: samples.length / maxSamples,
        message,
        quality,
      });
      await this.sleep(AUTH_CONFIG.irisEnrollSampleDelay);
    }
    
    if (samples.length < AUTH_CONFIG.minIrisEnrollSamples) {
      throw new Error('Only captured ' + samples.length + ' reliable iris samples. Improve lighting and try again.');
    }
    
    this.state.irisDescriptors = samples;
    this.state.enrolledIrisDescriptor = this.averageDescriptors(samples);
    this.state.irisAuthEnabled = true;
    await this.initEncryption('aura-biometric-secret');
    await this.saveIrisDescriptors();
    this.saveState();
    
    return { success: true, samples: samples.length };
  }

  async authenticateIris(videoElement, options = {}) {
    const onProgress = typeof options === 'object' ? options.onProgress : null;

    if (!this.state.irisAuthEnabled || this.state.irisDescriptors.length === 0) {
      return { success: true, method: 'none' };
    }

    if (!this.state.enrolledIrisDescriptor) {
      this.state.enrolledIrisDescriptor = this.averageDescriptors(this.state.irisDescriptors);
    }

    try {
      await this.waitForVideoReady(videoElement);
    } catch (error) {
      return { success: false, error: error.message, method: 'iris' };
    }

    let bestMatch = 0;
    for (let attempt = 1; attempt <= AUTH_CONFIG.irisAuthenticationAttempts; attempt++) {
      const detection = await this.detectEyesWithLandmarks(videoElement, { requireSingleFace: true });
      if (!detection) {
        onProgress?.({
          phase: 'matching',
          attempt,
          attempts: AUTH_CONFIG.irisAuthenticationAttempts,
          progress: attempt / AUTH_CONFIG.irisAuthenticationAttempts,
          confidence: bestMatch,
          message: this.lastDetectionIssue || 'Scanning for eyes...',
        });
        await this.sleep(AUTH_CONFIG.irisAuthenticationRetryDelay);
        continue;
      }

      const quality = this.evaluateEyeQuality(detection, videoElement, { relaxed: true });
      if (!quality.passed) {
        onProgress?.({
          phase: 'matching',
          attempt,
          attempts: AUTH_CONFIG.irisAuthenticationAttempts,
          progress: attempt / AUTH_CONFIG.irisAuthenticationAttempts,
          confidence: bestMatch,
          message: quality.message,
        });
        await this.sleep(AUTH_CONFIG.irisAuthenticationRetryDelay);
        continue;
      }

      const similarity = this.compareDescriptors(detection.irisDescriptor, this.state.enrolledIrisDescriptor);
      bestMatch = Math.max(bestMatch, similarity);
      onProgress?.({
        phase: 'matching',
        attempt,
        attempts: AUTH_CONFIG.irisAuthenticationAttempts,
        progress: attempt / AUTH_CONFIG.irisAuthenticationAttempts,
        confidence: similarity,
        message: 'Verifying iris match (' + Math.round(similarity * 100) + '%)',
      });
      
      if (similarity >= AUTH_CONFIG.irisSimilarityThreshold) {
        return { success: true, method: 'iris', confidence: similarity };
      }

      await this.sleep(AUTH_CONFIG.irisAuthenticationRetryDelay);
    }

    return { success: false, error: 'Iris not recognized', method: 'iris', confidence: bestMatch };
  }

  async detectEyesWithLandmarks(video, options = {}) {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.lastDetectionIssue = 'Camera is still starting';
      return null;
    }

    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: AUTH_CONFIG.minDetectionScore,
    });

    if (options.requireSingleFace) {
      const detections = await faceapi
        .detectAllFaces(video, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      this.drawFaceDetections(video, detections, options.draw !== false);

      if (detections.length === 0) {
        this.lastDetectionIssue = 'No face detected';
        return null;
      }
      if (detections.length > 1) {
        this.lastDetectionIssue = 'Only one face should be visible';
        return null;
      }

      const detection = detections[0];
      const landmarks = detection.landmarks;
      
      // Extract eye regions
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      
      if (!leftEye || !rightEye || leftEye.length === 0 || rightEye.length === 0) {
        this.lastDetectionIssue = 'Eyes not clearly visible';
        return null;
      }

      // Calculate eye bounding boxes
      const leftEyeBox = this.getEyeBoundingBox(leftEye);
      const rightEyeBox = this.getEyeBoundingBox(rightEye);
      
      // Check eye size ratios
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const leftEyeRatio = (leftEyeBox.width * leftEyeBox.height) / (videoWidth * videoHeight);
      const rightEyeRatio = (rightEyeBox.width * rightEyeBox.height) / (videoWidth * videoHeight);
      
      if (leftEyeRatio < AUTH_CONFIG.minEyeBoxRatio || leftEyeRatio > AUTH_CONFIG.maxEyeBoxRatio ||
          rightEyeRatio < AUTH_CONFIG.minEyeBoxRatio || rightEyeRatio > AUTH_CONFIG.maxEyeBoxRatio) {
        this.lastDetectionIssue = 'Eyes too close or too far. Adjust distance.';
        return null;
      }

      // Extract iris descriptors from eye regions
      // We'll use a simplified approach: extract face descriptor from eye region
      // In production, a dedicated iris recognition model would be better
      const irisDescriptor = await this.extractIrisDescriptor(video, leftEyeBox, rightEyeBox);
      
      if (!irisDescriptor) {
        this.lastDetectionIssue = 'Failed to extract iris pattern';
        return null;
      }

      this.lastDetectionIssue = '';
      return {
        ...detection,
        irisDescriptor,
        leftEyeBox,
        rightEyeBox,
      };
    }

    const detection = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    this.drawFaceDetections(video, detection ? [detection] : [], options.draw !== false);
    this.lastDetectionIssue = detection ? '' : 'No face detected';
    return detection || null;
  }

  getEyeBoundingBox(eyePoints) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of eyePoints) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }

  async extractIrisDescriptor(video, leftEyeBox, rightEyeBox) {
    // Create a canvas to extract eye regions
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Use the larger eye region for iris extraction
    const eyeBox = leftEyeBox.width * leftEyeBox.height > rightEyeBox.width * rightEyeBox.height 
      ? leftEyeBox : rightEyeBox;
    
    // Add padding around eye
    const padding = Math.max(eyeBox.width, eyeBox.height) * 0.5;
    const x = Math.max(0, eyeBox.x - padding);
    const y = Math.max(0, eyeBox.y - padding);
    const w = Math.min(video.videoWidth - x, eyeBox.width + padding * 2);
    const h = Math.min(video.videoHeight - y, eyeBox.height + padding * 2);
    
    canvas.width = 160;
    canvas.height = 160;
    
    // Draw the eye region
    ctx.drawImage(video, x, y, w, h, 0, 0, 160, 160);
    
    // Convert to tensor and extract descriptor
    try {
      // Use face-api to detect and extract descriptor from eye region
      // We'll create a temporary detection
      const detection = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (detection && detection.descriptor) {
        return detection.descriptor;
      }
      
      // Fallback: use the full face descriptor from the eye region as iris descriptor
      // This is a simplified approach - in production, use a dedicated iris model
      return null;
    } catch (error) {
      console.warn('Iris extraction failed:', error);
      return null;
    }
  }

  evaluateEyeQuality(detection, video, options = {}) {
    const relaxed = options.relaxed === true;
    const landmarks = detection.landmarks;
    
    if (!landmarks) {
      return { passed: false, message: 'Landmarks not available' };
    }

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    if (!leftEye || !rightEye || leftEye.length === 0 || rightEye.length === 0) {
      return { passed: false, message: 'Eyes not detected' };
    }

    // Check eye openness (vertical distance between eyelids)
    const leftEyeOpenness = this.calculateEyeOpenness(leftEye);
    const rightEyeOpenness = this.calculateEyeOpenness(rightEye);
    const minOpenness = relaxed ? 0.15 : 0.2;
    
    if (leftEyeOpenness < minOpenness || rightEyeOpenness < minOpenness) {
      return { passed: false, message: 'Eyes not open enough' };
    }

    // Check gaze direction (pupil centered)
    const leftGaze = this.calculateGazeDirection(leftEye);
    const rightGaze = this.calculateGazeDirection(rightEye);
    const maxGazeDeviation = relaxed ? 0.3 : 0.2;
    
    if (Math.abs(leftGaze) > maxGazeDeviation || Math.abs(rightGaze) > maxGazeDeviation) {
      return { passed: false, message: 'Look directly at the camera' };
    }

    // Check image quality (blur detection via canvas)
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sharpness = this.calculateSharpness(imageData);
    const minSharpness = relaxed ? 30 : 50;
    
    if (sharpness < minSharpness) {
      return { passed: false, message: 'Image too blurry. Improve lighting.' };
    }

    return { 
      passed: true, 
      message: 'Quality good',
      leftEyeOpenness,
      rightEyeOpenness,
      leftGaze,
      rightGaze,
      sharpness,
    };
  }

  calculateEyeOpenness(eyePoints) {
    // Calculate vertical distance between upper and lower eyelids
    // Eye points: [0-7] are the eye contour
    const topPoints = [eyePoints[1], eyePoints[2]];
    const bottomPoints = [eyePoints[5], eyePoints[6]];
    
    const topY = (topPoints[0].y + topPoints[1].y) / 2;
    const bottomY = (bottomPoints[0].y + bottomPoints[1].y) / 2;
    
    const width = Math.max(...eyePoints.map(p => p.x)) - Math.min(...eyePoints.map(p => p.x));
    const height = bottomY - topY;
    
    return width > 0 ? height / width : 0;
  }

  calculateGazeDirection(eyePoints) {
    // Estimate gaze by pupil position relative to eye corners
    const leftCorner = eyePoints[0];
    const rightCorner = eyePoints[3];
    const eyeWidth = rightCorner.x - leftCorner.x;
    
    if (eyeWidth === 0) return 0;
    
    // Find pupil center (approximate as center of eye points)
    const pupilX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
    const pupilRelativeX = (pupilX - leftCorner.x) / eyeWidth;
    
    // Return deviation from center (0.5 = center)
    return pupilRelativeX - 0.5;
  }

  calculateSharpness(imageData) {
    // Simple Laplacian-based sharpness detection
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let sum = 0;
    let count = 0;
    
    // Sample every 4th pixel for performance
    for (let y = 2; y < height - 2; y += 4) {
      for (let x = 2; x < width - 2; x += 4) {
        const idx = (y * width + x) * 4;
        const center = data[idx] + data[idx + 1] + data[idx + 2];
        
        const up = data[((y - 1) * width + x) * 4] + data[((y - 1) * width + x) * 4 + 1] + data[((y - 1) * width + x) * 4 + 2];
        const down = data[((y + 1) * width + x) * 4] + data[((y + 1) * width + x) * 4 + 1] + data[((y + 1) * width + x) * 4 + 2];
        const left = data[(y * width + (x - 1)) * 4] + data[(y * width + (x - 1)) * 4 + 1] + data[(y * width + (x - 1)) * 4 + 2];
        const right = data[(y * width + (x + 1)) * 4] + data[(y * width + (x + 1)) * 4 + 1] + data[(y * width + (x + 1)) * 4 + 2];
        
        const laplacian = Math.abs(4 * center - up - down - left - right) / 3;
        sum += laplacian;
        count++;
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  // ==================== LIVENESS DETECTION ====================

  async runLivenessChallenges(videoElement, onProgress) {
    const challenges = window.LivenessDetector
      ? new window.LivenessDetector().generateChallenges(AUTH_CONFIG.livenessChallengeCount, AUTH_CONFIG.livenessChallenges)
      : this.shuffleArray([...AUTH_CONFIG.livenessChallenges]).slice(0, AUTH_CONFIG.livenessChallengeCount);
    
    this.state.livenessChallenges = challenges;
    this.state.livenessChallengeIndex = 0;
    this.state.livenessPassed = false;

    for (const challenge of challenges) {
      this.state.currentLivenessChallenge = challenge;
      onProgress?.({
        phase: 'liveness',
        challenge,
        index: this.state.livenessChallengeIndex,
        total: challenges.length,
        progress: this.state.livenessChallengeIndex / challenges.length,
        message: this.getLivenessInstruction(challenge),
      });
      const passed = await this.runSingleLivenessChallenge(videoElement, challenge, onProgress);
      if (!passed) return { passed: false, failedChallenge: challenge };
      this.state.livenessChallengeIndex++;
    }

    this.state.livenessPassed = true;
    onProgress?.({ phase: 'liveness', progress: 1, message: 'Liveness confirmed' });
    return { passed: true };
  }

  async runSingleLivenessChallenge(videoElement, challenge, onProgress) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let bestScore = 0;
      const detector = window.LivenessDetector
        ? new window.LivenessDetector({
            blinkThreshold: AUTH_CONFIG.blinkThreshold,
            gazeThreshold: AUTH_CONFIG.gazeThreshold,
            smileThreshold: AUTH_CONFIG.smileThreshold,
            challengeTimeout: AUTH_CONFIG.livenessChallengeTimeout,
          })
        : null;
      const instruction = detector?.startChallenge(challenge) || this.getLivenessInstruction(challenge);

      const checkInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > AUTH_CONFIG.livenessChallengeTimeout) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        const detection = await this.detectFaceWithLandmarks(videoElement, { requireSingleFace: true });
        if (!detection) {
          onProgress?.({
            phase: 'liveness',
            challenge,
            score: 0,
            progress: elapsed / AUTH_CONFIG.livenessChallengeTimeout,
            message: this.lastDetectionIssue || instruction,
          });
          return;
        }

        const score = this.evaluateLivenessChallenge(detection, challenge, detector);
        bestScore = Math.max(bestScore, score);
        const progress = Math.max(elapsed / AUTH_CONFIG.livenessChallengeTimeout, bestScore);

        onProgress?.({
          phase: 'liveness',
          challenge,
          score,
          progress: Math.min(0.98, progress),
          message: instruction,
        });

        if (window.updateLivenessProgress) {
          window.updateLivenessProgress(challenge, score, { progress, message: instruction });
        }

        if (score >= this.getLivenessThreshold(challenge)) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 200);
    });
  }

  evaluateLivenessChallenge(detection, challenge, detector = null) {
    const landmarks = detection.landmarks;
    if (!landmarks) return 0;

    if (detector) {
      const positions = landmarks.positions || landmarks._positions;
      if (positions) {
        const result = detector.evaluateChallenge(positions, challenge);
        return result.detected ? 1 : Math.min(0.9, result.confidence || 0);
      }
    }

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const mouth = landmarks.getMouth();
    const nose = landmarks.getNose();

    switch (challenge) {
      case 'blink':
        return this.detectBlink(leftEye, rightEye);
      case 'lookLeft':
        return this.detectGaze(leftEye, rightEye, nose, -1);
      case 'lookRight':
        return this.detectGaze(leftEye, rightEye, nose, 1);
      case 'lookUp':
        return this.detectVerticalGaze(leftEye, rightEye, nose, -1);
      case 'lookDown':
        return this.detectVerticalGaze(leftEye, rightEye, nose, 1);
      case 'smile':
        return this.detectSmile(mouth, leftEye, rightEye);
      default:
        return 0;
    }
  }

  detectBlink(leftEye, rightEye) {
    // Eye Aspect Ratio (EAR)
    const ear = (eye) => {
      const v1 = this.dist(eye[1], eye[5]);
      const v2 = this.dist(eye[2], eye[4]);
      const h = this.dist(eye[0], eye[3]);
      return (v1 + v2) / (2 * h);
    };
    
    const leftEAR = ear(leftEye);
    const rightEAR = ear(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;
    
    // Blink detected when EAR drops below threshold
    return avgEAR < AUTH_CONFIG.blinkThreshold ? 1 : 0;
  }

  detectGaze(leftEye, rightEye, nose, direction) {
    // Calculate gaze direction based on iris position relative to eye corners
    const leftEyeCenter = this.eyeCenter(leftEye);
    const rightEyeCenter = this.eyeCenter(rightEye);
    const noseTip = nose[3]; // Nose tip
    
    const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const noseOffsetX = (noseTip.x - eyeMidX) / this.eyeWidth(leftEye);
    
    return direction * noseOffsetX > AUTH_CONFIG.gazeThreshold ? 1 : 0;
  }

  detectVerticalGaze(leftEye, rightEye, nose, direction) {
    const leftEyeCenter = this.eyeCenter(leftEye);
    const rightEyeCenter = this.eyeCenter(rightEye);
    const noseTip = nose[3];
    
    const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    const noseOffsetY = (noseTip.y - eyeMidY) / this.eyeHeight(leftEye);
    
    return direction * noseOffsetY > AUTH_CONFIG.gazeThreshold ? 1 : 0;
  }

  detectSmile(mouth, leftEye, rightEye) {
    const mouthLeft = mouth[0];
    const mouthRight = mouth[6];
    const mouthWidth = this.dist(mouthLeft, mouthRight);
    
    const eyeDistance = this.dist(this.eyeCenter(leftEye), this.eyeCenter(rightEye));
    const smileRatio = mouthWidth / eyeDistance;
    
    return smileRatio > AUTH_CONFIG.smileThreshold ? 1 : 0;
  }

  getLivenessThreshold(challenge) {
    // Return challenge-specific thresholds
    // Binary detectors return 1 (pass) or 0 (fail)
    // External detector returns confidence up to 0.9
    const thresholds = {
      blink: 0.7,
      lookLeft: 0.7,
      lookRight: 0.7,
      lookUp: 0.7,
      lookDown: 0.7,
      smile: 0.7,
    };
    return thresholds[challenge] ?? 0.7;
  }

  getLivenessInstruction(challenge) {
    const instructions = {
      blink: 'Blink once',
      lookLeft: 'Look left',
      lookRight: 'Look right',
      lookUp: 'Look up',
      lookDown: 'Look down',
      smile: 'Smile',
    };
    return instructions[challenge] || 'Follow the prompt';
  }

  // Helper geometry functions
  dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  eyeCenter(eye) {
    const x = eye.reduce((sum, p) => sum + p.x, 0) / eye.length;
    const y = eye.reduce((sum, p) => sum + p.y, 0) / eye.length;
    return { x, y };
  }

  eyeWidth(eye) {
    return this.dist(eye[0], eye[3]);
  }

  eyeHeight(eye) {
    return (this.dist(eye[1], eye[5]) + this.dist(eye[2], eye[4])) / 2;
  }

  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ==================== ACTIVITY TRACKING & AUTO-LOCK ====================

  setupActivityTracking() {
    if (this.activityTrackingBound) return;
    this.activityTrackingBound = true;

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });

    window.addEventListener('blur', () => {
      if (this.state.authenticated && AUTH_CONFIG.lockOnBlur) {
        this.lock('Window focus lost');
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.authenticated && AUTH_CONFIG.lockOnVisibilityChange) {
        this.lock('Tab hidden / minimized');
      }
    });

    window.addEventListener('beforeunload', () => {
      if (this.state.authenticated) {
        this.lock('Page unloading');
      }
    });
  }

  updateActivity() {
    this.state.lastActivity = Date.now();
    localStorage.setItem(AUTH_STORAGE_KEYS.lastActivity, this.state.lastActivity.toString());
    this.resetAutoLockTimer();
  }

  startAutoLockTimer() {
    this.resetAutoLockTimer();
  }

  resetAutoLockTimer() {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = null;
    if (!this.state.authenticated) return;
    this.autoLockTimer = setTimeout(() => this.lock(), AUTH_CONFIG.autoLockTimeout);
  }

  // ==================== CONTINUOUS PROTECTION ====================

  startContinuousProtection() {
    if (!AUTH_CONFIG.continuousProtectionEnabled) return;
    if (this.continuousCheckTimer) clearInterval(this.continuousCheckTimer);
    if (!this.state.authenticated) return;
    
    this.state.continuousProtectionActive = true;
    this.lastSeenFaceAt = Date.now();
    this.continuousMismatchCount = 0;
    this.continuousCheckTimer = setInterval(async () => {
      if (!this.state.authenticated || !this.state.enrolledFaceDescriptor) return;
      
      const video = document.getElementById('face-auth-video');
      if (!video || !video.srcObject) return;

      try {
        const detection = await this.detectFaceWithLandmarks(video, { requireSingleFace: true, draw: false });
        if (!detection) {
          if (this.lastDetectionIssue === 'Only one face should be visible') {
            this.lock('Multiple faces detected');
            return;
          }

          if (Date.now() - this.lastSeenFaceAt > AUTH_CONFIG.noFaceLockGrace) {
            this.lock('Face presence lost');
          }
          return;
        }

        this.lastSeenFaceAt = Date.now();
        const similarity = this.compareDescriptors(detection.descriptor, this.state.enrolledFaceDescriptor);
        if (similarity < AUTH_CONFIG.faceSimilarityThreshold * 0.8) {
          this.continuousMismatchCount++;
          if (this.continuousMismatchCount >= AUTH_CONFIG.continuousMismatchLimit) {
            this.lock('Different face detected');
          }
          return;
        }

        this.continuousMismatchCount = 0;
      } catch (e) {
        // Camera or model errors during background checks should not crash the app.
      }
    }, AUTH_CONFIG.continuousCheckInterval);
  }

  stopContinuousProtection() {
    if (this.continuousCheckTimer) {
      clearInterval(this.continuousCheckTimer);
      this.continuousCheckTimer = null;
    }
    this.state.continuousProtectionActive = false;
  }

  // ==================== SESSION MANAGEMENT ====================

  async authenticate(method = 'face', options = {}) {
    switch (method) {
      case 'face': {
        const result = await this.authenticateFace(options.videoElement, options.requireLiveness !== false);
        if (result.success) {
          await this.initEncryption(this.getUserSecret(options));
          await this.loadEncryptedDescriptors();
        }
        return result;
      }
      case 'pin': {
        if (!options.pin) throw new Error('PIN required');
        const success = await this.verifyPin(options.pin);
        if (success) {
          await this.initEncryption(options.pin);
          await this.loadEncryptedDescriptors();
        }
        return { success, method: 'pin' };
      }
      case 'biometric': {
        const result = await this.authenticateBiometric();
        if (result.success) {
          await this.initEncryption(this.getUserSecret(options));
          await this.loadEncryptedDescriptors();
        }
        return result;
      }
      case 'fingerprint': {
        const result = await this.authenticateFingerprint();
        if (result.success) {
          await this.initEncryption(this.getUserSecret(options));
          await this.loadEncryptedDescriptors();
        }
        return result;
      }
      case 'iris': {
        const result = await this.authenticateIris(options.videoElement, options);
        if (result.success) {
          await this.initEncryption(this.getUserSecret(options));
          await this.loadEncryptedDescriptors();
        }
        return result;
      }
      default:
        throw new Error('Unknown auth method');
    }
  }

  getUserSecret(options) {
    return options.pin || options.userSecret || 'aura-biometric-secret';
  }

  async authenticateFingerprint() {
    if (!window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn not supported' };
    }

    if (!this.state.fingerprintEnabled || !this.state.fingerprintCredentialId) {
      return { success: false, error: 'No fingerprint enrolled' };
    }

    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: AUTH_CONFIG.fingerprintTimeout,
          rpId: window.location.hostname,
          allowCredentials: [{
            id: this.base64ToBytes(this.state.fingerprintCredentialId),
            type: 'public-key',
            transports: ['internal', 'hybrid', 'ble', 'nfc', 'usb'],
          }],
          userVerification: AUTH_CONFIG.fingerprintUserVerification,
        },
      });

      if (credential) {
        this.state.authenticated = true;
        this.state.authMethod = 'fingerprint';
        this.updateActivity();
        return { success: true, method: 'fingerprint' };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
    
    return { success: false, error: 'Fingerprint authentication failed' };
  }

  async enrollFingerprint() {
    if (!window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn not supported' };
    }

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'AURA Assistant',
            id: window.location.hostname,
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: this.state.enrolledUser || 'AURA User',
            displayName: 'AURA Assistant User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            requireResidentKey: false,
          },
          timeout: AUTH_CONFIG.fingerprintTimeout,
          attestation: 'direct',
        },
      });

      if (credential) {
        const credentialId = this.bytesToBase64(new Uint8Array(credential.rawId));
        this.state.fingerprintEnabled = true;
        this.state.fingerprintCredentialId = credentialId;
        localStorage.setItem(AUTH_STORAGE_KEYS.fingerprintEnabled, 'true');
        localStorage.setItem(AUTH_STORAGE_KEYS.fingerprintCredentialId, credentialId);
        this.saveState();
        return { success: true, credentialId };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }

    return { success: false, error: 'Fingerprint enrollment failed' };
  }

  async authenticatePin(pin) {
    if (!window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn not supported' };
    }

    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: 60000,
          rpId: window.location.hostname,
          allowCredentials: [],
          userVerification: 'required',
        },
      });

      if (credential) {
        this.state.authenticated = true;
        this.state.authMethod = 'biometric';
        this.updateActivity();
        return { success: true, method: 'biometric' };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
    
    return { success: false, error: 'No biometric credential found' };
  }

  lock(reason = 'Auto-lock') {
    this.state.authenticated = false;
    this.state.authMethod = null;
    this.cryptoKey = null;
    this.stopContinuousProtection();
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    
    this.notifyActivityListeners('lock', { reason });
    
    // Show lock screen
    if (window.showLockScreen) window.showLockScreen(reason);
  }

  unlock(method) {
    this.state.authenticated = true;
    this.state.authMethod = method;
    this.lastSeenFaceAt = Date.now();
    this.continuousMismatchCount = 0;
    this.updateActivity();
    this.startAutoLockTimer();
    this.startContinuousProtection();
    
    // Enable auto-lock on blur/visibility change after first auth
    this.setupInstantLockListeners();
    
    this.notifyActivityListeners('unlock', { method });
  }

  isAuthenticated() {
    return this.state.authenticated;
  }

  getAuthMethod() {
    return this.state.authMethod;
  }

  hasAnyAuthEnrolled() {
    return this.state.faceAuthEnabled && this.state.faceDescriptors.length > 0
        || this.state.pinSet
        || this.state.fingerprintEnabled
        || this.state.irisAuthEnabled && this.state.irisDescriptors.length > 0;
  }

  // ==================== SENSITIVE ACTION PROTECTION ====================

  requiresReauth(action) {
    const normalized = action.toLowerCase();
    return AUTH_CONFIG.sensitiveActions.some(sensitive => 
      normalized.includes(sensitive.toLowerCase())
    );
  }

  async checkSensitiveAction(action) {
    if (!this.requiresReauth(action)) return { allowed: true };
    
    const lastSensitiveAuth = parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.sensitiveActionTimestamp) || '0');
    const timeSinceLastAuth = Date.now() - lastSensitiveAuth;
    
    // Require re-auth if more than 5 minutes since last sensitive auth
    if (timeSinceLastAuth > 5 * 60 * 1000) {
      return { allowed: false, reason: 'Re-authentication required for sensitive action' };
    }
    
    return { allowed: true };
  }

  async authorizeSensitiveAction(action, authMethod = 'face') {
    const check = await this.checkSensitiveAction(action);
    if (!check.allowed) {
      // Trigger re-auth
      const video = document.getElementById('face-auth-video');
      const result = await this.authenticate(authMethod, { videoElement: video });
      if (result.success) {
        localStorage.setItem(AUTH_STORAGE_KEYS.sensitiveActionTimestamp, Date.now().toString());
        return { allowed: true };
      }
      return { allowed: false, reason: result.error };
    }
    return { allowed: true };
  }

  // ==================== UTILITIES ====================

  bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
  }

  base64ToBytes(b64) {
    return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
  }

  notifyActivityListeners(event, data) {
    this.activityListeners.forEach(cb => cb(event, data));
  }

  onActivityChange(callback) {
    this.activityListeners.add(callback);
    return () => this.activityListeners.delete(callback);
  }

  // ==================== CLEANUP ====================

  clearFaceData() {
    this.state.faceDescriptors = [];
    this.state.enrolledFaceDescriptor = null;
    this.state.faceAuthEnabled = false;
    localStorage.removeItem(AUTH_STORAGE_KEYS.faceDescriptors);
    localStorage.removeItem('aura.face-descriptors.v1');
    localStorage.setItem(AUTH_STORAGE_KEYS.faceAuthEnabled, 'false');
    localStorage.setItem('aura.face-auth-enabled.v1', 'false');
    this.saveState();
  }

  clearPin() {
    localStorage.removeItem(AUTH_STORAGE_KEYS.pinHash);
    localStorage.removeItem(AUTH_STORAGE_KEYS.pinSalt);
    this.state.pinSet = false;
    this.saveState();
  }

  clearAll() {
    this.clearFaceData();
    this.clearPin();
    localStorage.removeItem(AUTH_STORAGE_KEYS.encryptionKey);
    localStorage.removeItem(AUTH_STORAGE_KEYS.encryptionSalt);
    localStorage.removeItem(AUTH_STORAGE_KEYS.enrolledUser);
    localStorage.removeItem(AUTH_STORAGE_KEYS.lastActivity);
    localStorage.removeItem(AUTH_STORAGE_KEYS.sensitiveActionTimestamp);
    this.lock('All auth data cleared');
  }

  destroy() {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.stopContinuousProtection();
  }
}

// Export for module use
window.AuraAuth = AuraAuth;
window.AUTH_CONFIG = AUTH_CONFIG;