package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.nirai.app.network.NiraiApi
import org.nirai.app.ui.theme.NiraiTheme
import org.nirai.app.utils.PendingSos
import org.nirai.app.utils.PendingSosStore
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val TAG = "NIRAI_SOS"
private val EmergencyRed = Color(0xFFB42318)
private val SuccessGreen = Color(0xFF15803D)

private data class GpsReading(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val timestampMillis: Long
)

private fun validLocation(location: Location): Boolean =
    location.latitude.isFinite() &&
        location.longitude.isFinite() &&
        location.latitude in -90.0..90.0 &&
        location.longitude in -180.0..180.0 &&
        (location.latitude != 0.0 || location.longitude != 0.0) &&
        location.accuracy.isFinite() &&
        location.accuracy >= 0f

private suspend fun requestFreshLocation(context: Context): GpsReading {
    val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    check(fineGranted || coarseGranted) { "Location permission is required to send an SOS." }

    val request = CurrentLocationRequest.Builder()
        .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
        .setMaxUpdateAgeMillis(0L)
        .setDurationMillis(15_000L)
        .build()
    val cancellation = CancellationTokenSource()
    val client = LocationServices.getFusedLocationProviderClient(context)
    val location = suspendCancellableCoroutine<Location> { continuation ->
        continuation.invokeOnCancellation { cancellation.cancel() }
        try {
            client.getCurrentLocation(request, cancellation.token)
                .addOnSuccessListener { result ->
                    if (result == null) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(IllegalStateException("GPS could not get a fresh fix. Move to an open area and retry."))
                        }
                    } else if (continuation.isActive) {
                        continuation.resume(result)
                    }
                }
                .addOnFailureListener { error ->
                    if (continuation.isActive) continuation.resumeWithException(error)
                }
        } catch (error: SecurityException) {
            if (continuation.isActive) continuation.resumeWithException(error)
        }
    }

    check(validLocation(location)) { "GPS returned invalid coordinates. Please retry." }
    return GpsReading(
        latitude = location.latitude,
        longitude = location.longitude,
        accuracyMeters = location.accuracy,
        timestampMillis = location.time
    )
}

private fun hasInternetConnection(context: Context): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val network = manager.activeNetwork ?: return false
    val capabilities = manager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

private fun openEmergencySmsDraft(context: Context, caseId: String): Boolean {
    val pending = PendingSosStore.getPending(context).firstOrNull { it.caseId == caseId } ?: return false
    val savedContacts = context.getSharedPreferences("nirai_contacts", Context.MODE_PRIVATE)
        .getString("emergency_contacts", null)
        .orEmpty()
    val recipient = savedContacts.split("|||")
        .mapNotNull { entry -> entry.split("::").getOrNull(1)?.trim()?.takeIf { it.isNotBlank() } }
        .firstOrNull() ?: return false
    val digits = recipient.filter { it.isDigit() }
    if (digits.length < 7) return false
    val message = "NIRAI SOS alert is awaiting internet delivery. Please contact me. Case: $caseId. Current location: https://maps.google.com/?q=${pending.latitude},${pending.longitude}"
    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(recipient)}"))
        .putExtra("sms_body", message)
    return runCatching {
        context.startActivity(intent)
        true
    }.getOrDefault(false)
}

