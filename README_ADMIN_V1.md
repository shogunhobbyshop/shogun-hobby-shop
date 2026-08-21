# ShogunHobbyShop Admin v1

## Important deployment structure
This version puts the admin static files under `frontend/admin/` because Cloudflare Pages is configured with `frontend` as the build output directory.

Expected structure:
```
frontend/
  index.html
  css/
  js/
  admin/
    index.html
    css/admin.css
    js/admin.js
functions/
  api/...
```

Open the admin at `/admin/`.

The admin requires the Cloudflare secret `ADMIN_PASSWORD` and D1 binding `DB`.
