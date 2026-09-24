package com.blessedsacramentparish.checkin.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.blessedsacramentparish.checkin.data.local.dao.OfflineCheckInDao
import com.blessedsacramentparish.checkin.data.local.entity.OfflineCheckInEntity

@Database(
    entities = [OfflineCheckInEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun offlineCheckInDao(): OfflineCheckInDao

    companion object {
        private const val DATABASE_NAME = "bsc_attendance_db"

        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
