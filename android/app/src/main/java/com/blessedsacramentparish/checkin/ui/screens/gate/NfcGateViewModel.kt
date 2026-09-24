package com.blessedsacramentparish.checkin.ui.screens.gate

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blessedsacramentparish.checkin.BlessedSacramentApp
import com.blessedsacramentparish.checkin.data.repository.GateCheckInResult
import com.blessedsacramentparish.checkin.nfc.NfcHardwareState
import com.blessedsacramentparish.checkin.nfc.NfcReadResult
import com.blessedsacramentparish.checkin.util.HapticFeedbackHelper
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed class GateStatus {
    object Ready : GateStatus()
    object Processing : GateStatus()
    data class Success(val result: GateCheckInResult.CheckedIn) : GateStatus()
    data class Duplicate(val result: GateCheckInResult.AlreadyCheckedIn) : GateStatus()
    data class SavedOffline(val result: GateCheckInResult.SavedOffline) : GateStatus()
    data class Error(val title: String, val message: String) : GateStatus()
}

data class NfcGateUiState(
    val eventId: String,
    val eventTitle: String,
    val deviceCode: String,
    val isOnline: Boolean = true,
    val nfcHardwareState: NfcHardwareState = NfcHardwareState.SupportedAndEnabled,
    val status: GateStatus = GateStatus.Ready,
    val pendingOfflineCount: Int = 0,
    val isSyncing: Boolean = false,
    val lastSyncSummary: String? = null,
    val totalCheckedInThisSession: Int = 0
)

class NfcGateViewModel(
    private val eventId: String,
    private val eventTitle: String,
    private val hapticHelper: HapticFeedbackHelper
) : ViewModel() {

    private val checkInRepository = BlessedSacramentApp.instance.checkInRepository
    private val sessionManager = BlessedSacramentApp.instance.sessionManager

    private val _uiState = MutableStateFlow(
        NfcGateUiState(
            eventId = eventId,
            eventTitle = eventTitle,
            deviceCode = sessionManager.deviceCode
        )
    )
    val uiState: StateFlow<NfcGateUiState> = _uiState.asStateFlow()

    private var autoResetJob: Job? = null

    init {
        observePendingCount()
    }

    private fun observePendingCount() {
        viewModelScope.launch {
            checkInRepository.pendingOfflineCount.collect { count ->
                _uiState.update { it.copy(pendingOfflineCount = count) }
            }
        }
    }

    fun updateNetworkState(isOnline: Boolean) {
        _uiState.update { it.copy(isOnline = isOnline) }
    }

    fun updateHardwareState(state: NfcHardwareState) {
        _uiState.update { it.copy(nfcHardwareState = state) }
    }

    fun onNfcRead(result: NfcReadResult) {
        when (result) {
            is NfcReadResult.Success -> {
                processAttendance(result.token)
            }
            is NfcReadResult.InvalidFormat -> {
                hapticHelper.performError()
                showTemporaryStatus(
                    GateStatus.Error(
                        title = "Invalid Card Format",
                        message = result.reason
                    )
                )
            }
            is NfcReadResult.UnsupportedTag -> {
                hapticHelper.performError()
                showTemporaryStatus(
                    GateStatus.Error(
                        title = "Unsupported Card",
                        message = result.reason
                    )
                )
            }
            is NfcReadResult.ReadError -> {
                hapticHelper.performError()
                showTemporaryStatus(
                    GateStatus.Error(
                        title = "Read Interrupted",
                        message = result.reason
                    )
                )
            }
        }
    }

    private fun processAttendance(rawToken: String) {
        autoResetJob?.cancel()
        _uiState.update { it.copy(status = GateStatus.Processing) }

        viewModelScope.launch {
            val checkInResult = checkInRepository.processNfcCheckIn(
                eventId = eventId,
                rawNfcToken = rawToken
            )

            when (checkInResult) {
                is GateCheckInResult.CheckedIn -> {
                    hapticHelper.performSuccess()
                    _uiState.update {
                        it.copy(
                            totalCheckedInThisSession = it.totalCheckedInThisSession + 1
                        )
                    }
                    showTemporaryStatus(GateStatus.Success(checkInResult))
                }
                is GateCheckInResult.AlreadyCheckedIn -> {
                    hapticHelper.performDuplicate()
                    showTemporaryStatus(GateStatus.Duplicate(checkInResult))
                }
                is GateCheckInResult.SavedOffline -> {
                    hapticHelper.performSuccess()
                    _uiState.update {
                        it.copy(
                            totalCheckedInThisSession = it.totalCheckedInThisSession + 1
                        )
                    }
                    showTemporaryStatus(GateStatus.SavedOffline(checkInResult))
                }
                is GateCheckInResult.CardRevoked -> {
                    hapticHelper.performError()
                    showTemporaryStatus(GateStatus.Error("Card Revoked", checkInResult.message))
                }
                is GateCheckInResult.CardLost -> {
                    hapticHelper.performError()
                    showTemporaryStatus(GateStatus.Error("Card Reported Lost", checkInResult.message))
                }
                is GateCheckInResult.CardNotRegistered -> {
                    hapticHelper.performError()
                    showTemporaryStatus(GateStatus.Error("Unregistered Card", checkInResult.message))
                }
                is GateCheckInResult.CheckInClosed -> {
                    hapticHelper.performError()
                    showTemporaryStatus(GateStatus.Error("Check-In Closed", checkInResult.message))
                }
                is GateCheckInResult.UnauthorizedDevice -> {
                    hapticHelper.performError()
                    showTemporaryStatus(GateStatus.Error("Unauthorized Gate", checkInResult.message))
                }
                is GateCheckInResult.GeneralError -> {
                    hapticHelper.performError()
                    showTemporaryStatus(GateStatus.Error(checkInResult.code, checkInResult.message))
                }
            }
        }
    }

    private fun showTemporaryStatus(status: GateStatus) {
        _uiState.update { it.copy(status = status) }
        autoResetJob?.cancel()
        autoResetJob = viewModelScope.launch {
            // Auto-clear banner after 3.8 seconds so gate is immediately ready for next tap
            delay(3800)
            _uiState.update { it.copy(status = GateStatus.Ready) }
        }
    }

    fun syncNow() {
        if (_uiState.value.isSyncing) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, lastSyncSummary = null) }
            val res = checkInRepository.syncOfflineQueue(eventId)
            val summary = "Synced: ${res.synced} | Duplicates: ${res.duplicates}" +
                    if (res.failed > 0) " | Failures: ${res.failed}" else ""

            _uiState.update {
                it.copy(
                    isSyncing = false,
                    lastSyncSummary = summary
                )
            }
        }
    }
}
