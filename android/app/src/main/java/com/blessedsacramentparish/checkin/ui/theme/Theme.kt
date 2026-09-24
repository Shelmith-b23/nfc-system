package com.blessedsacramentparish.checkin.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val ParishColorScheme = lightColorScheme(
    primary = MarianBurgundy,
    onPrimary = WarmParchment,
    primaryContainer = DeepClaret,
    onPrimaryContainer = ChurchGoldLight,
    secondary = ChurchGold,
    onSecondary = DeepClaret,
    background = WarmParchment,
    onBackground = TextPrimaryDark,
    surface = LightSurface,
    onSurface = TextPrimaryDark,
    surfaceVariant = WarmParchment,
    onSurfaceVariant = TextSecondaryDark,
    error = RubyError,
    onError = LightSurface
)

@Composable
fun BlessedSacramentTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = ParishColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = DeepClaret.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
