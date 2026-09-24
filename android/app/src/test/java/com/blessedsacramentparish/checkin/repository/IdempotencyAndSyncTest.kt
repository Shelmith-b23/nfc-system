package com.blessedsacramentparish.checkin.repository

import com.blessedsacramentparish.checkin.data.api.models.SyncItemDto
import com.blessedsacramentparish.checkin.data.local.entity.OfflineCheckInEntity
import com.blessedsacramentparish.checkin.data.security.KeystoreManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class IdempotencyAndSyncTest {

    private val keystoreManager = KeystoreManager(isUnitTestMode = true)

    @Test
    fun testClientEventIdFormatAndPreservation() {
        val clientEventId = UUID.randomUUID().toString()
        // Validate UUIDv4 format
        val uuid = UUID.fromString(clientEventId)
        assertNotNull(uuid)
        assertEquals(4, uuid.version())

        // Simulating tap on gate device
        val rawToken = "BSCNFC:v1:tap_card_010203"
        val encrypted = keystoreManager.encrypt(rawToken)

        val entity = OfflineCheckInEntity(
            id = UUID.randomUUID().toString(),
            eventId = "evt_easter_vigil",
            encryptedToken = encrypted.cipherTextBase64,
            iv = encrypted.ivBase64,
            clientEventId = clientEventId,
            method = "NFC",
            deviceId = "BSC-EVENT-01",
            localTimestamp = "2026-09-21T07:00:00.000Z"
        )

        // Ensure entity retains identical clientEventId
        assertEquals(clientEventId, entity.clientEventId)

        // Decrypt and map to sync payload
        val decryptedToken = keystoreManager.decrypt(entity.encryptedToken, entity.iv)
        val syncItem = SyncItemDto(
            token = decryptedToken,
            method = entity.method,
            deviceId = entity.deviceId,
            clientEventId = entity.clientEventId,
            localTimestamp = entity.localTimestamp
        )

        // Assert sync item contains original clientEventId and decrypted token
        assertEquals(clientEventId, syncItem.clientEventId)
        assertEquals(rawToken, syncItem.token)
        assertEquals("BSC-EVENT-01", syncItem.deviceId)
        assertEquals("NFC", syncItem.method)
    }

    @Test
    fun testSyncMappingBatchIntegrity() {
        val count = 10
        val eventId = "evt_sunday_mass"
        val entities = (1..count).map { i ->
            val token = "BSCNFC:v1:token_$i"
            val enc = keystoreManager.encrypt(token)
            OfflineCheckInEntity(
                id = UUID.randomUUID().toString(),
                eventId = eventId,
                encryptedToken = enc.cipherTextBase64,
                iv = enc.ivBase64,
                clientEventId = UUID.randomUUID().toString(),
                deviceId = "BSC-EVENT-02",
                localTimestamp = "2026-09-21T08:00:0$i.000Z"
            )
        }

        val syncItems = entities.map { entity ->
            val decrypted = keystoreManager.decrypt(entity.encryptedToken, entity.iv)
            SyncItemDto(
                token = decrypted,
                method = entity.method,
                deviceId = entity.deviceId,
                clientEventId = entity.clientEventId,
                localTimestamp = entity.localTimestamp
            )
        }

        assertEquals(count, syncItems.size)
        // Verify all items have unique clientEventIds
        val uniqueEventIds = syncItems.map { it.clientEventId }.toSet()
        assertEquals(count, uniqueEventIds.size)

        // Verify tokens are recovered accurately
        for (i in 1..count) {
            assertEquals("BSCNFC:v1:token_$i", syncItems[i - 1].token)
        }
    }
}
