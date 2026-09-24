package com.blessedsacramentparish.checkin.data.repository

import android.util.Log
import com.blessedsacramentparish.checkin.data.api.NetworkClient
import com.blessedsacramentparish.checkin.data.api.models.ParishEventDto
import com.blessedsacramentparish.checkin.data.security.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class EventRepository(
    private val sessionManager: SessionManager
) {
    private val api = NetworkClient.create(sessionManager)

    suspend fun getEvents(): Result<List<ParishEventDto>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getEvents()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.events)
            } else {
                Result.failure(Exception("Failed to fetch events: HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "GET_EVENTS_ERROR: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getEventById(eventId: String): Result<ParishEventDto> = withContext(Dispatchers.IO) {
        try {
            val response = api.getEventById(eventId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.event)
            } else {
                Result.failure(Exception("Event not found: HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "GET_EVENT_BY_ID_ERROR: ${e.message}")
            Result.failure(e)
        }
    }

    companion object {
        private const val TAG = "EventRepository"
    }
}
