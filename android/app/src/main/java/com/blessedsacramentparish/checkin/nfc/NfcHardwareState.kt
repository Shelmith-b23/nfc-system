package com.blessedsacramentparish.checkin.nfc

/**
 * State of NFC hardware on the host device.
 */
sealed class NfcHardwareState {
    /**
     * NFC hardware is present and enabled. Normal gate scanning operation.
     */
    object SupportedAndEnabled : NfcHardwareState()

    /**
     * NFC hardware is present but currently turned off in system settings.
     */
    object SupportedAndDisabled : NfcHardwareState()

    /**
     * Device does not possess NFC hardware capabilities.
     */
    object Unsupported : NfcHardwareState()
}
