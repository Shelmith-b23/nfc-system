package com.blessedsacramentparish.checkin.data.api.models

import com.google.gson.annotations.SerializedName

// --- Authentication ---

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class LoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("token") val token: String?,
    @SerializedName("user") val user: UserDto?,
    @SerializedName("error") val error: ApiError?
)

data class UserDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("role") val role: String,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    @SerializedName("phone") val phone: String?,
    @SerializedName("isActive") val isActive: Boolean,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?
)

data class MeResponse(
    @SerializedName("user") val user: UserDto
)

data class GenericResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?
)

// --- Events ---

data class EventsResponse(
    @SerializedName("events") val events: List<ParishEventDto>
)

data class EventDetailsResponse(
    @SerializedName("event") val event: ParishEventDto
)

data class ParishEventDto(
    @SerializedName("id") val id: String,
    @SerializedName("eventCode") val eventCode: String,
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String?,
    @SerializedName("category") val category: String?,
    @SerializedName("venue") val venue: String,
    @SerializedName("startAt") val startAt: String,
    @SerializedName("endAt") val endAt: String,
    @SerializedName("status") val status: String,
    @SerializedName("allowNfcCheckin") val allowNfcCheckin: Boolean
)

// --- Devices ---

data class DevicesResponse(
    @SerializedName("devices") val devices: List<NfcDeviceDto>
)

data class NfcDeviceDto(
    @SerializedName("id") val id: String,
    @SerializedName("deviceCode") val deviceCode: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("location") val location: String,
    @SerializedName("isActive") val isActive: Boolean,
    @SerializedName("lastSeenAt") val lastSeenAt: String?
)

data class EnrollDeviceRequest(
    @SerializedName("deviceCode") val deviceCode: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("location") val location: String
)

data class EnrollDeviceResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("device") val device: NfcDeviceDto
)

// --- NFC Check-In ---

data class NfcCheckInRequest(
    @SerializedName("token") val token: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("clientEventId") val clientEventId: String
)

data class CheckInResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("status") val status: String?,
    @SerializedName("method") val method: String?,
    @SerializedName("participant") val participant: ParticipantSummaryDto?,
    @SerializedName("event") val event: EventSummaryDto?,
    @SerializedName("checkInAt") val checkInAt: String?,
    @SerializedName("attendanceId") val attendanceId: String?,
    @SerializedName("clientEventId") val clientEventId: String?,
    @SerializedName("error") val error: ApiError?
)

data class ParticipantSummaryDto(
    @SerializedName("id") val id: String,
    @SerializedName("participantNumber") val participantNumber: String,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    @SerializedName("parishGroup") val parishGroup: String?,
    @SerializedName("isParishMember") val isParishMember: Boolean
)

data class EventSummaryDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("venue") val venue: String
)

data class ApiError(
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String
)

// --- Offline Queue Synchronization ---

data class CheckInSyncRequest(
    @SerializedName("items") val items: List<SyncItemDto>,
    @SerializedName("deviceId") val deviceId: String
)

data class SyncItemDto(
    @SerializedName("token") val token: String,
    @SerializedName("method") val method: String = "NFC",
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("clientEventId") val clientEventId: String,
    @SerializedName("localTimestamp") val localTimestamp: String
)

data class SyncResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("processed") val processed: Int,
    @SerializedName("synced") val synced: Int,
    @SerializedName("duplicates") val duplicates: Int,
    @SerializedName("errors") val errors: List<SyncErrorDto>?
)

data class SyncErrorDto(
    @SerializedName("tokenPreview") val tokenPreview: String?,
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String
)
