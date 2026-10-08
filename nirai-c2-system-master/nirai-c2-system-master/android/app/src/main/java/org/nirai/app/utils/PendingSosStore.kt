package org.nirai.app.utils

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class PendingSos(
    val caseId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val timestampMillis: Long,
    val reporterName: String,
    val reporterPhone: String,
    val address: String
)

object PendingSosStore {
    private const val PREFS_NAME = "nirai_pending_sos"
    private const val PENDING_KEY = "pending"
    private const val ACTIVE_CASE_KEY = "active_case_id"

    fun getPending(context: Context): List<PendingSos> {
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PENDING_KEY, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            List(array.length()) { index ->
                val item = array.getJSONObject(index)
                PendingSos(
                    caseId = item.getString("caseId"),
                    latitude = item.getDouble("latitude"),
                    longitude = item.getDouble("longitude"),
                    accuracyMeters = item.getDouble("accuracyMeters").toFloat(),
                    timestampMillis = item.getLong("timestampMillis"),
                    reporterName = item.getString("reporterName"),
                    reporterPhone = item.getString("reporterPhone"),
                    address = item.getString("address")
                )
            }
        }.getOrElse { emptyList() }
    }

    fun enqueue(context: Context, sos: PendingSos): Boolean {
        val pending = getPending(context).filterNot { it.caseId == sos.caseId } + sos
        val array = JSONArray().apply { pending.forEach { put(it.toJson()) } }
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PENDING_KEY, array.toString())
            .commit()
    }

    fun remove(context: Context, caseId: String) {
        val remaining = getPending(context).filterNot { it.caseId == caseId }
        val array = JSONArray().apply { remaining.forEach { put(it.toJson()) } }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PENDING_KEY, array.toString())
            .apply()
    }

    fun saveActiveCaseId(context: Context, caseId: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(ACTIVE_CASE_KEY, caseId)
            .apply()
    }

    fun getActiveCaseId(context: Context): String? =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(ACTIVE_CASE_KEY, null)

    fun clearActiveCaseId(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(ACTIVE_CASE_KEY)
            .apply()
    }

    private fun PendingSos.toJson() = JSONObject()
        .put("caseId", caseId)
        .put("latitude", latitude)
        .put("longitude", longitude)
        .put("accuracyMeters", accuracyMeters.toDouble())
        .put("timestampMillis", timestampMillis)
        .put("reporterName", reporterName)
        .put("reporterPhone", reporterPhone)
        .put("address", address)
}
