package com.blessedsacramentparish.checkin.ui.screens.login

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.blessedsacramentparish.checkin.ui.theme.ChurchGold
import com.blessedsacramentparish.checkin.ui.theme.DeepClaret
import com.blessedsacramentparish.checkin.ui.theme.MarianBurgundy
import com.blessedsacramentparish.checkin.ui.theme.RubyError
import com.blessedsacramentparish.checkin.ui.theme.TextPrimaryDark
import com.blessedsacramentparish.checkin.ui.theme.TextSecondaryDark
import com.blessedsacramentparish.checkin.ui.theme.WarmParchment

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var passwordVisible by remember { mutableStateOf(false) }
    var showAdvancedSettings by remember { mutableStateOf(false) }

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) {
            onLoginSuccess()
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = WarmParchment
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Parish Emblem Badge
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(MarianBurgundy),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Nfc,
                    contentDescription = "Parish NFC Gate",
                    tint = ChurchGold,
                    modifier = Modifier.size(38.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Blessed Sacrament Catholic Parish",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = DeepClaret,
                textAlign = TextAlign.Center
            )

            Text(
                text = "Buru Phase III, Mumias Road, Nairobi",
                fontSize = 13.sp,
                color = TextSecondaryDark,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 2.dp)
            )

            Spacer(modifier = Modifier.height(28.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                shadowElevation = 2.dp
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Gate Operator Sign In",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimaryDark
                    )

                    Text(
                        text = "Authorized gate operators only",
                        fontSize = 13.sp,
                        color = TextSecondaryDark,
                        modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                    )

                    // Error Message
                    state.errorMessage?.let { msg ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = RubyError.copy(alpha = 0.1f)
                        ) {
                            Text(
                                text = msg,
                                color = RubyError,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                            )
                        }
                    }

                    // Email Field
                    OutlinedTextField(
                        value = state.email,
                        onValueChange = viewModel::onEmailChanged,
                        label = { Text("Operator Email") },
                        leadingIcon = {
                            Icon(Icons.Default.Mail, contentDescription = null, tint = TextSecondaryDark)
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MarianBurgundy,
                            focusedLabelColor = MarianBurgundy
                        )
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Password Field
                    OutlinedTextField(
                        value = state.password,
                        onValueChange = viewModel::onPasswordChanged,
                        label = { Text("Password") },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondaryDark)
                        },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                    tint = TextSecondaryDark
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = { viewModel.login() }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MarianBurgundy,
                            focusedLabelColor = MarianBurgundy
                        )
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Sign In Button
                    Button(
                        onClick = viewModel::login,
                        enabled = !state.isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MarianBurgundy,
                            contentColor = Color.White
                        )
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = ChurchGold,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "Sign In to Gate",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Toggle Advanced / Gate Config
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { showAdvancedSettings = !showAdvancedSettings }) {
                            Icon(
                                Icons.Default.Settings,
                                contentDescription = "Gate Settings",
                                tint = TextSecondaryDark
                            )
                        }
                        Text(
                            text = if (showAdvancedSettings) "Hide Gate Config" else "Configure Gate / Device",
                            fontSize = 12.sp,
                            color = TextSecondaryDark
                        )
                    }

                    if (showAdvancedSettings) {
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = state.deviceCode,
                            onValueChange = viewModel::onDeviceCodeChanged,
                            label = { Text("Gate Device Code") },
                            leadingIcon = {
                                Icon(Icons.Default.PhoneAndroid, contentDescription = null, tint = TextSecondaryDark)
                            },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MarianBurgundy
                            )
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = state.baseUrl,
                            onValueChange = viewModel::onBaseUrlChanged,
                            label = { Text("Backend API URL") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MarianBurgundy
                            )
                        )
                    }
                }
            }
        }
    }
}
