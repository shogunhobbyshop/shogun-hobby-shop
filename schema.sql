CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  visible INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price INTEGER DEFAULT 0,
  category_id INTEGER,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  visible INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

INSERT OR IGNORE INTO categories (name, slug, sort_order) VALUES
('Gundam', 'gundam', 1),
('LEGO', 'lego', 2),
('Diecast', 'diecast', 3),
('Model Kit', 'model-kit', 4);

INSERT OR IGNORE INTO settings (key, value) VALUES
('shop_name', 'ShogunHobbyShop'),
('tagline', 'Thế giới hobby không giới hạn.'),
('phone', '0900 000 000'),
('zalo', '#'),
('facebook', '#');
