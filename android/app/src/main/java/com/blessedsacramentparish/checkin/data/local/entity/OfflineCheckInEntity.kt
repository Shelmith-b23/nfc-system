package com.blessedsacramentparish.checkin.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Offline Attendance Queue Entity.
 *
 * Implements encrypted local persistence:
 * - NO plain text NFC token is ever written to disk
 * - NO participant PII is stored locally
 * - Durably preserves clientEventId across crashes or reboots
 */
@Entity(
    tableName = "offline_check_ins",
    indices = [
        Index(value = ["clientEventId"], unique = true),
        Index(value = ["syncStatus"])
    ]
)
data class OfflineCheckInEntity(
    @PrimaryKey
    val id: String,

    val eventId: String,

    // Hardware-encrypted AES-256-GCM ciphertext
    val encryptedToken: String,

    // Unique 96-bit IV used for this specific record
    val iv: String,

    // Client-side idempotency key forwarded to server
    val clientEventId: String,

    val method: String = "NFC",

    val deviceId: String,

    val localTimestamp: String,

    val createdAt: Long = System.currentTimeMillis(),

    // "PENDING", "SYNCED", "DUPLICATE", "FAILED_AUTH"
    val syncStatus: String = STATUS_PENDING,

    val retryCount: Int = 0,

    val lastError: String? = null
) {
    companion object {
        const val STATUS_PENDING = "PENDING"
        const val STATUS_SYNCED = "SYNCED"
        const val STATUS_DUPLICATE = "DUPLICATE"
        const val STATUS_PERMANENT_FAILURE = "FAILED_PERMANENT"
    }
}
