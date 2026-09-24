package com.blessedsacramentparish.checkin.data.repository

import android.util.Log
import com.blessedsacramentparish.checkin.data.api.NetworkClient
import com.blessedsacramentparish.checkin.data.api.models.EnrollDeviceRequest
import com.blessedsacramentparish.checkin.data.api.models.NfcDeviceDto
import com.blessedsacramentparish.checkin.data.security.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DeviceRepository(
    private val sessionManager: SessionManager
) {
    private val api = NetworkClient.create(sessionManager)

    suspend fun getRegisteredDevices(): Result<List<NfcDeviceDto>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getDevices()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.devices)
            } else {
                Result.failure(Exception("Failed to fetch devices: HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "GET_DEVICES_ERROR: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun enrollDevice(deviceCode: String, deviceName: String, location: String): Result<NfcDeviceDto> = withContext(Dispatchers.IO) {
        try {
            val response = api.enrollDevice(
                EnrollDeviceRequest(
                    deviceCode = deviceCode.trim(),
                    deviceName = deviceName.trim(),
                    location = location.trim()
                )
            )
            if (response.isSuccessful && response.body()?.success == true && response.body()?.device != null) {
                sessionManager.deviceCode = response.body()!!.device.deviceCode
                Result.success(response.body()!!.device)
            } else {
                Result.failure(Exception("Device enrollment rejected"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "ENROLL_DEVICE_ERROR: ${e.message}")
            Result.failure(e)
        }
    }

    companion object {
        private const val TAG = "DeviceRepository"
    }
}
