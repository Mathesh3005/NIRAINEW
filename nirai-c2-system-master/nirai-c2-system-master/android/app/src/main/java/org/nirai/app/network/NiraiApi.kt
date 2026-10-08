package org.nirai.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.nirai.app.BuildConfig
import org.json.JSONObject
import android.os.Build
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/** NIRAI C2 HTTP client for backend SOS and case operations. */
object NiraiApi {

    var BASE_URL = if (isAndroidEmulator()) {
        BuildConfig.BACKEND_URL_EMULATOR
    } else {
        BuildConfig.BACKEND_URL_PHYSICAL
    }
    private const val FIREBASE_API_KEY = "AIzaSyBKYowgbbyApg-jbjJUwXQh69DHtxKJUvU"
    private const val FIREBASE_PROJECT_ID = "siteon-47a8f"
    private fun isAndroidEmulator(): Boolean =
        Build.FINGERPRINT.startsWith("generic") ||
            Build.MODEL.contains("google_sdk", ignoreCase = true) ||
            Build.MODEL.contains("Emulator", ignoreCase = true) ||
            Build.MODEL.contains("Android SDK built for", ignoreCase = true) ||
            Build.MANUFACTURER.contains("Genymotion", ignoreCase = true) ||
            Build.HARDWARE in setOf("goldfish", "ranchu", "vbox86")

    /**
     * Returns only after the backend confirms the SOS. Failures are thrown so callers
     * can persist the request and report that delivery is still pending.
     */
    suspend fun postSos(
        caseId: String,
        lat: Double,
        lng: Double,
        accuracyMeters: Float,
        timestampMillis: Long,
        reporterName: String,
        reporterPhone: String,
        address: String
    ): String = withContext(Dispatchers.IO) {
        require(lat.isFinite() && lat in -90.0..90.0) { "Latitude is unavailable or invalid." }
        require(lng.isFinite() && lng in -180.0..180.0) { "Longitude is unavailable or invalid." }
        require(lat != 0.0 || lng != 0.0) { "The location fix is invalid. Please retry GPS." }

        var connection: HttpURLConnection? = null
        try {
            val url = URL("$BASE_URL/v1/sos")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }
            val body = JSONObject()
                .put("caseId", caseId)
                .put("lat", lat)
                .put("lng", lng)
                .put("accuracy", accuracyMeters.toDouble())
                .put("timestamp", timestampMillis)
                .put("reporterName", reporterName)
                .put("reporterPhone", reporterPhone)
                .put("address", address)
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }

            val responseCode = connection.responseCode
            val responseStream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
            val responseText = responseStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (responseCode !in 200..299) {
                val error = runCatching { JSONObject(responseText).optString("error") }.getOrNull()
                throw IllegalStateException(error?.takeIf { it.isNotBlank() } ?: "Backend rejected SOS (HTTP $responseCode).")
            }

