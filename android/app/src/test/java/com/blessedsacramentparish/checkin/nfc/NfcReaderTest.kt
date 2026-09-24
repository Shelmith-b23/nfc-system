package com.blessedsacramentparish.checkin.nfc

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream

class NfcReaderTest {

    private fun createNdefTextPayload(
        text: String,
        lang: String = "en",
        isUtf8: Boolean = true
    ): ByteArray {
        val langBytes = lang.toByteArray(Charsets.US_ASCII)
        val textBytes = if (isUtf8) text.toByteArray(Charsets.UTF_8) else text.toByteArray(Charsets.UTF_16)
        val statusByte = ((if (isUtf8) 0 else 0x80) or (langBytes.size and 0x3F)).toByte()

        val baos = ByteArrayOutputStream()
        baos.write(statusByte.toInt())
        baos.write(langBytes)
        baos.write(textBytes)

        return baos.toByteArray()
    }

    @Test
    fun testValidParishNdefPayload() {
        val token = "BSCNFC:v1:8f4a21c7d912ab34"
        val payload = createNdefTextPayload(token)

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(payload)

        assertTrue("Expected Success result but got $result", result is NfcReadResult.Success)
        val success = result as NfcReadResult.Success
        assertEquals(token, success.token)
        assertEquals("8f4a21c7d912ab34", success.opaqueToken)
    }

    @Test
    fun testValidParishNdefPayloadWithLongToken() {
        val opaque = "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b_SECURE_TOKEN"
        val fullToken = "BSCNFC:v1:$opaque"
        val payload = createNdefTextPayload(fullToken)

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(payload)

        assertTrue("Expected Success", result is NfcReadResult.Success)
        val success = result as NfcReadResult.Success
        assertEquals(fullToken, success.token)
        assertEquals(opaque, success.opaqueToken)
    }

    @Test
    fun testRejectsPayloadWithoutParishPrefix() {
        val invalidToken = "OTHER_SYSTEM:v1:12345678"
        val payload = createNdefTextPayload(invalidToken)

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(payload)

        assertTrue("Expected InvalidFormat for non-parish prefix", result is NfcReadResult.InvalidFormat)
        val err = result as NfcReadResult.InvalidFormat
        assertTrue(err.reason.contains("BSCNFC:v1:"))
    }

    @Test
    fun testRejectsEmptyOpaqueToken() {
        val emptyToken = "BSCNFC:v1:"
        val payload = createNdefTextPayload(emptyToken)

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(payload)

        assertTrue("Expected InvalidFormat for empty token", result is NfcReadResult.InvalidFormat)
        val err = result as NfcReadResult.InvalidFormat
        assertTrue(err.reason.contains("empty"))
    }

    @Test
    fun testRejectsWhitespaceOnlyOpaqueToken() {
        val spaceToken = "BSCNFC:v1:    "
        val payload = createNdefTextPayload(spaceToken)

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(payload)

        assertTrue("Expected InvalidFormat for whitespace token", result is NfcReadResult.InvalidFormat)
    }

    @Test
    fun testRejectsEmptyPayload() {
        val payload = ByteArray(0)

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(payload)

        assertTrue("Expected InvalidFormat for empty payload", result is NfcReadResult.InvalidFormat)
    }

    @Test
    fun testRejectsCorruptedLanguageLengthHeader() {
        // Status byte says language length is 50, but total payload is only 3 bytes
        val badPayload = byteArrayOf(50, 'e'.code.toByte(), 'n'.code.toByte())

        val reader = NfcReader(null as anyActivity()) { }
        val result = reader.parseTextPayload(badPayload)

        assertTrue("Expected InvalidFormat for corrupted length header", result is NfcReadResult.InvalidFormat)
    }

    @Suppress("UNCHECKED_CAST")
    private fun anyActivity(): android.app.Activity? = null
}
