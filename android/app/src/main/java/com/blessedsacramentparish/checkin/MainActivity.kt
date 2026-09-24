package com.blessedsacramentparish.checkin

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.blessedsacramentparish.checkin.nfc.NfcReadResult
import com.blessedsacramentparish.checkin.nfc.NfcReader
import com.blessedsacramentparish.checkin.ui.navigation.Screen
import com.blessedsacramentparish.checkin.ui.screens.events.EventSelectionScreen
import com.blessedsacramentparish.checkin.ui.screens.gate.NfcGateScreen
import com.blessedsacramentparish.checkin.ui.screens.gate.NfcGateViewModel
import com.blessedsacramentparish.checkin.ui.screens.login.LoginScreen
import com.blessedsacramentparish.checkin.ui.theme.BlessedSacramentTheme
import com.blessedsacramentparish.checkin.ui.theme.WarmParchment
import com.blessedsacramentparish.checkin.util.HapticFeedbackHelper
import com.blessedsacramentparish.checkin.util.NetworkConnectivityObserver
import kotlinx.coroutines.launch
import java.net.URLDecoder

class MainActivity : ComponentActivity() {

    private lateinit var nfcReader: NfcReader
    private lateinit var hapticHelper: HapticFeedbackHelper
    private lateinit var connectivityObserver: NetworkConnectivityObserver

    // Active Gate ViewModel reference for NFC reader callback routing
    private var activeGateViewModel: NfcGateViewModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        hapticHelper = HapticFeedbackHelper(this)
        connectivityObserver = NetworkConnectivityObserver(this)

        nfcReader = NfcReader(this) { readResult ->
            handleNfcTagResult(readResult)
        }

        setContent {
            BlessedSacramentTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = WarmParchment
                ) {
                    AppNavigation()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Start native Reader Mode when activity is in foreground
        nfcReader.startReaderMode()
        activeGateViewModel?.updateHardwareState(nfcReader.checkHardwareState())
    }

    override fun onPause() {
        super.onPause()
        // Stop Reader Mode when activity pauses to conserve RF power and release hardware
        nfcReader.stopReaderMode()
    }

    private fun handleNfcTagResult(result: NfcReadResult) {
        val gateVm = activeGateViewModel
        if (gateVm != null) {
            gateVm.onNfcRead(result)
        } else {
            Log.d(TAG, "NFC tap ignored: Not in active gate check-in screen")
        }
    }

    @Composable
    private fun AppNavigation() {
        val navController = rememberNavController()
        val sessionManager = BlessedSacramentApp.instance.sessionManager
        val startDestination = if (sessionManager.isAuthenticated) {
            Screen.EventSelection.route
        } else {
            Screen.Login.route
        }

        NavHost(
            navController = navController,
            startDestination = startDestination
        ) {
            composable(Screen.Login.route) {
                activeGateViewModel = null
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.EventSelection.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.EventSelection.route) {
                activeGateViewModel = null
                EventSelectionScreen(
                    onSelectEvent = { eventId, title ->
                        navController.navigate(Screen.NfcGate.createRoute(eventId, title))
                    },
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.EventSelection.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(
                route = Screen.NfcGate.route,
                arguments = listOf(
                    navArgument("eventId") { type = NavType.StringType },
                    navArgument("eventTitle") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val eventId = backStackEntry.arguments?.getString("eventId") ?: ""
                val rawTitle = backStackEntry.arguments?.getString("eventTitle") ?: ""
                val decodedTitle = try {
                    URLDecoder.decode(rawTitle, "UTF-8")
                } catch (e: Exception) {
                    rawTitle
                }

                val gateViewModel = remember(eventId) {
                    NfcGateViewModel(
                        eventId = eventId,
                        eventTitle = decodedTitle,
                        hapticHelper = hapticHelper
                    )
                }

                // Register active gate ViewModel
                DisposableEffect(gateViewModel) {
                    activeGateViewModel = gateViewModel
                    gateViewModel.updateHardwareState(nfcReader.checkHardwareState())
                    onDispose {
                        activeGateViewModel = null
                    }
                }

                // Observe real-time network state
                LaunchedEffect(Unit) {
                    connectivityObserver.isOnline.collect { isOnline ->
                        gateViewModel.updateNetworkState(isOnline)
                    }
                }

                NfcGateScreen(
                    viewModel = gateViewModel,
                    onBack = { navController.popBackStack() },
                    onOpenNfcSettings = { nfcReader.openNfcSettings() }
                )
            }
        }
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}
