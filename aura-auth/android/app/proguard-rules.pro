# ProGuard rules for AURA Auth

# Keep Flutter and plugin classes
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep Kotlin classes
-keep class kotlin.** { *; }

# Keep CameraX classes
-keep class androidx.camera.** { *; }

# Keep Biometric classes
-keep class androidx.biometric.** { *; }

# Keep Security Crypto classes
-keep class androidx.security.crypto.** { *; }

# Keep WorkManager classes
-keep class androidx.work.** { *; }

# Keep PointyCastle classes for encryption
-keep class org.bouncycastle.** { *; }
-keep class org.spongycastle.** { *; }

# Keep encrypt package
-keep class com.github.encrypt.** { *; }

# Keep Flutter Secure Storage
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# Keep local_auth
-keep class com.baseflow.localauth.** { *; }

# Keep tflite_flutter
-keep class com.google.mlkit.** { *; }
-keep class org.tensorflow.lite.** { *; }

# Keep our app classes
-keep class com.aura.auth.** { *; }

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod

# Optimize
-optimizationpasses 5
-allowaccessmodification
-overloadaggressively

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}