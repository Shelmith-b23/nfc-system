package com.blessedsacramentparish.checkin.ui.screens.events

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blessedsacramentparish.checkin.BlessedSacramentApp
import com.blessedsacramentparish.checkin.data.api.models.ParishEventDto
import com.blessedsacramentparish.checkin.data.api.models.UserDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class EventSelectionUiState(
    val operator: UserDto? = null,
    val deviceCode: String = "",
    val events: List<ParishEventDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isLoggedOut: Boolean = false
)

class EventSelectionViewModel : ViewModel() {

    private val eventRepository = BlessedSacramentApp.instance.eventRepository
    private val authRepository = BlessedSacramentApp.instance.authRepository
    private val sessionManager = BlessedSacramentApp.instance.sessionManager

    private val _uiState = MutableStateFlow(
        EventSelectionUiState(
            operator = sessionManager.currentUser,
            deviceCode = sessionManager.deviceCode
        )
    )
    val uiState: StateFlow<EventSelectionUiState> = _uiState.asStateFlow()

    init {
        loadEvents()
    }

    fun loadEvents() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = eventRepository.getEvents()
            result.onSuccess { list ->
                _uiState.update {
                    it.copy(
                        events = list.filter { event ->
                            // Show active/live/published events permitting NFC check-in
                            event.status in listOf("LIVE", "PUBLISHED", "REGISTRATION_CLOSED") &&
                                    event.allowNfcCheckin
                        },
                        isLoading = false
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = err.message ?: "Failed to load parish events"
                    )
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.update { it.copy(isLoggedOut = true) }
        }
    }
}
