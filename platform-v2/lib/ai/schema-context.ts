import { q } from "@/lib/ch/client";

export async function schemaContext(): Promise<string> {
  const martTables = (await q<{ name: string }>(`SHOW TABLES FROM serving`))
    .map((r) => r.name)
    .filter((n) => n.startsWith("mart_") && !n.endsWith("_baru"));

  const martDescs: string[] = [];
  for (const t of martTables) {
    const cols = await q<{ name: string; type: string }>(`DESCRIBE serving.${t}`);
    martDescs.push(
      `serving.${t}(${cols
        .filter((c) => !c.name.startsWith("_"))
        .map((c) => `${c.name} ${c.type}`)
        .join(", ")})`,
    );
  }

  const silver = (await q<{ name: string }>(`SHOW TABLES FROM silver`))
    .map((r) => r.name)
    .slice(0, 60);

  return (
    `TABEL MART (Gold, utama untuk agregasi):\n${martDescs.join("\n")}\n\n` +
    `TABEL SILVER (detail per dataset, akses: silver.<nama>):\n${silver.join(", ")}`
  );
}
