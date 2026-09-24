package com.blessedsacramentparish.checkin.ui.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object EventSelection : Screen("event_selection")
    object NfcGate : Screen("nfc_gate/{eventId}/{eventTitle}") {
        fun createRoute(eventId: String, eventTitle: String): String {
            val encodedTitle = java.net.URLEncoder.encode(eventTitle, "UTF-8")
            return "nfc_gate/$eventId/$encodedTitle"
        }
    }
}
