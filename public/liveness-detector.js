// Liveness Detection Module for AURA Auth
// Uses face-api.js 68-point face landmarks for blink, gaze, and smile detection

class LivenessDetector {
  constructor(config = {}) {
    this.config = {
      blinkThreshold: config.blinkThreshold || 0.25,
      gazeThreshold: config.gazeThreshold || 0.15,
      smileThreshold: config.smileThreshold || 0.35,
      challengeTimeout: config.challengeTimeout || 5000,
      historySize: config.historySize || 10,
      ...config,
    };

    this.eyeHistory = { left: [], right: [] };
    this.gazeHistory = { horizontal: [], vertical: [] };
    this.mouthHistory = [];
    this.currentChallenge = null;
    this.challengeStartTime = 0;
    this.challengePassed = false;
  }

  // Eye Aspect Ratio (EAR) calculation for blink detection
  calculateEAR(eyeLandmarks) {
    // eyeLandmarks: 6 points [0-5] for each eye
    // Vertical distances
    const v1 = this.distance(eyeLandmarks[1], eyeLandmarks[5]);
    const v2 = this.distance(eyeLandmarks[2], eyeLandmarks[4]);
    // Horizontal distance
    const h = this.distance(eyeLandmarks[0], eyeLandmarks[3]);
    
    return (v1 + v2) / (2.0 * h);
  }

  // Get eye landmarks from 68-point face landmarks
  getEyeLandmarks(landmarks, eye) {
    // Left eye: 36-41, Right eye: 42-47
    const start = eye === 'left' ? 36 : 42;
    return [
      landmarks[start],     // outer corner
      landmarks[start + 1], // upper inner
      landmarks[start + 2], // upper outer
      landmarks[start + 3], // inner corner
      landmarks[start + 4], // lower outer
      landmarks[start + 5], // lower inner
    ];
  }

  // Detect blink using EAR
  detectBlink(landmarks) {
    const leftEAR = this.calculateEAR(this.getEyeLandmarks(landmarks, 'left'));
    const rightEAR = this.calculateEAR(this.getEyeLandmarks(landmarks, 'right'));
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Add to history
    this.eyeHistory.left.push(leftEAR);
    this.eyeHistory.right.push(rightEAR);
    if (this.eyeHistory.left.length > this.config.historySize) {
      this.eyeHistory.left.shift();
      this.eyeHistory.right.shift();
    }

    // Blink detected when EAR drops below threshold
    const isBlinking = avgEAR < this.config.blinkThreshold;
    
    // Detect blink pattern: open -> closed -> open
    const recentLeft = this.eyeHistory.left.slice(-3);
    const recentRight = this.eyeHistory.right.slice(-3);
    
    if (recentLeft.length >= 3) {
      const wasOpen = recentLeft[0] > this.config.blinkThreshold && recentRight[0] > this.config.blinkThreshold;
      const wasClosed = recentLeft[1] < this.config.blinkThreshold && recentRight[1] < this.config.blinkThreshold;
      const isOpenNow = recentLeft[2] > this.config.blinkThreshold && recentRight[2] > this.config.blinkThreshold;
      
      if (wasOpen && wasClosed && isOpenNow) {
        return { detected: true, confidence: 1 - avgEAR };
      }
    }

    return { detected: isBlinking, confidence: 1 - avgEAR, ear: avgEAR };
  }

  // Gaze direction detection (left/right/up/down)
  detectGaze(landmarks) {
    // Eye centers
    const leftEye = this.getEyeCenter(landmarks, 'left');
    const rightEye = this.getEyeCenter(landmarks, 'right');
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    // Nose tip (landmark 30) and nose bridge (landmark 27)
    const noseTip = landmarks[30];
    const noseBridge = landmarks[27];

    // Calculate gaze offset from eye center to nose
    const horizontalOffset = (noseTip.x - eyeCenter.x) / this.getEyeDistance(leftEye, rightEye);
    const verticalOffset = (noseTip.y - eyeCenter.y) / this.getEyeDistance(leftEye, rightEye);

    // Add to history for smoothing
    this.gazeHistory.horizontal.push(horizontalOffset);
    this.gazeHistory.vertical.push(verticalOffset);
    if (this.gazeHistory.horizontal.length > this.config.historySize) {
      this.gazeHistory.horizontal.shift();
      this.gazeHistory.vertical.shift();
    }

    // Smoothed values
    const smoothH = this.gazeHistory.horizontal.reduce((a, b) => a + b, 0) / this.gazeHistory.horizontal.length;
    const smoothV = this.gazeHistory.vertical.reduce((a, b) => a + b, 0) / this.gazeHistory.vertical.length;

    return {
      horizontal: smoothH,  // negative = left, positive = right
      vertical: smoothV,    // negative = up, positive = down
      raw: { horizontal: horizontalOffset, vertical: verticalOffset },
    };
  }

