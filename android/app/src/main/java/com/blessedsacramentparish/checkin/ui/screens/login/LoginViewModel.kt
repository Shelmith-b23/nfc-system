package com.blessedsacramentparish.checkin.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blessedsacramentparish.checkin.BlessedSacramentApp
import com.blessedsacramentparish.checkin.data.repository.AuthResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "operator@example.test",
    val password: String = "",
    val baseUrl: String = "",
    val deviceCode: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isSuccess: Boolean = false
)

class LoginViewModel : ViewModel() {

    private val authRepository = BlessedSacramentApp.instance.authRepository
    private val sessionManager = BlessedSacramentApp.instance.sessionManager

    private val _uiState = MutableStateFlow(
        LoginUiState(
            baseUrl = sessionManager.baseUrl,
            deviceCode = sessionManager.deviceCode
        )
    )
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onEmailChanged(newEmail: String) {
        _uiState.update { it.copy(email = newEmail, errorMessage = null) }
    }

    fun onPasswordChanged(newPass: String) {
        _uiState.update { it.copy(password = newPass, errorMessage = null) }
    }

    fun onBaseUrlChanged(newUrl: String) {
        _uiState.update { it.copy(baseUrl = newUrl) }
        sessionManager.baseUrl = newUrl
    }

    fun onDeviceCodeChanged(newDevice: String) {
        _uiState.update { it.copy(deviceCode = newDevice) }
        sessionManager.deviceCode = newDevice
    }

    fun login() {
        val state = _uiState.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Email and password are required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            when (val result = authRepository.login(state.email, state.password)) {
                is AuthResult.Success -> {
                    _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                }
                is AuthResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }
}
