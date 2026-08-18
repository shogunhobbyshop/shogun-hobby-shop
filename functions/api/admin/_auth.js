export async function requireAdmin(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    return Response.json({ error: "ADMIN_PASSWORD chưa được cấu hình trên Cloudflare." }, { status: 503 });
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== expected) {
    return Response.json({ error: "Mật khẩu admin không đúng." }, { status: 401 });
  }
  return null;
}

export function slugify(input = "") {
  return input
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "san-pham";
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}
