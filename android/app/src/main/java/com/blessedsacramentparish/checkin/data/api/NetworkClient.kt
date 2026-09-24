package com.blessedsacramentparish.checkin.data.api

import android.util.Log
import com.blessedsacramentparish.checkin.data.security.SessionManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * OkHttp and Retrofit factory with:
 * - Bearer authorization header injection
 * - Sanitized security logging (never leaks passwords, raw NFC tokens, or auth headers)
 * - 401 session revocation detection
 */
object NetworkClient {

    private const val TAG = "NetworkClient"

    fun create(sessionManager: SessionManager): ParishApiService {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()

            // Attach session token if present
            sessionManager.sessionToken?.let { token ->
                builder.header("Authorization", "Bearer $token")
            }

            val request = builder.build()
            val response = chain.proceed(request)

            // Detect session invalidation / revocation
            if (response.code == 401) {
                Log.w(TAG, "SESSION_UNAUTHORIZED_401 - Purging local session")
                sessionManager.clearSession()
            }

            response
        }

        // Sanitized logging interceptor (Strict Zero-Leak Policy)
        val sanitizedLoggingInterceptor = Interceptor { chain ->
            val request = chain.request()
            Log.d(TAG, "HTTP_REQ: ${request.method} ${request.url.encodedPath}")

            val startTime = System.nanoTime()
            val response: Response = try {
                chain.proceed(request)
            } catch (e: Exception) {
                Log.e(TAG, "HTTP_NETWORK_FAILURE: ${e.message}")
                throw e
            }
            val tookMs = (System.nanoTime() - startTime) / 1e6

            Log.d(TAG, "HTTP_RESP: ${response.code} (${tookMs}ms)")
            response
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(sanitizedLoggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(sessionManager.baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit.create(ParishApiService::class.java)
    }
}
