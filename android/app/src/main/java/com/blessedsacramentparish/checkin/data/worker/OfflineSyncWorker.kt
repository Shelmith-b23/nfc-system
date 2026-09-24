package com.blessedsacramentparish.checkin.data.worker

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.blessedsacramentparish.checkin.BlessedSacramentApp
import java.util.concurrent.TimeUnit

/**
 * Background WorkManager worker that automatically syncs pending offline check-ins
 * as soon as network connectivity is restored.
 */
class OfflineSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "OFFLINE_SYNC_WORKER_EXECUTING")

        val app = applicationContext as? BlessedSacramentApp ?: return Result.failure()
        val dao = app.database.offlineCheckInDao()
        val pendingCount = dao.getPendingCount()

        if (pendingCount == 0) {
            Log.d(TAG, "OFFLINE_SYNC_WORKER: No items pending")
            return Result.success()
        }

        // Gather events with pending items
        val pending = dao.getPendingCheckIns()
        val eventIds = pending.map { it.eventId }.distinct()

        var allSuccessful = true
        for (eventId in eventIds) {
            val res = app.checkInRepository.syncOfflineQueue(eventId)
            if (res.failed > 0 && res.synced == 0 && res.duplicates == 0) {
                allSuccessful = false
            }
        }

        return if (allSuccessful) {
            Result.success()
        } else {
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "OfflineSyncWorker"
        private const val WORK_NAME = "bsc_offline_sync_periodic"

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<OfflineSyncWorker>(
                15, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
