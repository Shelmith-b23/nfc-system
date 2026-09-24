package com.blessedsacramentparish.checkin.ui.screens.events

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.blessedsacramentparish.checkin.data.api.models.ParishEventDto
import com.blessedsacramentparish.checkin.ui.theme.BorderSubtle
import com.blessedsacramentparish.checkin.ui.theme.ChurchGold
import com.blessedsacramentparish.checkin.ui.theme.ChurchGoldLight
import com.blessedsacramentparish.checkin.ui.theme.DeepClaret
import com.blessedsacramentparish.checkin.ui.theme.EmeraldVerified
import com.blessedsacramentparish.checkin.ui.theme.MarianBurgundy
import com.blessedsacramentparish.checkin.ui.theme.TextPrimaryDark
import com.blessedsacramentparish.checkin.ui.theme.TextSecondaryDark
import com.blessedsacramentparish.checkin.ui.theme.WarmParchment

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventSelectionScreen(
    onSelectEvent: (eventId: String, title: String) -> Unit,
    onLogout: () -> Unit,
    viewModel: EventSelectionViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.isLoggedOut) {
        if (state.isLoggedOut) {
            onLogout()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Select Parish Event",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Gate: ${state.deviceCode}",
                            fontSize = 12.sp,
                            color = ChurchGoldLight
                        )
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::loadEvents) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color.White)
                    }
                    IconButton(onClick = viewModel::logout) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout", tint = Color.White)
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
            // Operator Header Card
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(12.dp),
                color = Color.White,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(MarianBurgundy.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = MarianBurgundy,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = state.operator?.let { "${it.firstName} ${it.lastName}" } ?: "Gate Operator",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TextPrimaryDark
                        )
                        Text(
                            text = state.operator?.role ?: "CHECK_IN_OPERATOR",
                            fontSize = 12.sp,
                            color = TextSecondaryDark
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = EmeraldVerified.copy(alpha = 0.12f)
                    ) {
                        Text(
                            text = "AUTHORIZED",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = EmeraldVerified,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            Text(
                text = "AVAILABLE GATES & SESSIONS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = TextSecondaryDark,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )

            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MarianBurgundy)
                }
            } else if (state.events.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Event,
                            contentDescription = null,
                            tint = TextSecondaryDark,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No Active Events Scheduled",
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )
                        Text(
                            text = "Ensure events are marked LIVE or have NFC check-in enabled.",
                            fontSize = 13.sp,
                            color = TextSecondaryDark,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(state.events) { event ->
                        EventCard(
                            event = event,
                            onClick = { onSelectEvent(event.id, event.title) }
                        )
                    }
                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@Composable
private fun EventCard(
    event: ParishEventDto,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = Color.White,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(DeepClaret.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Nfc,
                    contentDescription = null,
                    tint = DeepClaret,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = TextPrimaryDark
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = TextSecondaryDark,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = event.venue,
                        fontSize = 13.sp,
                        color = TextSecondaryDark
                    )
                }
            }

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = "Open Gate",
                tint = TextSecondaryDark
            )
        }
    }
}
