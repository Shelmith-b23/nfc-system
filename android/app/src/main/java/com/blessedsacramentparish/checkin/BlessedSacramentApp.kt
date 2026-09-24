package com.blessedsacramentparish.checkin

import android.app.Application
import com.blessedsacramentparish.checkin.data.local.AppDatabase
import com.blessedsacramentparish.checkin.data.repository.AuthRepository
import com.blessedsacramentparish.checkin.data.repository.CheckInRepository
import com.blessedsacramentparish.checkin.data.repository.DeviceRepository
import com.blessedsacramentparish.checkin.data.repository.EventRepository
import com.blessedsacramentparish.checkin.data.security.KeystoreManager
import com.blessedsacramentparish.checkin.data.security.SessionManager
import com.blessedsacramentparish.checkin.data.worker.OfflineSyncWorker

/**
 * Blessed Sacrament NFC Check-In Application
 * Parish: Blessed Sacrament Catholic Parish, Buru Phase III, Mumias Road, Nairobi
 */
class BlessedSacramentApp : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var keystoreManager: KeystoreManager
        private set

    lateinit var sessionManager: SessionManager
        private set

    lateinit var authRepository: AuthRepository
        private set

    lateinit var eventRepository: EventRepository
        private set

    lateinit var deviceRepository: DeviceRepository
        private set

    lateinit var checkInRepository: CheckInRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // 1. Initialize hardware-backed AES-GCM Keystore Cryptographic Manager
        keystoreManager = KeystoreManager()

        // 2. Initialize Secure Session Storage
        sessionManager = SessionManager(this)

        // 3. Initialize Room Offline Persistence Database
        database = AppDatabase.getInstance(this)

        // 4. Initialize Data Repositories
        authRepository = AuthRepository(sessionManager)
        eventRepository = EventRepository(sessionManager)
        deviceRepository = DeviceRepository(sessionManager)
        checkInRepository = CheckInRepository(
            offlineDao = database.offlineCheckInDao(),
            keystoreManager = keystoreManager,
            sessionManager = sessionManager
        )

        // 5. Schedule Background Offline Sync Work
        OfflineSyncWorker.schedulePeriodicSync(this)
    }

    companion object {
        lateinit var instance: BlessedSacramentApp
            private set
    }
}
