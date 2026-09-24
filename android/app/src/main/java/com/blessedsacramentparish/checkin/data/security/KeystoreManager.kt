package com.blessedsacramentparish.checkin.data.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Hardware-backed AES-256-GCM Cryptographic Manager using Android Keystore.
 *
 * Encrypts raw NFC tokens before local Room persistence during offline gate mode.
 * - Hardware-backed master key (TEE / StrongBox if available)
 * - Unique, cryptographically secure 96-bit (12-byte) initialization vector per encryption
 * - Authenticated AES/GCM/NoPadding with 128-bit authentication tag
 * - Separate IV and ciphertext storage
 */
class KeystoreManager(
    private val keyAlias: String = KEY_ALIAS,
    private val isUnitTestMode: Boolean = false
) {

    private val secureRandom = SecureRandom()
    private var testSecretKey: SecretKey? = null

    init {
        if (!isUnitTestMode) {
            ensureKeyExists()
        }
    }

    private fun getOrCreateKey(): SecretKey {
        if (isUnitTestMode) {
            if (testSecretKey == null) {
                val keyBytes = ByteArray(32)
                secureRandom.nextBytes(keyBytes)
                testSecretKey = SecretKeySpec(keyBytes, "AES")
            }
            return testSecretKey!!
        }

        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!keyStore.containsAlias(keyAlias)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            )
            val spec = KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(false) // We supply explicit cryptographically secure IVs
                .build()

            keyGenerator.init(spec)
            keyGenerator.generateKey()
            Log.d(TAG, "KEYSTORE_KEY_GENERATED")
        }

        return (keyStore.getEntry(keyAlias, null) as KeyStore.SecretKeyEntry).secretKey
    }

    private fun ensureKeyExists() {
        try {
            getOrCreateKey()
        } catch (e: Exception) {
            Log.e(TAG, "KEYSTORE_INIT_ERROR: ${e.message}")
        }
    }

    /**
     * Encrypts plaintext token using AES-256-GCM.
     * Generates a fresh 12-byte cryptographically secure random IV for every operation.
     */
    fun encrypt(plainText: String): EncryptedPayload {
        val secretKey = getOrCreateKey()
        val iv = ByteArray(GCM_IV_LENGTH_BYTES)
        secureRandom.nextBytes(iv)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)

        val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))

        return EncryptedPayload(
            cipherTextBase64 = Base64.getEncoder().encodeToString(cipherBytes),
            ivBase64 = Base64.getEncoder().encodeToString(iv)
        )
    }

    /**
     * Decrypts ciphertext using AES-256-GCM and the specified IV.
     */
    fun decrypt(cipherTextBase64: String, ivBase64: String): String {
        val secretKey = getOrCreateKey()
        val iv = Base64.getDecoder().decode(ivBase64)
        val cipherBytes = Base64.getDecoder().decode(cipherTextBase64)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

        val plainBytes = cipher.doFinal(cipherBytes)
        return String(plainBytes, Charsets.UTF_8)
    }

    data class EncryptedPayload(
        val cipherTextBase64: String,
        val ivBase64: String
    )

    companion object {
        private const val TAG = "KeystoreManager"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "bsc_attendance_key_v1"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH_BYTES = 12
        private const val GCM_TAG_LENGTH_BITS = 128
    }
}
