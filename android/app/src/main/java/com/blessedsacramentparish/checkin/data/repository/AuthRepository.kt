package com.blessedsacramentparish.checkin.data.repository

import android.util.Log
import com.blessedsacramentparish.checkin.data.api.NetworkClient
import com.blessedsacramentparish.checkin.data.api.models.LoginRequest
import com.blessedsacramentparish.checkin.data.api.models.UserDto
import com.blessedsacramentparish.checkin.data.security.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

sealed class AuthResult {
    data class Success(val user: UserDto) : AuthResult()
    data class Error(val code: String, val message: String) : AuthResult()
}

class AuthRepository(
    private val sessionManager: SessionManager
) {
    private val api = NetworkClient.create(sessionManager)

    suspend fun login(email: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "AUTH_LOGIN_ATTEMPT: $email")
            val response = api.login(LoginRequest(email = email.trim(), password = password))

            if (response.isSuccessful && response.body()?.success == true) {
                val body = response.body()!!
                val token = body.token
                val user = body.user

                if (token != null && user != null) {
                    // Check Role Authorization (Must be CHECK_IN_OPERATOR, EVENT_ADMIN, or SUPER_ADMIN)
                    if (user.role == "PARTICIPANT") {
                        return@withContext AuthResult.Error(
                            code = "FORBIDDEN",
                            message = "Participant accounts are not permitted to operate gate scanners."
                        )
                    }

                    sessionManager.sessionToken = token
                    sessionManager.currentUser = user

                    Log.d(TAG, "AUTH_LOGIN_SUCCESS")
                    return@withContext AuthResult.Success(user)
                }
            }

            val err = response.body()?.error
            val errMessage = err?.message ?: "Invalid email or password"
            val errCode = err?.code ?: "UNAUTHORIZED"

            Log.w(TAG, "AUTH_LOGIN_REJECTED: $errCode")
            AuthResult.Error(errCode, errMessage)
        } catch (e: Exception) {
            Log.e(TAG, "AUTH_LOGIN_EXCEPTION: ${e.message}")
            AuthResult.Error("NETWORK_ERROR", e.message ?: "Network communication failure")
        }
    }

    suspend fun logout(): Boolean = withContext(Dispatchers.IO) {
        try {
            api.logout()
        } catch (e: Exception) {
            Log.w(TAG, "AUTH_LOGOUT_EXCEPTION: ${e.message}")
        } finally {
            sessionManager.clearSession()
            Log.d(TAG, "AUTH_LOGOUT_COMPLETED")
        }
        true
    }

    suspend fun checkSessionValidity(): Boolean = withContext(Dispatchers.IO) {
        if (!sessionManager.isAuthenticated) return@withContext false
        try {
            val res = api.getMe()
            res.isSuccessful && res.body()?.user != null
        } catch (e: Exception) {
            false
        }
    }

    companion object {
        private const val TAG = "AuthRepository"
    }
}
