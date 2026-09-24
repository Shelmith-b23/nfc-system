package com.blessedsacramentparish.checkin.security

import com.blessedsacramentparish.checkin.data.security.KeystoreManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Base64
import javax.crypto.AEADBadTagException

class KeystoreCryptoTest {

    private val keystoreManager = KeystoreManager(isUnitTestMode = true)

    @Test
    fun testEncryptionDecryptionRoundTrip() {
        val rawToken = "BSCNFC:v1:parish_card_9f8e7d6c5b4a3120"
        val encrypted = keystoreManager.encrypt(rawToken)

        assertNotEquals("Ciphertext must not be plaintext", rawToken, encrypted.cipherTextBase64)
        val decrypted = keystoreManager.decrypt(encrypted.cipherTextBase64, encrypted.ivBase64)

        assertEquals("Decrypted plaintext must match original token", rawToken, decrypted)
    }

    @Test
    fun testIvRandomnessAndNonReuse() {
        val rawToken = "BSCNFC:v1:constant_token_value_xyz"

        val enc1 = keystoreManager.encrypt(rawToken)
        val enc2 = keystoreManager.encrypt(rawToken)

        assertNotEquals(
            "Every encryption must use a unique initialization vector (IV)",
            enc1.ivBase64,
            enc2.ivBase64
        )

        assertNotEquals(
            "Identical plaintext with different IVs must yield distinct ciphertexts",
            enc1.cipherTextBase64,
            enc2.cipherTextBase64
        )

        // Both must still decrypt to the original
        assertEquals(rawToken, keystoreManager.decrypt(enc1.cipherTextBase64, enc1.ivBase64))
        assertEquals(rawToken, keystoreManager.decrypt(enc2.cipherTextBase64, enc2.ivBase64))
    }

    @Test
    fun testTamperingWithCiphertextFailsAuthenticationTag() {
        val rawToken = "BSCNFC:v1:sensitive_parishioner_card_42"
        val encrypted = keystoreManager.encrypt(rawToken)

        val cipherBytes = Base64.getDecoder().decode(encrypted.cipherTextBase64)
        // Flip one bit in ciphertext
        cipherBytes[0] = (cipherBytes[0].toInt() xor 0x01).toByte()
        val tamperedCipherBase64 = Base64.getEncoder().encodeToString(cipherBytes)

        try {
            keystoreManager.decrypt(tamperedCipherBase64, encrypted.ivBase64)
            fail("Decryption of tampered ciphertext must throw AEADBadTagException")
        } catch (e: Exception) {
            // Expected cryptographic verification failure
            assertTrue(
                "Expected AEADBadTagException or Tag mismatch, got ${e.javaClass.simpleName}",
                e is AEADBadTagException || e.cause is AEADBadTagException
            )
        }
    }

    @Test
    fun testTamperingWithIvFailsAuthenticationTag() {
        val rawToken = "BSCNFC:v1:test_token"
        val encrypted = keystoreManager.encrypt(rawToken)

        val ivBytes = Base64.getDecoder().decode(encrypted.ivBase64)
        // Flip one bit in IV
        ivBytes[0] = (ivBytes[0].toInt() xor 0x01).toByte()
        val tamperedIvBase64 = Base64.getEncoder().encodeToString(ivBytes)

        try {
            keystoreManager.decrypt(encrypted.cipherTextBase64, tamperedIvBase64)
            fail("Decryption with tampered IV must throw AEADBadTagException")
        } catch (e: Exception) {
            assertTrue(
                "Expected AEAD authentication failure, got ${e.javaClass.simpleName}",
                e is AEADBadTagException || e.cause is AEADBadTagException
            )
        }
    }
}
