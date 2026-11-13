// Catat aksi pengguna ke audit_log. Dipanggil di dalam transaksi agar konsisten dengan perubahan datanya.
export const catatAudit = (tx, req, { aksi, entitas, idEntitas, detail }) =>
  tx.audit_log.create({
    data: {
      id_pengguna: req.user.id,
      aksi,
      entitas,
      id_entitas: idEntitas != null ? String(idEntitas) : null,
      detail: detail ? JSON.stringify(detail) : null,
      alamat_ip: req.ip?.slice(0, 45) ?? null,
    },
  });
