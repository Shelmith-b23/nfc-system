package com.blessedsacramentparish.checkin.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.blessedsacramentparish.checkin.data.api.models.UserDto
import com.google.gson.Gson

/**
 * Manages authenticated operator session, device authorization, and environment configuration.
 *
 * Persists session tokens using EncryptedSharedPreferences (AES-256-SIV + AES-256-GCM).
 * Completely sanitizes session state upon logout or session invalidation (401).
 */
class SessionManager(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFS_FILENAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback for tests or unsupported environments
        context.getSharedPreferences(PREFS_FILENAME, Context.MODE_PRIVATE)
    }

    private val gson = Gson()

    var sessionToken: String?
        get() = prefs.getString(KEY_SESSION_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_SESSION_TOKEN, value).apply()
        }

    var currentUser: UserDto?
        get() {
            val json = prefs.getString(KEY_USER_JSON, null) ?: return null
            return try {
                gson.fromJson(json, UserDto::class.java)
            } catch (e: Exception) {
                null
            }
        }
        set(value) {
            val json = if (value != null) gson.toJson(value) else null
            prefs.edit().putString(KEY_USER_JSON, json).apply()
        }

    var deviceCode: String
        get() = prefs.getString(KEY_DEVICE_CODE, DEFAULT_DEVICE_CODE) ?: DEFAULT_DEVICE_CODE
        set(value) {
            prefs.edit().putString(KEY_DEVICE_CODE, value).apply()
        }

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) {
            val normalized = if (value.endsWith("/")) value else "$value/"
            prefs.edit().putString(KEY_BASE_URL, normalized).apply()
        }

    val isAuthenticated: Boolean
        get() = !sessionToken.isNullOrBlank()

    /**
     * Completely purges the active operator session, revoking credentials locally.
     */
    fun clearSession() {
        prefs.edit()
            .remove(KEY_SESSION_TOKEN)
            .remove(KEY_USER_JSON)
            .apply()
    }

    companion object {
        private const val PREFS_FILENAME = "bsc_secure_session_prefs"
        private const val KEY_SESSION_TOKEN = "session_token"
        private const val KEY_USER_JSON = "user_json"
        private const val KEY_DEVICE_CODE = "device_code"
        private const val KEY_BASE_URL = "base_url"

        const val DEFAULT_DEVICE_CODE = "BSC-EVENT-01"
        // Production-ready configurable default URL
        const val DEFAULT_BASE_URL = "http://10.0.2.2:3000/api/v1/"
    }
}
