package com.aura.auth

import android.os.Bundle
import android.content.pm.PackageManager
import android.content.Context
import androidx.core.content.ContextCompat
import androidx.core.app.ActivityCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugins.GeneratedPluginRegistrant
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.EventChannel
import android.hardware.camera2.CameraManager
import android.util.Log

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.aura.auth/native"
    private val CAMERA_PERMISSION_REQUEST = 100
    private val BIOMETRIC_PERMISSION_REQUEST = 101

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        GeneratedPluginRegistrant.registerWith(flutterEngine)
        
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "checkCameraPermission" -> {
                    val granted = ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    result.success(granted)
                }
                "requestCameraPermission" -> {
                    ActivityCompat.requestPermissions(this, arrayOf(android.Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST)
                    result.success(true)
                }
                "checkBiometricPermission" -> {
                    val granted = ContextCompat.checkSelfPermission(this, android.Manifest.permission.USE_BIOMETRIC) == PackageManager.PERMISSION_GRANTED
                    result.success(granted)
                }
                "isDeviceRooted" -> {
                    result.success(false) // Simplified
                }
                "getDeviceInfo" -> {
                    result.success(mapOf(
                        "model" to android.os.Build.MODEL,
                        "manufacturer" to android.os.Build.MANUFACTURER,
                        "androidVersion" to android.os.Build.VERSION.RELEASE,
                        "sdkInt" to android.os.Build.VERSION.SDK_INT
                    ))
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            CAMERA_PERMISSION_REQUEST -> {
                val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
                // Notify Flutter
            }
        }
    }
}