# Task：为 Expo 项目实现 Android 下载目录文件导出

请直接检查当前 Expo / React Native 项目并完成实现，不要只给方案或示例代码，要实际修改项目代码。

## 目标

项目只需要兼容：

* Android 10 / API 29 及以上

需要实现两个主要能力：

1. 保存图片到系统下载目录
2. 导出 PDF 到系统下载目录

最终文件统一保存到：

```text
Download/<当前 App 名称>/
```

例如：

```text
Download/MyApp/
├── image-20260810-001.jpg
├── image-20260810-002.png
└── article-20260810.pdf
```

用户应该能够直接使用系统文件管理器看到这些文件。

---

## 核心要求

不要直接操作：

```text
/storage/emulated/0/Download/
```

不要通过绝对路径直接写公共存储。

Android 端必须使用：

```text
MediaStore
ContentResolver
MediaStore.Downloads
RELATIVE_PATH
```

例如核心逻辑应该基于：

```kotlin
MediaStore.Downloads.EXTERNAL_CONTENT_URI
```

并设置：

```kotlin
MediaStore.Downloads.RELATIVE_PATH
```

保存路径类似：

```text
Download/MyApp
```

---

## 权限要求

Android 10+ 不要申请：

```text
WRITE_EXTERNAL_STORAGE
READ_EXTERNAL_STORAGE
MANAGE_EXTERNAL_STORAGE
```

特别禁止使用：

```text
MANAGE_EXTERNAL_STORAGE
```

不要要求用户开启：

```text
所有文件访问权限
```

也不要为了适配 MIUI / HyperOS 添加额外的文件访问权限。

目标是在：

* AOSP
* MIUI
* HyperOS
* 其他 Android 10+ 系统

上都通过 Android 官方 Scoped Storage / MediaStore 机制保存文件。

---

# 实现方式

当前项目是 Expo 项目，并且允许使用：

```bash
npx expo run:android
```

编译原生代码。

优先创建一个项目内部的 Local Expo Module。

不要为了这个功能引入大型第三方文件管理库。

模块可以命名为类似：

```text
expo-download-storage
```

或者根据当前项目命名风格决定。

目录尽量保持：

```text
modules/
└── expo-download-storage/
```

---

# Native Module API

请封装简洁的 TypeScript API。

至少实现：

```ts
saveImageToDownloads(...)
savePdfToDownloads(...)
```

推荐统一底层实现成：

```ts
copyFileToDownloads(
  sourceUri: string,
  fileName: string,
  mimeType: string
): Promise<DownloadResult>
```

然后图片和 PDF API 调用这个通用实现。

例如：

```ts
interface DownloadResult {
  uri: string;
  fileName: string;
}
```

返回的：

```ts
uri
```

应该允许是：

```text
content://media/...
```

不要强制转换成：

```text
/storage/emulated/0/...
```

---

# 图片保存

图片可能来自：

1. App cache
2. expo-file-system 下载后的临时文件
3. 图片编辑后的临时输出
4. 截图生成的文件

例如：

```text
file:///data/user/0/com.xxx.xxx/cache/image.jpg
```

调用：

```ts
await saveImageToDownloads(
  localUri,
  'example.jpg'
);
```

最终保存为：

```text
Download/MyApp/example.jpg
```

需要正确处理：

```text
.jpg  -> image/jpeg
.jpeg -> image/jpeg
.png  -> image/png
.webp -> image/webp
```

如果调用者已经提供 MIME type，则优先使用调用者提供的值。

---

# PDF 导出

PDF 通常会先在 App 私有目录或 cache 中生成。

例如：

```text
file:///data/user/0/com.xxx.xxx/cache/export.pdf
```

然后：

```ts
await savePdfToDownloads(
  pdfUri,
  'article.pdf'
);
```

最终得到：

```text
Download/MyApp/article.pdf
```

MIME type：

```text
application/pdf
```

---

# 不要使用 Base64 搬运大文件

图片和 PDF 不要采用：

```text
file
↓
base64
↓
JS
↓
Native Bridge
↓
decode
↓
MediaStore
```

这种方案。

原因是：

* 占用额外内存
* Base64 数据体积膨胀
* 大图片和 PDF 容易造成性能问题
* 没有必要经过 JS 内存复制

应该采用：

```text
本地临时文件
        ↓
Native Module
        ↓
InputStream
        ↓
OutputStream
        ↓
MediaStore
```

Kotlin 中通过流复制文件。

建议：

```kotlin
inputStream.use { input ->
    outputStream.use { output ->
        input.copyTo(output)
    }
}
```

或者使用合理大小的 buffer。

---

# Android MediaStore 写入流程

Android 10+ 使用：

```kotlin
ContentValues()
```

至少写入：

```kotlin
DISPLAY_NAME
MIME_TYPE
RELATIVE_PATH
IS_PENDING
```

逻辑类似：

```text
创建 MediaStore 项目
        ↓
IS_PENDING = 1
        ↓
打开 OutputStream
        ↓
复制文件内容
        ↓
flush / close
        ↓
IS_PENDING = 0
```

写入成功之后才设置：

```kotlin
IS_PENDING = 0
```

如果写入过程中发生异常：

```text
必须删除已经 insert 的 MediaStore 条目
```

避免用户 Download 文件夹中留下损坏的半成品。

---

# sourceUri 处理

需要至少正确支持：

```text
file:///...
```

形式。

如果当前项目实际还存在：

```text
content://...
```

来源，也请顺手支持。

对于：

```text
file://
```

可以通过文件 InputStream 读取。

对于：

```text
content://
```

通过：

```kotlin
ContentResolver.openInputStream()
```

读取。

不要假设所有输入都是绝对文件路径。

