package com.blessedsacramentparish.checkin.ui.screens.gate

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.blessedsacramentparish.checkin.nfc.NfcHardwareState
import com.blessedsacramentparish.checkin.ui.theme.AmberWarning
import com.blessedsacramentparish.checkin.ui.theme.ChurchGold
import com.blessedsacramentparish.checkin.ui.theme.ChurchGoldLight
import com.blessedsacramentparish.checkin.ui.theme.DeepClaret
import com.blessedsacramentparish.checkin.ui.theme.EmeraldVerified
import com.blessedsacramentparish.checkin.ui.theme.MarianBurgundy
import com.blessedsacramentparish.checkin.ui.theme.RubyError
import com.blessedsacramentparish.checkin.ui.theme.TextPrimaryDark
import com.blessedsacramentparish.checkin.ui.theme.TextSecondaryDark
import com.blessedsacramentparish.checkin.ui.theme.WarmParchment

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NfcGateScreen(
    viewModel: NfcGateViewModel,
    onBack: () -> Unit,
    onOpenNfcSettings: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = state.eventTitle,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1
                        )
                        Text(
                            text = "Gate: ${state.deviceCode}",
                            fontSize = 12.sp,
                            color = ChurchGoldLight
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    // Online / Offline Status Badge
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (state.isOnline) EmeraldVerified.copy(alpha = 0.2f) else AmberWarning.copy(alpha = 0.25f),
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = if (state.isOnline) Icons.Default.CloudDone else Icons.Default.CloudOff,
                                contentDescription = null,
                                tint = if (state.isOnline) ChurchGoldLight else Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (state.isOnline) "ONLINE" else "OFFLINE",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DeepClaret
                )
            )
        },
        containerColor = WarmParchment
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Hardware Warning Alert (if NFC is disabled or unsupported)
            when (state.nfcHardwareState) {
                is NfcHardwareState.SupportedAndDisabled -> {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = AmberWarning.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, AmberWarning)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = AmberWarning)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "NFC is Disabled",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = TextPrimaryDark
                                )
                                Text(
                                    text = "Please turn on NFC in system settings to scan cards.",
                                    fontSize = 12.sp,
                                    color = TextSecondaryDark
                                )
                            }
                            Button(
                                onClick = onOpenNfcSettings,
                                colors = ButtonDefaults.buttonColors(containerColor = AmberWarning),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Enable", fontSize = 12.sp, color = Color.Black)
                            }
                        }
                    }
                }
                is NfcHardwareState.Unsupported -> {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = RubyError.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RubyError)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Error, contentDescription = null, tint = RubyError)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "NFC Hardware Unsupported on this device.",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = RubyError
                            )
                        }
                    }
                }
                is NfcHardwareState.SupportedAndEnabled -> { /* Ready */ }
            }

            // Central Dynamic Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                when (val status = state.status) {
                    is GateStatus.Ready -> {
                        ScanningTargetView()
                    }
                    is GateStatus.Processing -> {
                        ProcessingTargetView()
                    }
                    is GateStatus.Success -> {
                        SuccessResultCard(result = status.result)
                    }
                    is GateStatus.Duplicate -> {
                        DuplicateResultCard(result = status.result)
                    }
                    is GateStatus.SavedOffline -> {
                        OfflineSavedCard(result = status.result)
                    }
                    is GateStatus.Error -> {
                        ErrorResultCard(title = status.title, message = status.message)
                    }
                }
            }

            // Sync feedback banner if present
            state.lastSyncSummary?.let { summary ->
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(8.dp),
                    color = Color.White,
                    shadowElevation = 1.dp
                ) {
                    Text(
                        text = summary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = MarianBurgundy,
                        modifier = Modifier.padding(8.dp),
                        textAlign = TextAlign.Center
                    )
                }
            }

            // Gate Bottom Control Bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 8.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Session Count
                    Column {
                        Text(
                            text = "CHECKED IN",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextSecondaryDark
                        )
                        Text(
                            text = "${state.totalCheckedInThisSession}",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MarianBurgundy
                        )
                    }

                    // Offline Pending Queue Sync Action
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "OFFLINE QUEUE",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextSecondaryDark
                            )
                            Text(
                                text = "${state.pendingOfflineCount} pending",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (state.pendingOfflineCount > 0) AmberWarning else TextSecondaryDark
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Button(
                            onClick = viewModel::syncNow,
                            enabled = state.pendingOfflineCount > 0 && !state.isSyncing,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = DeepClaret,
                                contentColor = Color.White
                            ),
                            modifier = Modifier.height(38.dp)
                        ) {
                            if (state.isSyncing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = ChurchGold,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(
                                    Icons.Default.Sync,
                                    contentDescription = "Sync",
                                    modifier = Modifier.size(16.dp),
                                    tint = ChurchGold
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Sync", fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScanningTargetView() {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(200.dp)
        ) {
            // Pulsing Outer Ring
            Box(
                modifier = Modifier
                    .size(180.dp)
                    .scale(pulseScale)
                    .clip(CircleShape)
                    .background(MarianBurgundy.copy(alpha = 0.08f))
            )

            // Inner NFC Target
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .clip(CircleShape)
                    .background(MarianBurgundy),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Nfc,
                    contentDescription = "Tap Card",
                    tint = ChurchGold,
                    modifier = Modifier.size(72.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "READY FOR NFC CARD",
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = DeepClaret,
            letterSpacing = 1.sp
        )

        Text(
            text = "Hold participant card against the back of this phone",
            fontSize = 13.sp,
            color = TextSecondaryDark,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp, start = 24.dp, end = 24.dp)
        )
    }
}

