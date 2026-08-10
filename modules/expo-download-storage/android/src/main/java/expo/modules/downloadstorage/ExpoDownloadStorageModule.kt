package expo.modules.downloadstorage

import android.content.ContentResolver
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileNotFoundException
import java.io.InputStream
import java.util.Locale

private const val DOWNLOAD_DIRECTORY_NAME = "NewHu"

private class DownloadStorageException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)

class ExpoDownloadStorageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoDownloadStorage")

    AsyncFunction("copyFileToDownloads") Coroutine { sourceUri: String, fileName: String, mimeType: String, subdirectory: String? ->
      copyFileToDownloads(sourceUri, fileName, mimeType, subdirectory)
    }
  }

  private suspend fun copyFileToDownloads(
    sourceUri: String,
    fileName: String,
    mimeType: String,
    subdirectory: String?
  ): Map<String, String> = withContext(Dispatchers.IO) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      throw DownloadStorageException(
        "UNSUPPORTED_ANDROID_VERSION",
        "保存到下载目录需要 Android 10 或更高版本"
      )
    }

    val safeName = sanitizeFileName(fileName)
    val safeSubdirectory = sanitizeSubdirectory(subdirectory)
    val resolver = appContext.reactContext?.contentResolver
      ?: throw Exceptions.AppContextLost()
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, safeName)
      put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "application/octet-stream" })
      val relativePath = listOf(Environment.DIRECTORY_DOWNLOADS, DOWNLOAD_DIRECTORY_NAME, safeSubdirectory)
        .filter(String::isNotBlank)
        .joinToString("/")
      put(MediaStore.Downloads.RELATIVE_PATH, relativePath)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    val destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw DownloadStorageException(
        "FAILED_TO_CREATE_MEDIASTORE_ENTRY",
        "无法在 Download/$DOWNLOAD_DIRECTORY_NAME 创建文件"
      )

    try {
      openSourceStream(sourceUri, resolver).use { input ->
        resolver.openOutputStream(destination)?.use { output ->
          input.copyTo(output)
          output.flush()
        } ?: throw DownloadStorageException(
          "FAILED_TO_OPEN_OUTPUT_STREAM",
          "无法打开下载文件写入流"
        )
      }

      val completedValues = ContentValues().apply {
        put(MediaStore.Downloads.IS_PENDING, 0)
      }
      if (resolver.update(destination, completedValues, null, null) == 0) {
        throw DownloadStorageException(
          "FAILED_TO_FINALIZE_FILE",
          "无法完成下载文件写入"
        )
      }
      mapOf("uri" to destination.toString(), "fileName" to safeName)
    } catch (error: Throwable) {
      resolver.delete(destination, null, null)
      if (error is DownloadStorageException) throw error
      throw DownloadStorageException(
        "FAILED_TO_WRITE_FILE",
        "写入下载文件失败",
        error
      )
    }
  }

  private fun openSourceStream(sourceUri: String, resolver: ContentResolver): InputStream {
    val uri = Uri.parse(sourceUri)
    return when (uri.scheme?.lowercase(Locale.ROOT)) {
      "content" -> resolver.openInputStream(uri)
        ?: throw DownloadStorageException("FAILED_TO_OPEN_INPUT_STREAM", "无法读取内容 URI")
      "file", null -> {
        val path = uri.path ?: throw DownloadStorageException("SOURCE_NOT_FOUND", "找不到源文件")
        val file = File(path)
        if (!file.isFile) throw DownloadStorageException("SOURCE_NOT_FOUND", "找不到源文件")
        try {
          FileInputStream(file)
        } catch (error: FileNotFoundException) {
          throw DownloadStorageException("SOURCE_NOT_FOUND", "找不到源文件", error)
        }
      }
      else -> resolver.openInputStream(uri)
        ?: throw DownloadStorageException("FAILED_TO_OPEN_INPUT_STREAM", "无法读取源文件")
    }
  }

  private fun sanitizeFileName(value: String): String {
    val basename = value
      .replace('\\', '/')
      .substringAfterLast('/')
      .replace("..", "_")
      .replace(Regex("[\\u0000-\\u001F<>:\"|?*]"), "_")
      .trim()
    if (basename.isBlank() || basename == "." || basename == "..") {
      throw DownloadStorageException("INVALID_FILE_NAME", "文件名无效")
    }
    return basename.take(180)
  }

  private fun sanitizeSubdirectory(value: String?): String {
    if (value.isNullOrBlank()) return ""
    val segments = value
      .replace('\\', '/')
      .split('/')
      .filter { it.isNotBlank() && it != "." && it != ".." }
      .map { segment ->
        segment.replace(Regex("[\\u0000-\\u001F<>:\"|?*]"), "_").trim()
      }
      .filter(String::isNotBlank)
    if (segments.isEmpty()) {
      throw DownloadStorageException("INVALID_DIRECTORY", "保存目录无效")
    }
    return segments.joinToString("/").take(120)
  }
}
