package com.blessedsacramentparish.checkin.nfc

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.provider.Settings
import android.util.Log
import java.io.IOException
import java.nio.charset.Charset
import java.util.Arrays

/**
 * Native Android NFC Reader Mode Handler.
 *
 * Implements Android's modern Reader Mode with:
 * - FLAG_READER_NFC_A
 * - FLAG_READER_NFC_B
 * - FLAG_READER_NO_PLATFORM_SOUNDS
 *
 * Explicitly avoids FLAG_READER_SKIP_NDEF_CHECK so NDEF tags are parsed natively.
 * Does NOT rely on or expose Tag UID for authentication.
 */
class NfcReader(
    private val activity: Activity,
    private val onTagRead: (NfcReadResult) -> Unit
) : NfcAdapter.ReaderCallback {

    private val nfcAdapter: NfcAdapter? by lazy {
        NfcAdapter.getDefaultAdapter(activity)
    }

    /**
     * Determine device NFC hardware and settings capability.
     */
    fun checkHardwareState(): NfcHardwareState {
        val hasFeature = activity.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)
        val adapter = nfcAdapter

        return when {
            !hasFeature || adapter == null -> NfcHardwareState.Unsupported
            !adapter.isEnabled -> NfcHardwareState.SupportedAndDisabled
            else -> NfcHardwareState.SupportedAndEnabled
        }
    }

    /**
     * Start native Android reader mode on the activity.
     */
    fun startReaderMode() {
        val adapter = nfcAdapter ?: return
        if (!adapter.isEnabled) return

        val flags = NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS

        // Reader mode started - native callback onTagDiscovered will be called on background thread
        adapter.enableReaderMode(activity, this, flags, null)
        Log.d(TAG, "NFC_READER_MODE_ENABLED")
    }

    /**
     * Stop native Android reader mode.
     */
    fun stopReaderMode() {
        nfcAdapter?.disableReaderMode(activity)
        Log.d(TAG, "NFC_READER_MODE_DISABLED")
    }

    /**
     * Open device system NFC settings screen.
     */
    fun openNfcSettings() {
        val intent = Intent(Settings.ACTION_NFC_SETTINGS)
        if (intent.resolveActivity(activity.packageManager) != null) {
            activity.startActivity(intent)
        } else {
            activity.startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    /**
     * Android NFC Reader Mode callback triggered when tag is brought into the RF field.
     */
    override fun onTagDiscovered(tag: Tag?) {
        if (tag == null) {
            activity.runOnUiThread {
                onTagRead(NfcReadResult.ReadError("Null NFC tag discovered"))
            }
            return
        }

        Log.d(TAG, "NFC_TAG_DETECTED")
        val result = parseTag(tag)

        activity.runOnUiThread {
            onTagRead(result)
        }
    }

    /**
     * Parses an NFC Tag and validates the parish NDEF Text record.
     */
    fun parseTag(tag: Tag): NfcReadResult {
        val ndef = Ndef.get(tag)
            ?: return NfcReadResult.UnsupportedTag("Tag does not support NDEF format")

        return try {
            ndef.connect()
            val ndefMessage = ndef.ndefMessage
                ?: return NfcReadResult.InvalidFormat("Tag contains no NDEF messages")

            parseNdefMessage(ndefMessage)
        } catch (e: IOException) {
            Log.e(TAG, "NFC_IO_ERROR: ${e.message}")
            NfcReadResult.ReadError("Card read interrupted: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "NFC_PARSE_ERROR: ${e.message}")
            NfcReadResult.ReadError("Card processing failed: ${e.message}")
        } finally {
            try {
                if (ndef.isConnected) {
                    ndef.close()
                }
            } catch (ignored: Exception) {}
        }
    }

    /**
     * Extracts text records from NdefMessage and verifies the parish prefix.
     */
    fun parseNdefMessage(message: NdefMessage): NfcReadResult {
        val records = message.records
        if (records.isNullOrEmpty()) {
            return NfcReadResult.InvalidFormat("Empty NDEF message")
        }

        for (record in records) {
            if (record.tnf == NdefRecord.TNF_WELL_KNOWN &&
                Arrays.equals(record.type, NdefRecord.RTD_TEXT)
            ) {
                return parseTextRecord(record)
            }
        }

        return NfcReadResult.UnsupportedTag("Card does not contain a valid NDEF Text record")
    }

    /**
     * Parses NDEF RTD_TEXT record according to NFC Forum Text Record Type Definition.
     *
     * Format:
     * Byte 0: Status byte:
     *   Bit 7: Encoding (0 = UTF-8, 1 = UTF-16)
     *   Bit 6: Reserved
     *   Bits 5..0: Length of language code
     * Bytes 1..n: ISO/IANA language code (ASCII)
     * Bytes n+1..end: Text payload
     */
    fun parseTextRecord(record: NdefRecord): NfcReadResult {
        return parseTextPayload(record.payload)
    }

    /**
     * Parses raw NDEF RTD_TEXT payload byte array according to NFC Forum Text Record Type Definition.
     */
    fun parseTextPayload(payload: ByteArray?): NfcReadResult {
        if (payload == null || payload.isEmpty()) {
            return NfcReadResult.InvalidFormat("NDEF Text record payload is empty")
        }

        val statusByte = payload[0].toInt()
        val isUtf8 = (statusByte and 0x80) == 0
        val languageCodeLength = statusByte and 0x3F

        if (1 + languageCodeLength > payload.size) {
            return NfcReadResult.InvalidFormat("Malformed language code length header")
        }

        val charset = if (isUtf8) Charsets.UTF_8 else Charset.forName("UTF-16")

        val text = try {
            String(
                payload,
                1 + languageCodeLength,
                payload.size - 1 - languageCodeLength,
                charset
            )
        } catch (e: Exception) {
            return NfcReadResult.InvalidFormat("Failed to decode text payload: ${e.message}")
        }

        // Validate Parish Token Format: BSCNFC:v1:<opaque-token>
        if (!text.startsWith(PARISH_PREFIX)) {
            return NfcReadResult.InvalidFormat(
                "Card payload does not match parish signature. Expected prefix '${PARISH_PREFIX}'"
            )
        }

        val opaqueToken = text.substring(PARISH_PREFIX.length).trim()
        if (opaqueToken.isEmpty()) {
            return NfcReadResult.InvalidFormat("Parish card token payload is empty")
        }

        return NfcReadResult.Success(
            token = text,
            opaqueToken = opaqueToken
        )
    }

    companion object {
        private const val TAG = "NfcReader"
        const val PARISH_PREFIX = "BSCNFC:v1:"
    }
}
