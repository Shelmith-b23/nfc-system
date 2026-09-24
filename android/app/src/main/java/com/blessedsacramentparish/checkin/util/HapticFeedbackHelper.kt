package com.blessedsacramentparish.checkin.util

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.CombinedVibration
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Provides immediate physical haptic and audio feedback for the gate scanner operator.
 */
class HapticFeedbackHelper(context: Context) {

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibratorManager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    private var toneGenerator: ToneGenerator? = try {
        ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
    } catch (e: Exception) {
        null
    }

    /**
     * Short, crisp positive haptic pulse for successful card check-in.
     */
    fun performSuccess() {
        vibrate(longArrayOf(0, 70), intArrayOf(0, 255))
        try {
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
        } catch (ignored: Exception) {}
    }

    /**
     * Distinct double-pulse haptic feedback for already checked-in duplicate tap.
     */
    fun performDuplicate() {
        vibrate(longArrayOf(0, 60, 80, 60), intArrayOf(0, 200, 0, 200))
        try {
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 180)
        } catch (ignored: Exception) {}
    }

    /**
     * Heavy error buzz for rejected or unrecognized cards.
     */
    fun performError() {
        vibrate(longArrayOf(0, 200), intArrayOf(0, 255))
        try {
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_NACK, 250)
        } catch (ignored: Exception) {}
    }

    private fun vibrate(timings: LongArray, amplitudes: IntArray) {
        val vib = vibrator ?: return
        if (!vib.hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createWaveform(timings, amplitudes, -1)
            vib.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vib.vibrate(timings, -1)
        }
    }
}