@Composable
fun CivilianHomeScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }
    var location by remember { mutableStateOf<GpsReading?>(null) }
    var locationMessage by remember { mutableStateOf("Location has not been verified yet.") }
    var isRefreshingLocation by remember { mutableStateOf(false) }
    var isOnline by remember { mutableStateOf(hasInternetConnection(context)) }
    var countdown by remember { mutableIntStateOf(0) }
    var isSubmitting by remember { mutableStateOf(false) }
    var isCancelling by remember { mutableStateOf(false) }
    var locationDetailsExpanded by remember { mutableStateOf(false) }
    var secondsSinceLocation by remember { mutableIntStateOf(0) }
    var activeCaseId by remember { mutableStateOf(PendingSosStore.getActiveCaseId(context)) }
    var cancelledCaseId by remember { mutableStateOf<String?>(null) }
    var backendStatus by remember { mutableStateOf("raised") }
    var deliveryMessage by remember { mutableStateOf<String?>(null) }
    var pendingCaseId by remember { mutableStateOf(PendingSosStore.getPending(context).firstOrNull()?.caseId) }
    var pendingCount by remember { mutableIntStateOf(PendingSosStore.getPending(context).size) }
    var countdownJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        hasLocationPermission = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (!hasLocationPermission) {
            locationMessage = "Location permission is off. Allow access to share your current position."
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            isOnline = hasInternetConnection(context)
            pendingCount = PendingSosStore.getPending(context).size
            delay(3000)
        }
    }

    LaunchedEffect(hasLocationPermission) {
        if (hasLocationPermission && location == null) {
            isRefreshingLocation = true
            try {
                location = requestFreshLocation(context)
                locationMessage = "Current device location detected."
            } catch (error: Exception) {
                locationMessage = error.message ?: "Unable to get a fresh GPS location."
            } finally {
                isRefreshingLocation = false
            }
        }
    }

    LaunchedEffect(location?.timestampMillis) {
        while (location != null) {
            secondsSinceLocation = ((System.currentTimeMillis() - location!!.timestampMillis).coerceAtLeast(0L) / 1000L).toInt()
            delay(1000)
        }
    }

    LaunchedEffect(isOnline, pendingCount, isSubmitting, activeCaseId) {
        if (isOnline && !isSubmitting && activeCaseId == null) {
            while (true) {
                val queued = PendingSosStore.getPending(context)
                if (queued.isEmpty()) break
                queued.forEach { sos ->
                    if (isSubmitting || activeCaseId != null || pendingCaseId != sos.caseId) {
                        return@forEach
                    }
                    try {
                        val confirmedId = NiraiApi.postSos(
                            caseId = sos.caseId,
                            lat = sos.latitude,
                            lng = sos.longitude,
                            accuracyMeters = sos.accuracyMeters,
                            timestampMillis = sos.timestampMillis,
                            reporterName = sos.reporterName,
                            reporterPhone = sos.reporterPhone,
                            address = sos.address
                        )
                        PendingSosStore.remove(context, sos.caseId)
                        if (pendingCaseId == sos.caseId && activeCaseId == null && cancelledCaseId != sos.caseId) {
                            activeCaseId = confirmedId
                            cancelledCaseId = null
                            PendingSosStore.saveActiveCaseId(context, confirmedId)
                            pendingCaseId = null
                            backendStatus = "raised"
                            deliveryMessage = "SOS accepted by the NIRAI backend."
                        }
                    } catch (error: CancellationException) {
                        throw error
                    } catch (_: Exception) {
                        // Keep the durable outbox entry; retry when connectivity is restored.
                    }
                }
                pendingCount = PendingSosStore.getPending(context).size
                if (PendingSosStore.getPending(context).isNotEmpty()) delay(15_000)
            }
        }
    }

    LaunchedEffect(activeCaseId, isOnline) {
        val caseId = activeCaseId ?: return@LaunchedEffect
        while (isOnline && activeCaseId == caseId) {
            try {
                val details = NiraiApi.getCaseById(caseId)
                if (details != null) {
                    backendStatus = details.first
                    if (details.first == "false_alarm") {
                        cancelledCaseId = caseId
                        activeCaseId = null
                        PendingSosStore.clearActiveCaseId(context)
                        deliveryMessage = "Cancellation confirmed by the backend."
                        break
                    }
                    if (details.first == "resolved") {
                        activeCaseId = null
                        PendingSosStore.clearActiveCaseId(context)
                        deliveryMessage = "This emergency case was marked resolved."
                        break
                    }
                }
            } catch (_: Exception) {
                // The last backend-confirmed state remains visible during a temporary outage.
            }
            delay(5000)
        }
    }

    fun refreshLocation() {
        if (!hasLocationPermission) {
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            return
        }
        scope.launch {
            isRefreshingLocation = true
            locationMessage = "Requesting a fresh high-accuracy GPS fix…"
            try {
                location = requestFreshLocation(context)
                locationMessage = "Current device location detected."
            } catch (error: Exception) {
                location = null
                locationMessage = error.message ?: "Unable to get a fresh GPS location."
            } finally {
                isRefreshingLocation = false
            }
        }
    }

    fun beginCountdown() {
        if (activeCaseId != null || pendingCaseId != null || isSubmitting) return
        if (!hasLocationPermission) {
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            return
        }
        countdownJob?.cancel()
        countdownJob = scope.launch {
            try {
                for (second in 5 downTo 1) {
                    countdown = second
                    delay(1000)
                }
                countdown = 0
                isSubmitting = true
                deliveryMessage = null
                locationMessage = "Getting a fresh GPS fix before sending the alert…"

                val fresh = requestFreshLocation(context)
                location = fresh
                val caseId = "case-${UUID.randomUUID()}"
                val sos = PendingSos(
                    caseId = caseId,
                    latitude = fresh.latitude,
                    longitude = fresh.longitude,
                    accuracyMeters = fresh.accuracyMeters,
                    timestampMillis = fresh.timestampMillis,
                    reporterName = "Civilian User",
                    reporterPhone = "+919876543210",
                    address = "Current device GPS location"
                )
                val persisted = PendingSosStore.enqueue(context, sos)
                pendingCaseId = caseId
                pendingCount = PendingSosStore.getPending(context).size
                Log.i(TAG, "SOS LOCATION: latitude=${fresh.latitude}, longitude=${fresh.longitude}, accuracy=${fresh.accuracyMeters}m, timestamp=${fresh.timestampMillis}")

                if (!isOnline) {
                    deliveryMessage = if (persisted) {
                        "Not delivered. Saved securely on this device; it will retry when internet returns."
                    } else {
                        "No network connection and local save failed. No alert was delivered."
                    }
                } else {
                    try {
                        val confirmedId = NiraiApi.postSos(
                            caseId = sos.caseId,
                            lat = sos.latitude,
                            lng = sos.longitude,
                            accuracyMeters = sos.accuracyMeters,
                            timestampMillis = sos.timestampMillis,
                            reporterName = sos.reporterName,
                            reporterPhone = sos.reporterPhone,
                            address = sos.address
                        )
                        PendingSosStore.remove(context, sos.caseId)
                        pendingCaseId = null
                        pendingCount = PendingSosStore.getPending(context).size
                        activeCaseId = confirmedId
                        cancelledCaseId = null
                        PendingSosStore.saveActiveCaseId(context, confirmedId)
                        backendStatus = "raised"
                        deliveryMessage = "Alert accepted by the NIRAI backend. The Command Center has been notified."
                    } catch (error: Exception) {
                        deliveryMessage = if (persisted) {
                            "Not delivered yet. Saved on this device; automatic retry is pending. ${error.message.orEmpty()}"
                        } else {
                            "Alert was not delivered and could not be saved locally. ${error.message.orEmpty()}"
                        }
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                location = null
                locationMessage = error.message ?: "Current location is unavailable. No SOS was sent."
                deliveryMessage = "No alert was sent. Retry after location becomes available."
            } finally {
                countdown = 0
                isSubmitting = false
            }
        }
    }

    fun cancelEmergency() {
        if (isCancelling) return
        val caseId = activeCaseId
        if (caseId == null) {
            val queuedId = pendingCaseId ?: return
            PendingSosStore.remove(context, queuedId)
            pendingCaseId = null
            pendingCount = PendingSosStore.getPending(context).size
            deliveryMessage = "The unsent alert was removed from this device."
            return
        }
        if (backendStatus == "on_scene" || backendStatus == "resolved" || isCancelling) return
        isCancelling = true
        scope.launch {
            try {
                check(NiraiApi.cancelCase(caseId)) { "The backend did not confirm cancellation." }
                backendStatus = "false_alarm"
                cancelledCaseId = caseId
                activeCaseId = null
                PendingSosStore.clearActiveCaseId(context)
                if (pendingCaseId == caseId) {
                    PendingSosStore.remove(context, caseId)
                    pendingCaseId = null
                    pendingCount = PendingSosStore.getPending(context).size
                }
                deliveryMessage = "Cancellation confirmed."
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                deliveryMessage = error.message ?: "Cancellation failed. The emergency remains active."
            } finally {
                isCancelling = false
            }
        }
    }

    val isEmergencyActive = activeCaseId != null
    val isPendingDelivery = !isEmergencyActive && pendingCaseId != null
    val isEmergencyCancelled = cancelledCaseId != null
    val displayedCaseId = activeCaseId ?: cancelledCaseId ?: pendingCaseId
    val locationAgeLabel = when {
        location == null -> "Not available"
        secondsSinceLocation < 60 -> "$secondsSinceLocation seconds ago"
        else -> "${secondsSinceLocation / 60} minutes ago"
    }

    NiraiTheme {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("NIRAI", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("Emergency Response", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Icon(Icons.Default.Shield, contentDescription = "NIRAI public safety", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatusChip(
                    label = if (location != null) "Location active" else "Location unavailable",
                    active = location != null,
                    icon = if (location != null) Icons.Default.MyLocation else Icons.Default.LocationOff,
                    modifier = Modifier.weight(1f)
                )
                StatusChip(
                    label = if (isOnline) "Network connected" else "Network offline",
                    active = isOnline,
                    icon = if (isOnline) Icons.Default.Wifi else Icons.Default.WifiOff,
                    modifier = Modifier.weight(1f)
                )
            }

            if (isEmergencyActive || isPendingDelivery || isEmergencyCancelled) {
                EmergencyStatusCard(
                    caseId = displayedCaseId.orEmpty(),
                    backendStatus = backendStatus,
                    isConfirmed = isEmergencyActive,
                    isCancelled = isEmergencyCancelled,
                    isSending = isSubmitting,
                    isCancelling = isCancelling,
                    deliveryMessage = deliveryMessage,
                    canCancel = backendStatus !in setOf("on_scene", "resolved", "false_alarm"),
                    onCancel = ::cancelEmergency,
                    onSmsFallback = {
                        val queuedId = pendingCaseId
                        when {
                            queuedId == null -> deliveryMessage = "No locally queued alert is available for SMS."
                            openEmergencySmsDraft(context, queuedId) -> deliveryMessage = "SMS draft opened for your saved emergency contact. Review and send it in your messaging app."
                            else -> deliveryMessage = "Could not open SMS. Add a valid emergency contact in Profile and make sure a messaging app is available."
                        }
                    }
                )
            }
            if (!isEmergencyActive && !isPendingDelivery) {
                SosActionCard(
                    countdown = countdown,
                    isSubmitting = isSubmitting,
                    hasLocation = location != null,
                    deliveryMessage = deliveryMessage,
                    onStart = ::beginCountdown,
                    onCancelCountdown = {
                        countdownJob?.cancel()
                        countdown = 0
                        deliveryMessage = "Countdown cancelled. No SOS was sent."
                    }
                )
            }

            LocationCard(
                location = location,
                message = locationMessage,
                ageLabel = locationAgeLabel,
                expanded = locationDetailsExpanded,
                isRefreshing = isRefreshingLocation,
                onRefresh = ::refreshLocation,
                onToggleDetails = { locationDetailsExpanded = !locationDetailsExpanded }
            )

            QuickActions(
                location = location,
                onCallEmergency = {
                    runCatching {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:112")))
                    }.onFailure {
                        deliveryMessage = "Unable to open the phone dialer."
                    }
                },
                onShareLocation = {
                    val current = location
                    if (current == null) {
                        deliveryMessage = "Location is not available to share. Refresh GPS and try again."
                    } else {
                        val message = "My current location: https://maps.google.com/?q=${current.latitude},${current.longitude}"
                        runCatching {
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, message)
                            }, "Share current location"))
                        }.onFailure {
                            deliveryMessage = "Unable to open the share menu."
                        }
                    }
                }
            )

            if (pendingCount > 0) {
                Text(
                    text = "$pendingCount alert${if (pendingCount == 1) "" else "s"} saved locally and awaiting backend confirmation. They are not yet delivered.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun StatusChip(
    label: String,
    active: Boolean,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    val tint = if (active) SuccessGreen else MaterialTheme.colorScheme.error
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(17.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
    }
}

@Composable
private fun SosActionCard(
    countdown: Int,
    isSubmitting: Boolean,
    hasLocation: Boolean,
    deliveryMessage: String?,
    onStart: () -> Unit,
    onCancelCountdown: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (countdown > 0) {
                Text("Emergency alert in", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(countdown.toString(), style = MaterialTheme.typography.displayLarge, fontWeight = FontWeight.Bold, color = EmergencyRed)
                Text("Cancel if this was accidental.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(20.dp))
                OutlinedButton(onClick = onCancelCountdown, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Cancel, null)
                    Spacer(Modifier.width(8.dp))
                    Text("CANCEL")
                }
            } else if (isSubmitting) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(14.dp))
                Text("Getting location and contacting the Command Center…", textAlign = TextAlign.Center)
            } else {
                Button(
                    onClick = onStart,
                    modifier = Modifier.size(196.dp),
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = EmergencyRed, contentColor = Color.White),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 7.dp, pressedElevation = 2.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(30.dp))
                        Spacer(Modifier.height(3.dp))
                        Text("SOS", fontSize = 38.sp, fontWeight = FontWeight.Black)
                        Text("GET HELP", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(18.dp))
                Text("Tap to start a 5-second confirmation countdown.", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
                Text(
                    if (hasLocation) "A fresh GPS fix is requested before sending." else "Location is required; no default location will be sent.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
            if (!deliveryMessage.isNullOrBlank()) {
                Spacer(Modifier.height(14.dp))
                Text(
                    deliveryMessage,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (deliveryMessage.startsWith("Alert accepted")) SuccessGreen else MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun EmergencyStatusCard(
    caseId: String,
    backendStatus: String,
    isConfirmed: Boolean,
    isCancelled: Boolean,
    isSending: Boolean,
    isCancelling: Boolean,
    deliveryMessage: String?,
    canCancel: Boolean,
    onCancel: () -> Unit,
    onSmsFallback: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(
                    if (isConfirmed || isCancelled) Icons.Default.CheckCircle else Icons.Default.AccessTime,
                    contentDescription = null,
                    tint = if (isConfirmed || isCancelled) SuccessGreen else MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(27.dp)
                )
                Column {
                    Text(
                        when {
                            isCancelled -> "EMERGENCY CANCELLED"
                            isConfirmed -> "EMERGENCY ACTIVE"
                            else -> "ALERT PENDING DELIVERY"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        when {
                            isCancelled -> "Cancellation confirmed."
                            isConfirmed -> statusLabel(backendStatus)
                            else -> "Not yet confirmed by the backend"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                Column(modifier = Modifier.fillMaxWidth().padding(13.dp)) {
                    Text(if (isConfirmed || isCancelled) "CASE ID" else "LOCAL ALERT ID", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(caseId, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val confirmed = isConfirmed || isCancelled
                TimelineStep("SOS raised", confirmed, confirmed || backendStatus == "raised")
                TimelineStep("Command Center notified", confirmed, confirmed && backendStatus in setOf("raised", "false_alarm"))
                TimelineStep("Responder assigned", confirmed && backendStatus in setOf("unit_assigned", "airborne", "on_scene", "resolved"), backendStatus == "unit_assigned")
                TimelineStep("Response in progress", confirmed && backendStatus in setOf("airborne", "on_scene", "resolved"), backendStatus == "airborne" || backendStatus == "on_scene")
                TimelineStep("Resolved", confirmed && backendStatus == "resolved", backendStatus == "resolved")
            }

            if (!deliveryMessage.isNullOrBlank()) {
                Text(
                    deliveryMessage,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isConfirmed || isCancelled) SuccessGreen else MaterialTheme.colorScheme.error
                )
            }
            if (!isConfirmed && !isCancelled && !isSending) {
                OutlinedButton(onClick = onSmsFallback, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Prepare SMS to saved contact")
                }
                Text(
                    "Your messaging app opens with a draft; it is not sent until you review and send it.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (canCancel && !isSending && (isConfirmed || caseId.isNotBlank())) {
                OutlinedButton(
                    onClick = onCancel,
                    enabled = !isCancelling,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isCancelling) CircularProgressIndicator(modifier = Modifier.size(17.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Default.Cancel, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (isCancelling) "CANCELLING..." else if (isConfirmed) "Cancel emergency" else "Remove unsent alert")
                }
            }
        }
    }
}

@Composable
private fun TimelineStep(label: String, completed: Boolean, current: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            modifier = Modifier.size(10.dp).clip(CircleShape)
                .background(if (completed) SuccessGreen else if (current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)
        )
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = if (completed || current) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (completed) {
            Spacer(Modifier.weight(1f))
            Icon(Icons.Default.CheckCircle, contentDescription = "Completed", tint = SuccessGreen, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun LocationCard(
    location: GpsReading?,
    message: String,
    ageLabel: String,
    expanded: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    onToggleDetails: () -> Unit
) {
    Card(shape = RoundedCornerShape(20.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(17.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (location != null) Icons.Default.MyLocation else Icons.Default.LocationOff,
                    contentDescription = null,
                    tint = if (location != null) SuccessGreen else MaterialTheme.colorScheme.error
                )
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("CURRENT LOCATION", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Text(
                        if (location != null) "Location detected" else message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                TextButton(onClick = onRefresh, enabled = !isRefreshing) {
                    if (isRefreshing) CircularProgressIndicator(modifier = Modifier.size(17.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Default.Refresh, contentDescription = "Refresh GPS")
                }
            }
            if (location != null) {
                Spacer(Modifier.height(8.dp))
                Text("Accuracy ±${location.accuracyMeters.toInt()} m · Updated $ageLabel", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = onToggleDetails) {
                    Text(if (expanded) "Hide location details" else "Location details")
                    Spacer(Modifier.width(4.dp))
                    Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null)
                }
                if (expanded) {
                    Text("Latitude  ${location.latitude}", style = MaterialTheme.typography.bodySmall)
                    Text("Longitude  ${location.longitude}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun QuickActions(
    location: GpsReading?,
    onCallEmergency: () -> Unit,
    onShareLocation: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("QUICK ACTIONS", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            QuickActionCard(
                title = "Call 112",
                subtitle = "Open phone dialer",
                icon = Icons.Default.Phone,
                onClick = onCallEmergency,
                modifier = Modifier.weight(1f)
            )
            QuickActionCard(
                title = "Share location",
                subtitle = if (location == null) "Location unavailable" else "Send a map link",
                icon = Icons.Default.Share,
                onClick = onShareLocation,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun QuickActionCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun statusLabel(status: String): String = when (status) {
    "raised" -> "Alert sent · awaiting acknowledgement"
    "verifying" -> "Command Center is verifying the alert"
    "unit_assigned" -> "A responder has been assigned"
    "airborne" -> "Response in progress"
    "on_scene" -> "Responder marked on scene"
    "resolved" -> "Case resolved"
    "false_alarm" -> "Case cancelled"
    else -> "Status: $status"
}
