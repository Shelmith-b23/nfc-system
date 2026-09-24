package com.blessedsacramentparish.checkin.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.blessedsacramentparish.checkin.data.local.entity.OfflineCheckInEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OfflineCheckInDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(checkIn: OfflineCheckInEntity)

    @Query("SELECT * FROM offline_check_ins WHERE syncStatus = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPendingCheckIns(): List<OfflineCheckInEntity>

    @Query("SELECT * FROM offline_check_ins WHERE eventId = :eventId AND syncStatus = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPendingForEvent(eventId: String): List<OfflineCheckInEntity>

    @Query("SELECT COUNT(*) FROM offline_check_ins WHERE syncStatus = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM offline_check_ins WHERE syncStatus = 'PENDING'")
    suspend fun getPendingCount(): Int

    @Query("UPDATE offline_check_ins SET syncStatus = :status, lastError = :error, retryCount = retryCount + 1 WHERE id = :id")
    suspend fun updateSyncStatus(id: String, status: String, error: String? = null)

    @Query("UPDATE offline_check_ins SET syncStatus = 'SYNCED' WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("UPDATE offline_check_ins SET syncStatus = 'DUPLICATE' WHERE id = :id")
    suspend fun markDuplicate(id: String)

    @Query("DELETE FROM offline_check_ins WHERE syncStatus IN ('SYNCED', 'DUPLICATE') AND createdAt < :thresholdTimestamp")
    suspend fun cleanOldSyncedRecords(thresholdTimestamp: Long)
}