            val response = JSONObject(responseText)
            if (!response.optBoolean("success", false)) {
                throw IllegalStateException("Backend did not confirm the SOS.")
            }
            val returnedCaseId = response.optString("caseId").ifBlank {
                response.optJSONObject("case")?.optString("id").orEmpty()
            }
            if (returnedCaseId.isBlank()) throw IllegalStateException("Backend response did not include a case ID.")
            returnedCaseId
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * Cancel an active SOS case.
     */
    suspend fun cancelCase(caseId: String, cancelledBy: String = "civilian"): Boolean = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId/cancel")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 4000
                readTimeout = 4000
            }
            val body = JSONObject().put("cancelledBy", cancelledBy).toString()
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body) }
            val code = connection.responseCode
            val responseStream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseText = responseStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                val error = runCatching { JSONObject(responseText).optString("error") }.getOrNull()
                throw IllegalStateException(
                    error?.takeIf { it.isNotBlank() } ?: "Backend rejected case cancellation (HTTP $code)."
                )
            }

            if (responseText.isBlank()) {
                throw IllegalStateException("Backend returned HTTP $code without confirming cancellation.")
            }
            val response = try {
                JSONObject(responseText)
            } catch (error: Exception) {
                throw IllegalStateException("Backend returned an invalid cancellation response.", error)
            }
            if (!response.optBoolean("success", false)) {
                throw IllegalStateException(
                    response.optString("error").takeIf { it.isNotBlank() }
                        ?: "Backend did not confirm cancellation."
                )
            }
            val cancelledCase = response.optJSONObject("case")
                ?: throw IllegalStateException("Backend did not return the cancelled case.")
            if (cancelledCase.optString("id") != caseId) {
                throw IllegalStateException("Backend confirmed cancellation for a different case.")
            }
            if (cancelledCase.optString("status") != "false_alarm") {
                throw IllegalStateException("Backend did not mark the case as cancelled.")
            }
            true
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun updateOfficerLocation(
        userId: String,
        lat: Double,
        lng: Double,
        onDuty: Boolean
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/officers/location")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """
                {
                    "userId": "$userId",
                    "lat": $lat,
                    "lng": $lng,
                    "onDuty": $onDuty
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun updateDroneTelemetry(
        droneId: String,
        lat: Double,
        lng: Double,
        altitudeMeters: Int,
        batteryPct: Int,
        status: String
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/drones/telemetry")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """
                {
                    "droneId": "$droneId",
                    "lat": $lat,
                    "lng": $lng,
                    "altitudeMeters": $altitudeMeters,
                    "batteryPct": $batteryPct,
                    "status": "$status"
                }
            """.trimIndent()
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun acknowledgeCase(
        caseId: String,
        officerUserId: String
    ): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId/assign")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            val body = """{"officerUserId": "$officerUserId"}"""
            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getCases(): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            response
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Send live optical video frame and acoustic audio chunk from mobile node.
     * Supports both drone node IDs (e.g. "drone-c1") and SOS case IDs (e.g. "case-101").
     */
    suspend fun sendDroneFrame(
        droneId: String,
        frameBase64: String,
        audioBase64: String? = null,
        decibelLevel: Int? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/drones/stream-frame")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 3000
                readTimeout = 3000
            }
            val audioPart = if (audioBase64 != null) """, "audioData": "$audioBase64"""" else ""
            val dbPart = if (decibelLevel != null) """, "decibelLevel": $decibelLevel""" else ""
            val body = """{"droneId": "$droneId", "frameData": "$frameBase64"$audioPart$dbPart}"""

            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Send dedicated civilian scene video frame and acoustic audio buffer to SOS case endpoint.
     */
    suspend fun sendCaseMediaFeed(
        caseId: String,
        frameBase64: String?,
        audioBase64: String? = null,
        decibelLevel: Int? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId/stream-frame")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 3000
                readTimeout = 3000
            }
            val framePart = if (frameBase64 != null) """"frameData": "$frameBase64"""" else """"frameData": null"""
            val audioPart = if (audioBase64 != null) """, "audioData": "$audioBase64"""" else ""
            val dbPart = if (decibelLevel != null) """, "decibelLevel": $decibelLevel""" else ""
            val body = """{$framePart$audioPart$dbPart}"""

            OutputStreamWriter(conn.outputStream).use { it.write(body); it.flush() }
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Fetch a single case by ID. Returns Triple(status, assignedOfficerName, etaSeconds) or null.
     * Dual-path enabled: falls back to direct Cloud Firestore REST query if local C2 backend is offline.
     */
    suspend fun getCaseById(caseId: String): Triple<String, String?, String?>? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/v1/cases/$caseId")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            val response = conn.inputStream.bufferedReader().readText()
            conn.disconnect()

            val statusMatch = Regex(""""status"\s*:\s*"([^"]+)"""").find(response)
            val officerMatch = Regex(""""assignedOfficerName"\s*:\s*"([^"]+)"""").find(response)
            val etaMatch = Regex(""""etaSeconds"\s*:\s*(\d+)""").find(response)

            val status = statusMatch?.groupValues?.get(1) ?: return@withContext null
            val officer = officerMatch?.groupValues?.get(1)
            val eta = etaMatch?.groupValues?.get(1)

            Triple(status, officer, eta)
        } catch (e: Exception) {
            // Local backend offline/unreachable -> Fallback to direct Firebase REST API
            try {
                val firestoreUrl = URL("https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/cases/$caseId?key=$FIREBASE_API_KEY")
                val conn = (firestoreUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 5000
                    readTimeout = 5000
                }
                val response = conn.inputStream.bufferedReader().readText()
                conn.disconnect()

                val statusMatch = Regex(""""status"\s*:\s*\{\s*"stringValue"\s*:\s*"([^"]+)"""").find(response)
                val officerMatch = Regex(""""assignedOfficerName"\s*:\s*\{\s*"stringValue"\s*:\s*"([^"]+)"""").find(response)
                val etaMatch = Regex(""""etaSeconds"\s*:\s*\{\s*"(integerValue|doubleValue)"\s*:\s*"([^"]+)"""").find(response)

                val status = statusMatch?.groupValues?.get(1) ?: return@withContext null
                val officer = officerMatch?.groupValues?.get(1)
                val eta = etaMatch?.groupValues?.get(2)

                Triple(status, officer, eta)
            } catch (e2: Exception) {
                e2.printStackTrace()
                null
            }
        }
    }
}
