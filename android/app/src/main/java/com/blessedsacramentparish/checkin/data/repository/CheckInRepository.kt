package com.blessedsacramentparish.checkin.data.repository

import android.util.Log
import com.blessedsacramentparish.checkin.data.api.NetworkClient
import com.blessedsacramentparish.checkin.data.api.models.CheckInResponse
import com.blessedsacramentparish.checkin.data.api.models.CheckInSyncRequest
import com.blessedsacramentparish.checkin.data.api.models.NfcCheckInRequest
import com.blessedsacramentparish.checkin.data.api.models.SyncItemDto
import com.blessedsacramentparish.checkin.data.local.dao.OfflineCheckInDao
import com.blessedsacramentparish.checkin.data.local.entity.OfflineCheckInEntity
import com.blessedsacramentparish.checkin.data.security.KeystoreManager
import com.blessedsacramentparish.checkin.data.security.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

sealed class GateCheckInResult {
    data class CheckedIn(
        val participantName: String,
        val participantNumber: String,
        val parishGroup: String?,
        val checkInAt: String
    ) : GateCheckInResult()

    data class AlreadyCheckedIn(
        val participantName: String,
        val participantNumber: String,
        val checkedInAt: String
    ) : GateCheckInResult()

    data class CardRevoked(val message: String) : GateCheckInResult()
    data class CardLost(val message: String) : GateCheckInResult()
    data class CardNotRegistered(val message: String) : GateCheckInResult()
    data class CheckInClosed(val message: String) : GateCheckInResult()
    data class UnauthorizedDevice(val message: String) : GateCheckInResult()
    data class SavedOffline(val clientEventId: String) : GateCheckInResult()
    data class GeneralError(val code: String, val message: String) : GateCheckInResult()
}

