# AGENTS.md

Instruksi kanonik untuk agen coding di repo ini ada di **[`CLAUDE.md`](./CLAUDE.md)**.
Baca berkas itu lebih dulu — isinya peta repo, infrastruktur, alur data, runbook,
dan aturan kerja.

Tiga hal yang tidak boleh dilewatkan:

1. **Repo ini PUBLIC.** Jangan pernah commit password, API key, token, atau
   connection string berisi sandi. Nilai asli hanya di Portainer stack Env.
2. **Produksi hidup** di <https://dispar.rantai.dev>. Konfirmasi sebelum tindakan
   yang mengubah keadaan server (redeploy, hapus image, ubah Env, restart).
3. **Kerjakan `platform-v2/`, bukan `platform/`.** v1 beku, hanya cadangan.

Onboarding untuk manusia: [`docs/HANDOVER.md`](./docs/HANDOVER.md).
