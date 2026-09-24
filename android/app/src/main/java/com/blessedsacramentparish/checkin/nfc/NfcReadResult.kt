package com.blessedsacramentparish.checkin.nfc

/**
 * Result of reading and validating a Parish NFC attendance card.
 *
 * Card format specification:
 * - NDEF Text Record (RTD_TEXT)
 * - UTF-8 encoding
 * - Format: BSCNFC:v1:<opaque-token>
 */
sealed class NfcReadResult {
    /**
     * Successfully parsed valid parish token.
     * @param token The full prefix + opaque token (e.g. "BSCNFC:v1:8f4a21c7d912ab34")
     *              or raw card token to be hashed by the server.
     * @param opaqueToken The stripped opaque token portion after "BSCNFC:v1:".
     */
    data class Success(
        val token: String,
        val opaqueToken: String
    ) : NfcReadResult()

    /**
     * Tag was read, but text payload does not match the parish card specification.
     */
    data class InvalidFormat(val reason: String) : NfcReadResult()

    /**
     * Card technology is not supported (e.g. not NDEF).
     */
    data class UnsupportedTag(val reason: String) : NfcReadResult()

    /**
     * Communication or I/O error while reading the card.
     */
    data class ReadError(val reason: String) : NfcReadResult()
}
