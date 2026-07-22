// AURA Enhanced Authentication Module
// Adds: Liveness detection, PIN fallback, encryption, auto-lock, continuous protection

const AUTH_CONFIG = {
  // Face recognition
  faceSimilarityThreshold: 0.65,
  maxEnrollSamples: 5,
  
  // Liveness detection
  livenessEnabled: true,
  livenessChallenges: ['blink', 'lookLeft', 'lookRight', 'lookUp', 'lookDown', 'smile'],
  livenessChallengeCount: 3,
  livenessChallengeTimeout: 5000,
  blinkThreshold: 0.25,
  gazeThreshold: 0.15,
  smileThreshold: 0.35,
  
  // PIN
  pinLength: { min: 4, max: 8 },
  pinMaxAttempts: 5,
  pinLockoutDuration: 15 * 60 * 1000,
  
  // Encryption
  encryptionAlgorithm: 'AES-GCM',
  keyLength: 256,
  pbkdf2Iterations: 100000,
  
  // Session
  autoLockTimeout: 5 * 60 * 1000,
  continuousProtectionEnabled: true,
  continuousCheckInterval: 2000,
  
  // Sensitive actions requiring re-auth
  sensitiveActions: [
    'password', 'api key', 'apikey', 'secret', 'token',
    'financial', 'payment', 'transfer', 'withdraw', 'deposit',
    'delete account', 'export data', 'reset', 'clear all'
  ],
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
    };
    
    this.cryptoKey = null;
    this.encryptionSalt = null;
    this.autoLockTimer = null;
    this.continuousCheckTimer = null;
    this.activityListeners = new Set();
    this.sensitiveActionCallback = null;
  }

  async init() {
    await this.loadState();
    await this.initEncryption();
    this.setupActivityTracking();
    this.startAutoLockTimer();
    this.startContinuousProtection();
  }

  // ==================== STATE MANAGEMENT ====================

  async loadState() {
    this.state.faceAuthEnabled = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEYS.faceAuthEnabled) || 'false');
    this.state.faceDescriptors = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEYS.faceDescriptors) || '[]');
    this.state.pinSet = !!localStorage.getItem(AUTH_STORAGE_KEYS.pinHash);
    this.state.pinAttempts = parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.pinAttempts) || '0');
    this.state.pinLockoutUntil = parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.pinLockoutUntil) || '0');
    this.state.lastActivity = parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.lastActivity) || Date.now());
    this.state.enrolledUser = localStorage.getItem(AUTH_STORAGE_KEYS.enrolledUser);
    
    if (this.state.faceDescriptors.length > 0) {
      this.state.enrolledFaceDescriptor = this.averageDescriptors(this.state.faceDescriptors);
    }
  }

  saveState() {
    localStorage.setItem(AUTH_STORAGE_KEYS.faceAuthEnabled, JSON.stringify(this.state.faceAuthEnabled));
    localStorage.setItem(AUTH_STORAGE_KEYS.faceDescriptors, JSON.stringify(this.state.faceDescriptors));
    localStorage.setItem(AUTH_STORAGE_KEYS.pinAttempts, this.state.pinAttempts.toString());
    localStorage.setItem(AUTH_STORAGE_KEYS.pinLockoutUntil, this.state.pinLockoutUntil.toString());
    localStorage.setItem(AUTH_STORAGE_KEYS.lastActivity, this.state.lastActivity.toString());
    if (this.state.enrolledUser) {
      localStorage.setItem(AUTH_STORAGE_KEYS.enrolledUser, this.state.enrolledUser);
    }
    if (this.encryptionSalt) {
      localStorage.setItem(AUTH_STORAGE_KEYS.encryptionSalt, this.bytesToBase64(this.encryptionSalt));
    }
  }

  // ==================== ENCRYPTION ====================

  async initEncryption() {
    const saltB64 = localStorage.getItem(AUTH_STORAGE_KEYS.encryptionSalt);
    if (saltB64) {
      this.encryptionSalt = this.base64ToBytes(saltB64);
    } else {
      this.encryptionSalt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(AUTH_STORAGE_KEYS.encryptionSalt, this.bytesToBase64(this.encryptionSalt));
    }
    
    // Derive key from device-specific entropy + stored salt
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encryptionSalt,
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

  async encryptData(data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt(
      { name: AUTH_CONFIG.encryptionAlgorithm, iv },
      this.cryptoKey,
      encoded
    );
    return this.bytesToBase64(new Uint8Array([...iv, ...new Uint8Array(encrypted)]));
  }

  async decryptData(encryptedB64) {
    const combined = this.base64ToBytes(encryptedB64);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: AUTH_CONFIG.encryptionAlgorithm, iv },
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
    
    const samples = [];
    const maxSamples = AUTH_CONFIG.maxEnrollSamples;
    
    for (let i = 0; i < maxSamples; i++) {
      if (onProgress) onProgress(i + 1, maxSamples);
      
      const detection = await this.detectFaceWithLandmarks(videoElement);
      if (!detection) {
        i--;
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      
      samples.push(detection.descriptor);
      await new Promise(r => setTimeout(r, 600));
    }
    
    if (samples.length === 0) throw new Error('No face captured');
    
    // Average the descriptors
    const avgDescriptor = this.averageDescriptors(samples);
    this.state.faceDescriptors.push(Array.from(avgDescriptor));
    this.state.enrolledFaceDescriptor = avgDescriptor;
    this.saveState();
    
    // Encrypt and store
    const encrypted = await this.encryptData(this.state.faceDescriptors);
    localStorage.setItem(AUTH_STORAGE_KEYS.faceDescriptors, encrypted);
    
    this.state.faceAuthEnabled = true;
    localStorage.setItem(AUTH_STORAGE_KEYS.faceAuthEnabled, 'true');
    this.saveState();
    
    return true;
  }

  async authenticateFace(videoElement, requireLiveness = true) {
    if (!this.state.faceAuthEnabled || this.state.faceDescriptors.length === 0) {
      return { success: true, method: 'none' };
    }

    // Run liveness detection first
    if (requireLiveness && AUTH_CONFIG.livenessEnabled) {
      const livenessResult = await this.runLivenessChallenges(videoElement);
      if (!livenessResult.passed) {
        return { success: false, error: 'Liveness check failed', method: 'face' };
      }
    }

    // Face recognition
    const detection = await this.detectFaceWithLandmarks(videoElement);
    if (!detection) return { success: false, error: 'No face detected', method: 'face' };

    const similarity = this.compareDescriptors(detection.descriptor, this.state.enrolledFaceDescriptor);
    
    if (similarity >= AUTH_CONFIG.faceSimilarityThreshold) {
      return { success: true, method: 'face', confidence: similarity };
    }

    return { success: false, error: 'Face not recognized', method: 'face', confidence: similarity };
  }

  async detectFaceWithLandmarks(video) {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ 
        inputSize: 320, 
        scoreThreshold: 0.5 
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    if (!detection) return null;
    
    // Draw landmarks for visual feedback
    const canvas = document.getElementById('face-auth-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawFaceLandmarks(canvas, detection);
    }
    
    return detection;
  }

  averageDescriptors(descriptors) {
    const avg = new Float32Array(128);
    for (const d of descriptors) {
      for (let i = 0; i < 128; i++) avg[i] += d[i];
    }
    for (let i = 0; i < 128; i++) avg[i] /= descriptors.length;
    return avg;
  }

  compareDescriptors(d1, d2) {
    // Cosine similarity
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < 128; i++) {
      dot += d1[i] * d2[i];
      norm1 += d1[i] * d1[i];
      norm2 += d2[i] * d2[i];
    }
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // ==================== LIVENESS DETECTION ====================

  async runLivenessChallenges(videoElement) {
    const challenges = this.shuffleArray([...AUTH_CONFIG.livenessChallenges])
      .slice(0, AUTH_CONFIG.livenessChallengeCount);
    
    this.state.livenessChallenges = challenges;
    this.state.livenessChallengeIndex = 0;
    this.state.livenessPassed = false;

    for (const challenge of challenges) {
      this.state.currentLivenessChallenge = challenge;
      const passed = await this.runSingleLivenessChallenge(videoElement, challenge);
      if (!passed) return { passed: false, failedChallenge: challenge };
      this.state.livenessChallengeIndex++;
    }

    this.state.livenessPassed = true;
    return { passed: true };
  }

  async runSingleLivenessChallenge(videoElement, challenge) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let passed = false;
      let bestScore = 0;

      const checkInterval = setInterval(async () => {
        if (Date.now() - startTime > AUTH_CONFIG.livenessChallengeTimeout) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        const detection = await this.detectFaceWithLandmarks(videoElement);
        if (!detection) return;

        const score = this.evaluateLivenessChallenge(detection, challenge);
        bestScore = Math.max(bestScore, score);

        // Update UI with progress
        if (window.updateLivenessProgress) {
          window.updateLivenessProgress(challenge, score);
        }

        if (score >= this.getLivenessThreshold(challenge)) {
          passed = true;
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 200);
    });
  }

  evaluateLivenessChallenge(detection, challenge) {
    const landmarks = detection.landmarks;
    if (!landmarks) return 0;

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
    switch (challenge) {
      case 'blink': return AUTH_CONFIG.blinkThreshold;
      case 'lookLeft':
      case 'lookRight':
      case 'lookUp':
      case 'lookDown': return AUTH_CONFIG.gazeThreshold;
      case 'smile': return AUTH_CONFIG.smileThreshold;
      default: return 0.5;
    }
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
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
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
    this.autoLockTimer = setTimeout(() => this.lock(), AUTH_CONFIG.autoLockTimeout);
  }

  // ==================== CONTINUOUS PROTECTION ====================

  startContinuousProtection() {
    if (!AUTH_CONFIG.continuousProtectionEnabled) return;
    if (this.continuousCheckTimer) clearInterval(this.continuousCheckTimer);
    
    this.state.continuousProtectionActive = true;
    this.continuousCheckTimer = setInterval(async () => {
      if (!this.state.authenticated) return;
      
      const video = document.getElementById('face-auth-video');
      if (!video || video.hidden) return;

      try {
        const detection = await this.detectFaceWithLandmarks(video);
        if (detection && this.state.enrolledFaceDescriptor) {
          const similarity = this.compareDescriptors(detection.descriptor, this.state.enrolledFaceDescriptor);
          if (similarity < AUTH_CONFIG.faceSimilarityThreshold * 0.8) {
            // Different face detected
            this.lock('Different face detected');
            return;
          }
        }
      } catch (e) {
        // Ignore detection errors during continuous check
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
      case 'face':
        return this.authenticateFace(options.videoElement, options.requireLiveness !== false);
      case 'pin':
        return this.authenticatePin(options.pin);
      case 'biometric':
        return this.authenticateBiometric();
      default:
        throw new Error('Unknown auth method');
    }
  }

  async authenticatePin(pin) {
    const verified = await this.verifyPin(pin);
    if (verified) {
      this.state.authenticated = true;
      this.state.authMethod = 'pin';
      this.updateActivity();
      return { success: true, method: 'pin' };
    }
    return { success: false, error: 'Invalid PIN' };
  }

  async authenticateBiometric() {
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
    this.stopContinuousProtection();
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    
    this.notifyActivityListeners('lock', { reason });
    
    // Show lock screen
    if (window.showLockScreen) window.showLockScreen(reason);
  }

  unlock(method) {
    this.state.authenticated = true;
    this.state.authMethod = method;
    this.updateActivity();
    this.startAutoLockTimer();
    this.startContinuousProtection();
    
    this.notifyActivityListeners('unlock', { method });
  }

  isAuthenticated() {
    return this.state.authenticated;
  }

  getAuthMethod() {
    return this.state.authMethod;
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
    localStorage.setItem(AUTH_STORAGE_KEYS.faceAuthEnabled, 'false');
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