---

# 文件重名处理

需要考虑：

```text
article.pdf
```

已经存在的情况。

不要直接覆盖未知文件。

可以优先让 MediaStore 自己处理，或者实现清晰、安全的重命名策略：

```text
article.pdf
article (1).pdf
article (2).pdf
```

如果 Android MediaStore 当前行为已经能够可靠避免覆盖，则不要重复实现复杂逻辑。

---

# 文件名安全

对传入的：

```ts
fileName
```

做基本检查。

避免：

```text
../
/
\
```

等路径穿越或非法目录拼接。

调用者只能指定文件名，不能通过：

```ts
fileName
```

改变目标目录。

所有文件必须始终保存到：

```text
Download/<AppName>/
```

---

# App 文件夹名称

不要在很多地方硬编码：

```text
MyApp
```

请定义统一配置。

优先从当前项目：

```text
app.json
app.config.ts
```

或者已有常量中获取 App 显示名称。

如果原生侧不方便直接读取，可以由 TypeScript 层统一提供固定的安全目录名。

目录名需要经过清理，避免特殊字符导致路径异常。

---

# TypeScript 层最终体验

业务代码应该尽可能简单。

例如：

```ts
const result = await saveImageToDownloads(
  imageUri,
  'photo.jpg'
);

console.log(result.uri);
```

PDF：

```ts
const result = await savePdfToDownloads(
  pdfUri,
  'article.pdf'
);
```

业务页面不应该知道：

```text
MediaStore
RELATIVE_PATH
ContentResolver
```

这些 Android 实现细节。

---

# 错误处理

Native Module 不要简单：

```text
return false
```

需要把明确错误抛给 JS。

例如：

```text
SOURCE_NOT_FOUND
FAILED_TO_CREATE_MEDIASTORE_ENTRY
FAILED_TO_OPEN_INPUT_STREAM
FAILED_TO_OPEN_OUTPUT_STREAM
FAILED_TO_WRITE_FILE
```

TypeScript 层可以进一步统一成 Error。

同时不要疯狂打印日志。

仅保留真正有帮助的错误日志。

---

# UI 行为

保存成功之后，业务层应该可以获得：

```ts
{
  uri,
  fileName
}
```

然后当前 UI 可以显示类似：

```text
已保存到 Download/MyApp/
```

不要显示虚假的绝对路径。

如果需要显示路径，就显示用户可理解的逻辑路径：

```text
Download/MyApp/article.pdf
```

---

# Expo 注意事项

这是原生模块，所以：

```text
Expo Go
```

不能作为最终测试环境。

应该使用：

```bash
npx expo run:android
```

或者已有 Dev Build。

如果当前项目已经存在：

```text
android/
```

目录，请检查当前工程结构后直接集成，不要破坏已有原生配置。

如果项目使用：

```text
prebuild
```

需要确保重新 prebuild 后模块仍然能够正常工作。

---

# 不要做的事情

禁止：

```text
MANAGE_EXTERNAL_STORAGE
```

禁止要求：

```text
所有文件访问权限
```

禁止直接：

```text
/storage/emulated/0/Download
```

禁止为了保存图片和 PDF 请求：

```text
READ_MEDIA_IMAGES
```

禁止：

```text
WRITE_EXTERNAL_STORAGE
```

禁止通过 Base64 在 JS / Native 之间搬运整个 PDF 或大图片。

禁止把整个文件加载到：

```text
ByteArray
```

之后再一次性写出。

必须使用流式复制。

---

# 验收测试

完成以后实际检查以下情况。

## 测试 1：JPEG

输入：

```text
cache/test.jpg
```

调用保存。

应该出现：

```text
Download/MyApp/test.jpg
```

---

## 测试 2：PNG

输入：

```text
cache/test.png
```

最终：

```text
Download/MyApp/test.png
```

---

## 测试 3：PDF

输入：

```text
cache/export.pdf
```

最终：

```text
Download/MyApp/export.pdf
```

文件能够被正常 PDF 阅读器打开。

---

## 测试 4：大文件

至少用几十 MB 的图片/PDF 或测试文件确认：

* 不会 Base64
* 不会明显产生超大内存峰值
* 不会因为 JS Bridge 复制整个文件
* 使用 stream copy

---

## 测试 5：权限

Android Manifest 中确认不存在：

```text
MANAGE_EXTERNAL_STORAGE
WRITE_EXTERNAL_STORAGE
READ_EXTERNAL_STORAGE
```

安装后不应该主动弹出：

```text
所有文件访问权限
存储权限
文件和媒体权限
```

保存文件本身应该能够直接完成。

---

## 测试 6：HyperOS

重点检查小米 MIUI / HyperOS：

保存图片：

```text
Download/MyApp/test.jpg
```

保存 PDF：

```text
Download/MyApp/test.pdf
```

确保文件管理器中可以正常看到和打开。

不要针对 HyperOS 写特殊 hack。

---

# 最后要求

请直接：

1. 检查当前项目结构
2. 找出现有图片保存、PDF 导出相关代码
3. 创建/完善 Local Expo Module
4. 实现 Android MediaStore 写入
5. 封装 TypeScript API
6. 替换旧的保存逻辑
7. 删除不必要的存储权限
8. 检查 AndroidManifest / app.json / app.config
9. 编译检查 TypeScript 和 Kotlin
10. 修复所有由本次修改引入的错误

不要只告诉我应该修改哪些文件。

直接修改。

尽量保持现有项目代码风格，不要顺手重构无关代码。

最终向我汇报：

* 修改了哪些文件
* 图片保存流程
* PDF 保存流程
* 是否存在任何存储权限
* MediaStore 使用方式
* 编译是否通过
* 还有没有已知问题