class CheckInRepository(
    private val offlineDao: OfflineCheckInDao,
    private val keystoreManager: KeystoreManager,
    private val sessionManager: SessionManager
) {
    private val api = NetworkClient.create(sessionManager)

    val pendingOfflineCount: Flow<Int> = offlineDao.observePendingCount()

    private fun getCurrentIsoTimestamp(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    /**
     * Executes NFC Gate Check-In for an event.
     *
     * Adheres strictly to Zero-Trust and Offline-First requirements:
     * - Generates unique clientEventId once per tap
     * - Attempts online check-in against authoritative backend
     * - If network is unreachable, securely encrypts token using AES-256-GCM and queues in Room
     * - Preserves clientEventId across online attempts and offline queueing
     */
    suspend fun processNfcCheckIn(
        eventId: String,
        rawNfcToken: String,
        existingClientEventId: String? = null
    ): GateCheckInResult = withContext(Dispatchers.IO) {
        val clientEventId = existingClientEventId ?: UUID.randomUUID().toString()
        val deviceCode = sessionManager.deviceCode

        Log.d(TAG, "CHECKIN_REQUEST_STARTED: device=$deviceCode")

        try {
            val response = api.checkInNfc(
                eventId = eventId,
                request = NfcCheckInRequest(
                    token = rawNfcToken,
                    deviceId = deviceCode,
                    clientEventId = clientEventId
                )
            )

            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                return@withContext mapCheckInResponse(body)
            }

            // Inspect HTTP status codes
            if (response.code() == 403) {
                val err = response.errorBody()?.string()
                if (err?.contains("DEVICE_NOT_AUTHORIZED") == true) {
                    Log.w(TAG, "CHECKIN_FAILED: DEVICE_NOT_AUTHORIZED")
                    return@withContext GateCheckInResult.UnauthorizedDevice("This gate device is not authorized.")
                }
                if (err?.contains("DEVICE_INACTIVE") == true) {
                    Log.w(TAG, "CHECKIN_FAILED: DEVICE_INACTIVE")
                    return@withContext GateCheckInResult.UnauthorizedDevice("This gate device has been deactivated.")
                }
                return@withContext GateCheckInResult.GeneralError("FORBIDDEN", "Operator or device access forbidden.")
            }

            if (response.code() == 401) {
                return@withContext GateCheckInResult.GeneralError("UNAUTHORIZED", "Operator session has expired.")
            }

            // Server returned non-200, but reachable
            val errorBody = response.errorBody()?.string() ?: ""
            Log.w(TAG, "CHECKIN_HTTP_ERROR: ${response.code()} $errorBody")
            GateCheckInResult.GeneralError("SERVER_ERROR", "Server returned HTTP ${response.code()}")
        } catch (e: IOException) {
            // Network failure or offline -> fallback to encrypted offline queue
            Log.i(TAG, "CHECKIN_OFFLINE_FALLBACK: Network unreachable, queueing offline check-in")
            queueOfflineCheckIn(eventId, rawNfcToken, clientEventId)
        } catch (e: Exception) {
            Log.e(TAG, "CHECKIN_UNEXPECTED_ERROR: ${e.message}")
            GateCheckInResult.GeneralError("CLIENT_ERROR", e.message ?: "Unexpected client error")
        }
    }

    /**
     * Encrypts the raw NFC token using AES-256-GCM and persists it to the Room database.
     */
    private suspend fun queueOfflineCheckIn(
        eventId: String,
        rawNfcToken: String,
        clientEventId: String
    ): GateCheckInResult {
        return try {
            val encryptedPayload = keystoreManager.encrypt(rawNfcToken)
            val entity = OfflineCheckInEntity(
                id = UUID.randomUUID().toString(),
                eventId = eventId,
                encryptedToken = encryptedPayload.cipherTextBase64,
                iv = encryptedPayload.ivBase64,
                clientEventId = clientEventId,
                method = "NFC",
                deviceId = sessionManager.deviceCode,
                localTimestamp = getCurrentIsoTimestamp(),
                syncStatus = OfflineCheckInEntity.STATUS_PENDING
            )

            offlineDao.insert(entity)
            Log.d(TAG, "CHECKIN_OFFLINE_QUEUED")
            GateCheckInResult.SavedOffline(clientEventId)
        } catch (e: Exception) {
            Log.e(TAG, "OFFLINE_ENCRYPTION_FAILED: ${e.message}")
            GateCheckInResult.GeneralError("ENCRYPTION_ERROR", "Failed to secure offline check-in")
        }
    }

    /**
     * Synchronizes queued offline check-ins with the authoritative backend.
     */
    suspend fun syncOfflineQueue(eventId: String): SyncResult = withContext(Dispatchers.IO) {
        val pending = offlineDao.getPendingForEvent(eventId)
        if (pending.isEmpty()) {
            return@withContext SyncResult(synced = 0, duplicates = 0, failed = 0)
        }

        Log.d(TAG, "OFFLINE_SYNC_STARTED: ${pending.size} items pending")
        val syncItems = mutableListOf<SyncItemDto>()
        val idMap = mutableMapOf<String, OfflineCheckInEntity>()

        for (item in pending) {
            try {
                val decryptedToken = keystoreManager.decrypt(
                    cipherTextBase64 = item.encryptedToken,
                    ivBase64 = item.iv
                )
                val syncDto = SyncItemDto(
                    token = decryptedToken,
                    method = item.method,
                    deviceId = item.deviceId,
                    clientEventId = item.clientEventId,
                    localTimestamp = item.localTimestamp
                )
                syncItems.add(syncDto)
                idMap[item.clientEventId] = item
            } catch (e: Exception) {
                Log.e(TAG, "TOKEN_DECRYPT_FAILED: ${e.message}")
                offlineDao.updateSyncStatus(
                    item.id,
                    OfflineCheckInEntity.STATUS_PERMANENT_FAILURE,
                    "Decryption failed: ${e.message}"
                )
            }
        }

        if (syncItems.isEmpty()) {
            return@withContext SyncResult(synced = 0, duplicates = 0, failed = pending.size)
        }

        try {
            val response = api.syncOfflineCheckIns(
                eventId = eventId,
                request = CheckInSyncRequest(
                    items = syncItems,
                    deviceId = sessionManager.deviceCode
                )
            )

            if (response.isSuccessful && response.body()?.success == true) {
                val syncBody = response.body()!!
                Log.d(TAG, "CHECKIN_SYNCED: synced=${syncBody.synced}, duplicates=${syncBody.duplicates}")

                // Mark all successfully batch processed items as SYNCED in local database
                for (item in pending) {
                    offlineDao.markSynced(item.id)
                }

                return@withContext SyncResult(
                    synced = syncBody.synced,
                    duplicates = syncBody.duplicates,
                    failed = syncBody.errors?.size ?: 0
                )
            }

            Log.w(TAG, "OFFLINE_SYNC_HTTP_FAILURE: HTTP ${response.code()}")
            SyncResult(synced = 0, duplicates = 0, failed = pending.size)
        } catch (e: Exception) {
            Log.e(TAG, "OFFLINE_SYNC_EXCEPTION: ${e.message}")
            SyncResult(synced = 0, duplicates = 0, failed = pending.size)
        }
    }

    private fun mapCheckInResponse(response: CheckInResponse): GateCheckInResult {
        if (response.success && response.status == "CHECKED_IN") {
            Log.d(TAG, "CHECKIN_SUCCESS")
            val p = response.participant
            return GateCheckInResult.CheckedIn(
                participantName = if (p != null) "${p.firstName} ${p.lastName}" else "Participant",
                participantNumber = p?.participantNumber ?: "BSC-CARD",
                parishGroup = p?.parishGroup,
                checkInAt = response.checkInAt ?: ""
            )
        }

        if (response.status == "ALREADY_CHECKED_IN" || response.error?.code == "ALREADY_CHECKED_IN") {
            Log.d(TAG, "CHECKIN_DUPLICATE")
            val p = response.participant
            return GateCheckInResult.AlreadyCheckedIn(
                participantName = if (p != null) "${p.firstName} ${p.lastName}" else "Participant",
                participantNumber = p?.participantNumber ?: "BSC-CARD",
                checkedInAt = response.checkInAt ?: ""
            )
        }

        val errCode = response.error?.code ?: "UNKNOWN"
        val message = response.error?.message ?: "Attendance verification failed"

        return when (errCode) {
            "CARD_REVOKED" -> GateCheckInResult.CardRevoked(message)
            "CARD_LOST" -> GateCheckInResult.CardLost(message)
            "CARD_NOT_REGISTERED", "CARD_NOT_ASSIGNED" -> GateCheckInResult.CardNotRegistered(message)
            "CHECKIN_CLOSED", "EVENT_NOT_ACTIVE" -> GateCheckInResult.CheckInClosed(message)
            "DEVICE_NOT_AUTHORIZED", "DEVICE_INACTIVE" -> GateCheckInResult.UnauthorizedDevice(message)
            else -> GateCheckInResult.GeneralError(errCode, message)
        }
    }

    data class SyncResult(val synced: Int, val duplicates: Int, val failed: Int)

    companion object {
        private const val TAG = "CheckInRepository"
    }
}
