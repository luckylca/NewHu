export const DATABASE_VERSION = 1;

export const MIGRATION_1 = `
CREATE TABLE IF NOT EXISTS contents (
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  author_url_token TEXT NOT NULL DEFAULT '',
  author_avatar TEXT NOT NULL DEFAULT '',
  question_id TEXT NOT NULL DEFAULT '',
  question_title TEXT NOT NULL DEFAULT '',
  question_author_name TEXT NOT NULL DEFAULT '',
  question_author_avatar TEXT NOT NULL DEFAULT '',
  question_author_url_token TEXT NOT NULL DEFAULT '',
  question_answer_count INTEGER NOT NULL DEFAULT 0,
  question_created_time INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  is_voted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL,
  has_body INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, type)
);

CREATE TABLE IF NOT EXISTS content_bodies (
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  fetched_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL,
  cache_state TEXT NOT NULL DEFAULT 'transient',
  PRIMARY KEY (content_id, content_type),
  FOREIGN KEY (content_id, content_type) REFERENCES contents(id, type) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feed_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  source TEXT NOT NULL,
  position INTEGER NOT NULL,
  session_id TEXT,
  batch_id TEXT,
  fetched_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL,
  FOREIGN KEY (content_id, content_type) REFERENCES contents(id, type) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  parent_comment_id TEXT,
  root_comment_id TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  author_url_token TEXT,
  author_name TEXT NOT NULL DEFAULT '',
  author_avatar TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  is_voted INTEGER NOT NULL DEFAULT 0,
  is_author INTEGER NOT NULL DEFAULT 0,
  is_hot INTEGER NOT NULL DEFAULT 0,
  is_top INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  child_comment_count INTEGER NOT NULL DEFAULT 0,
  reply_to_author_name TEXT,
  cache_state TEXT NOT NULL DEFAULT 'transient',
  sync_status TEXT NOT NULL DEFAULT 'synced',
  local_only INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comment_list_entries (
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  parent_comment_id TEXT,
  order_by TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (content_id, content_type, parent_comment_id, order_by, comment_id),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comment_page_state (
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  parent_comment_id TEXT,
  order_by TEXT NOT NULL,
  next_offset TEXT NOT NULL DEFAULT '',
  is_end INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  loaded_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (content_id, content_type, parent_comment_id, order_by)
);

CREATE TABLE IF NOT EXISTS offline_pins (
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  root_comment_mode TEXT NOT NULL,
  root_comment_limit INTEGER NOT NULL DEFAULT 100,
  child_comment_limit INTEGER NOT NULL DEFAULT 100,
  with_images INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (content_id, content_type)
);

CREATE TABLE IF NOT EXISTS cache_jobs (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL,
  root_target INTEGER,
  root_cached INTEGER NOT NULL DEFAULT 0,
  child_cached INTEGER NOT NULL DEFAULT 0,
  image_total INTEGER NOT NULL DEFAULT 0,
  image_cached INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  remote_url TEXT NOT NULL UNIQUE,
  local_uri TEXT,
  mime_type TEXT,
  file_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_refs (
  resource_id TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  PRIMARY KEY (resource_id, owner_type, owner_id, purpose),
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  depends_on_action_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_attempt_at INTEGER,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS user_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  value_real REAL,
  value_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_embeddings (
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  model_version TEXT NOT NULL,
  embedding BLOB,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (content_id, content_type, model_version)
);

CREATE INDEX IF NOT EXISTS idx_contents_last_accessed ON contents(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_bodies_cache_accessed ON content_bodies(cache_state, last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_feed_entries_fetched ON feed_entries(fetched_at, last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_comments_content_parent ON comments(content_id, content_type, parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_entries_list ON comment_list_entries(content_id, content_type, parent_comment_id, order_by, position);
CREATE INDEX IF NOT EXISTS idx_resources_accessed ON resources(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_content ON user_events(content_id, content_type, created_at);
`;