  // Smile detection
  detectSmile(landmarks) {
    // Mouth corners: 48 (left), 54 (right)
    // Upper lip: 51, Lower lip: 57
    // Mouth width vs height ratio
    const mouthLeft = landmarks[48];
    const mouthRight = landmarks[54];
    const upperLip = landmarks[51];
    const lowerLip = landmarks[57];

    const mouthWidth = this.distance(mouthLeft, mouthRight);
    const mouthHeight = this.distance(upperLip, lowerLip);
    const smileRatio = mouthWidth / mouthHeight;

    // Also check mouth corner elevation relative to nose
    const noseTip = landmarks[30];
    const leftCornerElevation = (noseTip.y - mouthLeft.y) / mouthWidth;
    const rightCornerElevation = (noseTip.y - mouthRight.y) / mouthWidth;
    const avgElevation = (leftCornerElevation + rightCornerElevation) / 2;

    this.mouthHistory.push({ smileRatio, avgElevation });
    if (this.mouthHistory.length > this.config.historySize) {
      this.mouthHistory.shift();
    }

    const isSmiling = smileRatio > 1.8 && avgElevation > 0.15;

    return {
      detected: isSmiling,
      confidence: Math.min(1, (smileRatio - 1.8) * 2),
      smileRatio,
      elevation: avgElevation,
    };
  }

  // Challenge evaluation
  evaluateChallenge(landmarks, challengeType) {
    switch (challengeType) {
      case 'blink':
        return this.detectBlink(landmarks);
      
      case 'lookLeft':
        const gazeLeft = this.detectGaze(landmarks);
        return {
          detected: gazeLeft.horizontal < -this.config.gazeThreshold,
          confidence: Math.min(1, Math.abs(gazeLeft.horizontal) / this.config.gazeThreshold),
          value: gazeLeft.horizontal,
        };
      
      case 'lookRight':
        const gazeRight = this.detectGaze(landmarks);
        return {
          detected: gazeRight.horizontal > this.config.gazeThreshold,
          confidence: Math.min(1, Math.abs(gazeRight.horizontal) / this.config.gazeThreshold),
          value: gazeRight.horizontal,
        };
      
      case 'lookUp':
        const gazeUp = this.detectGaze(landmarks);
        return {
          detected: gazeUp.vertical < -this.config.gazeThreshold,
          confidence: Math.min(1, Math.abs(gazeUp.vertical) / this.config.gazeThreshold),
          value: gazeUp.vertical,
        };
      
      case 'lookDown':
        const gazeDown = this.detectGaze(landmarks);
        return {
          detected: gazeDown.vertical > this.config.gazeThreshold,
          confidence: Math.min(1, Math.abs(gazeDown.vertical) / this.config.gazeThreshold),
          value: gazeDown.vertical,
        };
      
      case 'smile':
        return this.detectSmile(landmarks);
      
      default:
        return { detected: false, confidence: 0 };
    }
  }

  // Start a new challenge
  startChallenge(challengeType) {
    this.currentChallenge = challengeType;
    this.challengeStartTime = Date.now();
    this.challengePassed = false;
    this.clearHistory();
    return this.getChallengeInstruction(challengeType);
  }

  // Update challenge progress
  updateChallenge(landmarks) {
    if (!this.currentChallenge) return { active: false };

    const elapsed = Date.now() - this.challengeStartTime;
    const timeout = this.config.challengeTimeout;
    const progress = Math.min(1, elapsed / timeout);

    const result = this.evaluateChallenge(landmarks, this.currentChallenge);
    
    if (result.detected) {
      this.challengePassed = true;
      return { active: false, passed: true, progress: 1, result };
    }

    if (elapsed >= timeout) {
      return { active: false, passed: false, progress: 1, timeout: true };
    }

    return { active: true, passed: false, progress, result };
  }

  // Get instruction text for challenge
  getChallengeInstruction(type) {
    const instructions = {
      blink: 'Blink naturally',
      lookLeft: 'Look to the left',
      lookRight: 'Look to the right',
      lookUp: 'Look up',
      lookDown: 'Look down',
      smile: 'Smile',
    };
    return instructions[type] || 'Follow the instruction';
  }

  // Generate random challenge sequence
  generateChallenges(count, availableChallenges = ['blink', 'lookLeft', 'lookRight', 'lookUp', 'lookDown', 'smile']) {
    const challenges = [...availableChallenges];
    // Ensure blink is always included
    const selected = ['blink'];
    challenges.splice(challenges.indexOf('blink'), 1);
    
    for (let i = 1; i < count && challenges.length > 0; i++) {
      const idx = Math.floor(Math.random() * challenges.length);
      selected.push(challenges.splice(idx, 1)[0]);
    }
    
    return selected;
  }

  // Utility methods
  distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  getEyeCenter(landmarks, eye) {
    const eyeLandmarks = this.getEyeLandmarks(landmarks, eye);
    const x = eyeLandmarks.reduce((sum, p) => sum + p.x, 0) / 6;
    const y = eyeLandmarks.reduce((sum, p) => sum + p.y, 0) / 6;
    return { x, y };
  }

  getEyeDistance(left, right) {
    return Math.hypot(left.x - right.x, left.y - right.y);
  }

  clearHistory() {
    this.eyeHistory = { left: [], right: [] };
    this.gazeHistory = { horizontal: [], vertical: [] };
    this.mouthHistory = [];
  }

  reset() {
    this.currentChallenge = null;
    this.challengePassed = false;
    this.clearHistory();
  }
}

// Export
window.LivenessDetector = LivenessDetector;