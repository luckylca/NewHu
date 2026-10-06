package com.newhu.liquidglass.nativebenchmark

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.newhu.liquidglass.local.LocalGlassView
import kotlin.math.roundToInt

internal class CommentAdapter(
    private val itemCount: Int,
    private val localGlassEnabled: Boolean,
) : RecyclerView.Adapter<CommentAdapter.CommentHolder>() {
    private val comments = List(itemCount) { index ->
        SampleComment(
            author = listOf("林间来信", "橘子海", "远山", "清醒梦", "小满")[index % 5],
            body = listOf(
                "这个解释很清楚，尤其是最后关于边界条件的补充。我之前一直把两个概念混在一起了。",
                "补充一个实际使用中的情况：在网络不稳定时也会遇到类似表现，建议先观察一段时间。",
                "同意楼上的观点。这里还可以从另一种角度理解，不过要注意不要把个例当成普遍结论。",
                "收藏了，最近刚好在看相关资料。作者能把复杂的部分讲得这么直观，确实很有帮助。",
            )[index % 4],
            replies = index % 5,
        )
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommentHolder {
        val context = parent.context
        val density = context.resources.displayMetrics.density
        val row = FrameLayout(context).apply {
            setPadding(dp(16, density), dp(8, density), dp(16, density), dp(8, density))
            minimumHeight = dp(190, density)
            clipChildren = false
            clipToPadding = false
        }
        val glass = if (localGlassEnabled) {
            LocalGlassView(context).apply { setMaterial(SampleMaterials.comment) }
        } else {
            null
        }
        glass?.let { row.addView(it, FrameLayout.LayoutParams(-1, -1)) }

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(17, density), dp(16, density), dp(17, density), dp(14, density))
        }
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val avatarBackground = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
        }
        val avatar = TextView(context).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            background = avatarBackground
        }
        header.addView(avatar, LinearLayout.LayoutParams(dp(38, density), dp(38, density)))

        val identity = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10, density), 0, 0, 0)
        }
        val author = TextView(context).apply {
            setTextColor(Color.rgb(38, 43, 52))
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        }
        val meta = TextView(context).apply {
            setTextColor(Color.rgb(124, 131, 144))
            textSize = 11f
        }
        identity.addView(author)
        identity.addView(meta)
        header.addView(identity, LinearLayout.LayoutParams(0, -2, 1f))

        val like = TextView(context).apply {
            setTextColor(Color.rgb(91, 101, 117))
            textSize = 12f
        }
        header.addView(like)
        content.addView(header)

        val body = TextView(context).apply {
            setTextColor(Color.rgb(48, 53, 62))
            textSize = 14f
            setLineSpacing(dp(3, density).toFloat(), 1f)
            maxLines = 4
            setPadding(0, dp(12, density), 0, dp(10, density))
        }
        val replies = TextView(context).apply {
            setTextColor(Color.rgb(79, 117, 181))
            textSize = 12f
        }
        content.addView(body)
        content.addView(replies)
        row.addView(content, FrameLayout.LayoutParams(-1, -1))

        return CommentHolder(
            itemView = row,
            avatar = avatar,
            avatarBackground = avatarBackground,
            author = author,
            meta = meta,
            like = like,
            body = body,
            replies = replies,
        )
    }

    override fun onBindViewHolder(holder: CommentHolder, position: Int) = holder.bind(comments[position], position)

    override fun getItemCount(): Int = comments.size

    internal class CommentHolder(
        itemView: View,
        private val avatar: TextView,
        private val avatarBackground: GradientDrawable,
        private val author: TextView,
        private val meta: TextView,
        private val like: TextView,
        private val body: TextView,
        private val replies: TextView,
    ) : RecyclerView.ViewHolder(itemView) {
        private val avatarColors = intArrayOf(0xFF557DC8.toInt(), 0xFF7A73C7.toInt(), 0xFF4E99A5.toInt())

        fun bind(comment: SampleComment, position: Int) {
            avatar.text = comment.author.first().toString()
            avatarBackground.setColor(avatarColors[position % avatarColors.size])
            author.text = comment.author
            meta.text = "${position + 1} 小时前 · ${position % 8 + 1} 楼"
            like.text = "♡  ${position % 29 + 1}"
            body.text = comment.body
            replies.text = if (comment.replies > 0) "查看 ${comment.replies} 条回复     回复" else "回复"
        }
    }

    private fun dp(value: Int, density: Float): Int = (value * density).roundToInt()
}

internal data class SampleComment(val author: String, val body: String, val replies: Int)