@Composable
private fun ProcessingTargetView() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(80.dp),
            color = MarianBurgundy,
            strokeWidth = 6.dp
        )
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Verifying Card...",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = DeepClaret
        )
        Text(
            text = "Validating cryptographic token with parish gate authority",
            fontSize = 13.sp,
            color = TextSecondaryDark
        )
    }
}

@Composable
private fun SuccessResultCard(result: com.blessedsacramentparish.checkin.data.repository.GateCheckInResult.CheckedIn) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 6.dp,
        border = androidx.compose.foundation.BorderStroke(2.dp, EmeraldVerified)
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(EmeraldVerified.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = EmeraldVerified,
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = EmeraldVerified.copy(alpha = 0.12f)
            ) {
                Text(
                    text = "CHECKED IN",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = EmeraldVerified,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = result.participantName,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimaryDark,
                textAlign = TextAlign.Center
            )

            Text(
                text = "ID: ${result.participantNumber}",
                fontSize = 14.sp,
                color = TextSecondaryDark,
                modifier = Modifier.padding(top = 2.dp)
            )

            result.parishGroup?.let { group ->
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = DeepClaret.copy(alpha = 0.08f),
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Text(
                        text = group,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = DeepClaret,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun DuplicateResultCard(result: com.blessedsacramentparish.checkin.data.repository.GateCheckInResult.AlreadyCheckedIn) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 6.dp,
        border = androidx.compose.foundation.BorderStroke(2.dp, AmberWarning)
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(AmberWarning.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Warning,
                    contentDescription = null,
                    tint = AmberWarning,
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = AmberWarning.copy(alpha = 0.15f)
            ) {
                Text(
                    text = "ALREADY CHECKED IN",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = AmberWarning,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = result.participantName,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimaryDark,
                textAlign = TextAlign.Center
            )

            Text(
                text = "ID: ${result.participantNumber}",
                fontSize = 14.sp,
                color = TextSecondaryDark,
                modifier = Modifier.padding(top = 2.dp)
            )

            Text(
                text = "Card was already scanned for this event session.",
                fontSize = 13.sp,
                color = TextSecondaryDark,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
private fun OfflineSavedCard(result: com.blessedsacramentparish.checkin.data.repository.GateCheckInResult.SavedOffline) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 6.dp,
        border = androidx.compose.foundation.BorderStroke(2.dp, DeepClaret)
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(DeepClaret.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.CloudOff,
                    contentDescription = null,
                    tint = DeepClaret,
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = DeepClaret.copy(alpha = 0.1f)
            ) {
                Text(
                    text = "SAVED SECURELY OFFLINE",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = DeepClaret,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Check-In Encrypted & Queued",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimaryDark,
                textAlign = TextAlign.Center
            )

            Text(
                text = "Network is currently unreachable. Encrypted with hardware AES-256-GCM. Will automatically synchronize when connectivity resumes.",
                fontSize = 13.sp,
                color = TextSecondaryDark,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
private fun ErrorResultCard(title: String, message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 6.dp,
        border = androidx.compose.foundation.BorderStroke(2.dp, RubyError)
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(RubyError.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Error,
                    contentDescription = null,
                    tint = RubyError,
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = RubyError.copy(alpha = 0.15f)
            ) {
                Text(
                    text = "CARD REJECTED",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = RubyError,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = RubyError,
                textAlign = TextAlign.Center
            )

            Text(
                text = message,
                fontSize = 14.sp,
                color = TextSecondaryDark,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}
