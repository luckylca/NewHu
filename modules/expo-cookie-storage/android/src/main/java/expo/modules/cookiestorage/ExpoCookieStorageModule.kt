package expo.modules.cookiestorage

import android.net.Uri
import android.webkit.CookieManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

private class CookieStorageException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)

class ExpoCookieStorageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCookieStorage")

    AsyncFunction("getCookieHeader") Coroutine { url: String ->
      validateHttpUrl(url)
      withContext(Dispatchers.Main) {
        try {
          CookieManager.getInstance().getCookie(url).orEmpty()
        } catch (error: Throwable) {
          throw CookieStorageException(
            "COOKIE_READ_FAILED",
            "无法读取 WebView Cookie",
            error
          )
        }
      }
    }

    AsyncFunction("clearAllCookies").Coroutine(::clearAllCookiesInternal)
  }

  private suspend fun clearAllCookiesInternal(): Boolean = withContext(Dispatchers.Main) {
    try {
      suspendCancellableCoroutine<Boolean> { continuation ->
        val manager = CookieManager.getInstance()
        manager.removeAllCookies { removed ->
          manager.flush()
          if (continuation.isActive) {
            continuation.resume(removed)
          }
        }
      }
    } catch (error: Throwable) {
      throw CookieStorageException(
        "COOKIE_CLEAR_FAILED",
        "无法清除 WebView Cookie",
        error
      )
    }
  }

  private fun validateHttpUrl(url: String) {
    val uri = Uri.parse(url)
    val scheme = uri.scheme?.lowercase()
    if ((scheme != "http" && scheme != "https") || uri.host.isNullOrBlank()) {
      throw CookieStorageException("INVALID_URL", "Cookie URL 必须是有效的 HTTP/HTTPS 地址")
    }
  }
}
