package com.blessedsacramentparish.checkin.data.api

import com.blessedsacramentparish.checkin.data.api.models.CheckInResponse
import com.blessedsacramentparish.checkin.data.api.models.CheckInSyncRequest
import com.blessedsacramentparish.checkin.data.api.models.DevicesResponse
import com.blessedsacramentparish.checkin.data.api.models.EnrollDeviceRequest
import com.blessedsacramentparish.checkin.data.api.models.EnrollDeviceResponse
import com.blessedsacramentparish.checkin.data.api.models.EventDetailsResponse
import com.blessedsacramentparish.checkin.data.api.models.EventsResponse
import com.blessedsacramentparish.checkin.data.api.models.GenericResponse
import com.blessedsacramentparish.checkin.data.api.models.LoginRequest
import com.blessedsacramentparish.checkin.data.api.models.LoginResponse
import com.blessedsacramentparish.checkin.data.api.models.MeResponse
import com.blessedsacramentparish.checkin.data.api.models.NfcCheckInRequest
import com.blessedsacramentparish.checkin.data.api.models.SyncResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Retrofit contract for Blessed Sacrament Catholic Parish Backend API (v1).
 * Interfaces directly with existing Node.js + Express endpoints.
 */
interface ParishApiService {

    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("auth/me")
    suspend fun getMe(): Response<MeResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<GenericResponse>

    @GET("events")
    suspend fun getEvents(): Response<EventsResponse>

    @GET("events/{id}")
    suspend fun getEventById(
        @Path("id") eventId: String
    ): Response<EventDetailsResponse>

    @GET("devices")
    suspend fun getDevices(): Response<DevicesResponse>

    @POST("devices/enroll")
    suspend fun enrollDevice(
        @Body request: EnrollDeviceRequest
    ): Response<EnrollDeviceResponse>

    @POST("events/{id}/check-in/nfc")
    suspend fun checkInNfc(
        @Path("id") eventId: String,
        @Body request: NfcCheckInRequest
    ): Response<CheckInResponse>

    @POST("events/{id}/check-in/sync")
    suspend fun syncOfflineCheckIns(
        @Path("id") eventId: String,
        @Body request: CheckInSyncRequest
    ): Response<SyncResponse>
}
