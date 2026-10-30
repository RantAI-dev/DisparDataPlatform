// node --test tools/fixture-server/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalkan, namaBerkas } from "./kunci.mjs";
import { muatRekaman, buatServer } from "./putar.mjs";

test("kunci tidak bergantung urutan parameter, parameter kosong, atau gaya encoding spasi", () => {
  const k = normalkan("/v1/x?b=2&a=Jakarta%20Barat&c=");
  assert.equal(k, "/v1/x?a=Jakarta%20Barat&b=2");
  assert.equal(normalkan("/v1/x/?a=Jakarta+Barat&b=2"), k);
});

test("kunci mempertahankan urutan nilai parameter berulang (f=)", () => {
  assert.equal(normalkan("/v1/d?sort=a:asc&f=n:in:B&f=n:in:A"), "/v1/d?f=n%3Ain%3AB&f=n%3Ain%3AA&sort=a%3Aasc");
});

test("nama berkas unik per query dan aman untuk sistem berkas", () => {
  const a = namaBerkas("/v1/dataset/x/baris?size=5");
  const b = namaBerkas("/v1/dataset/x/baris?size=6");
  assert.match(a, /^v1_dataset_x_baris\.[0-9a-f]{10}\.json$/);
  assert.notEqual(a, b);
});

async function denganServer(rekaman, fn) {
  const dir = mkdtempSync(join(tmpdir(), "fixture-"));
  for (const r of rekaman) writeFileSync(join(dir, namaBerkas(r.kunci)), JSON.stringify(r));
  const server = buatServer(muatRekaman(dir)).listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test("pemutar mengirim body mentah, status, dan memantulkan X-Request-Id", async () => {
  const body = '{"data":{"id":18446744073709551615,"kosong":{}},"meta":{}}';
  await denganServer([{ kunci: "/v1/x?a=1&b=2", status: 200, headers: { "content-type": "application/json" }, body }], async (url) => {
    const res = await fetch(`${url}/v1/x?b=2&a=1`, { headers: { "X-Request-Id": "rid-123" } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-request-id"), "rid-123");
    assert.equal(await res.text(), body);
  });
});

test("pemutar meneruskan status error yang terekam", async () => {
  await denganServer(
    [{ kunci: "/v1/dataset/tidak-ada", status: 404, headers: { "content-type": "application/json" }, body: '{"error":{"code":"NOT_FOUND"}}' }],
    async (url) => assert.equal((await fetch(`${url}/v1/dataset/tidak-ada`)).status, 404),
  );
});

test("URL yang belum direkam dijawab 599 dengan kuncinya", async () => {
  await denganServer([], async (url) => {
    const res = await fetch(`${url}/v1/belum?z=1`);
    assert.equal(res.status, 599);
    assert.equal((await res.json()).error.detail.kunci, "/v1/belum?z=1");
  });
});

test("selain GET/HEAD ditolak 405", async () => {
  await denganServer([], async (url) => assert.equal((await fetch(`${url}/v1/x`, { method: "POST" })).status, 405));
});

test("pemutar mengirim ulang header terekam (mis. Content-Disposition ekspor)", async () => {
  const headers = { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="x.csv"' };
  await denganServer([{ kunci: "/v1/dataset/x/ekspor?format=csv", status: 200, headers, body: "a,b\n1,2\n" }], async (url) => {
    const res = await fetch(`${url}/v1/dataset/x/ekspor?format=csv`);
    assert.equal(res.headers.get("content-disposition"), 'attachment; filename="x.csv"');
    assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(await res.text(), "a,b\n1,2\n");
  });
});
