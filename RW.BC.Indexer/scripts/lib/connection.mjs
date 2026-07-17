export function aspireConnectionToUrl(adoNet) {
  const parts = Object.fromEntries(
    adoNet
      .split(";")
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf("=");
        return [pair.slice(0, eq).trim().toLowerCase(), pair.slice(eq + 1).trim()];
      }),
  );
  const user = parts["username"] ?? parts["user id"] ?? parts["userid"] ?? "postgres";
  const password = encodeURIComponent(parts["password"] ?? "");
  const host = parts["host"] ?? "localhost";
  const port = parts["port"] ?? "5432";
  const database = parts["database"] ?? "postgres";
  return `postgresql://${encodeURIComponent(user)}:${password}@${host}:${port}/${database}`;
}

export function resolveConnectionString() {
  const aspire = process.env.ConnectionStrings__bitchicken;
  if (aspire) return aspireConnectionToUrl(aspire);
  return process.env.DATABASE_URL;
}
