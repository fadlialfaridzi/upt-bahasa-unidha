// Mailer utility — menggunakan Mailtrap HTTP API (Email Testing)
// Docs: https://api-docs.mailtrap.io/

/**
 * Kirim email via Mailtrap HTTP API.
 * @param {Object} opts
 * @param {string} opts.to        - Alamat email tujuan
 * @param {string} opts.toName    - Nama penerima
 * @param {string} opts.subject   - Subjek email
 * @param {string} opts.html      - Isi email (HTML)
 * @param {string} [opts.text]    - Isi email (plain text, fallback)
 */
export async function sendMail({ to, toName, subject, html, text }) {
  const inboxId = process.env.MAILTRAP_INBOX_ID || '5023099';
  const apiKey = process.env.MAILTRAP_API_KEY || '71e84677b094539e820b0370cb1ff5a9';

  const payload = {
    from: {
      email: process.env.MAILTRAP_FROM_EMAIL || 'noreply@uptbahasa.ac.id',
      name:  process.env.MAILTRAP_FROM_NAME  || 'UPT Bahasa Universitas Dharma Andalas',
    },
    to: [{ email: to, name: toName || to }],
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  };

  const res = await fetch(`https://sandbox.api.mailtrap.io/api/send/${inboxId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mailtrap error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Template email OTP reset password.
 */
export function otpEmailTemplate(nama, kode, menitBerlaku) {
  return {
    subject: `[UPT Bahasa] Kode OTP Reset Kata Sandi`,
    html: `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:#1e3a5f;padding:28px 36px;text-align:center;">
          <span style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:1px;">u.</span>
          <span style="font-size:16px;color:#cbd5e1;margin-left:8px;">UPT Bahasa &bull; Unidha</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 36px 24px;">
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">Halo, <strong>${nama}</strong></p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            Kami menerima permintaan reset kata sandi untuk akun Anda.<br/>
            Gunakan kode OTP berikut untuk melanjutkan:
          </p>
          <!-- OTP Box -->
          <div style="background:#f0f4ff;border:2px dashed #4f83cc;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1e3a5f;">${kode}</span>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-align:center;">
            Kode berlaku selama <strong>${menitBerlaku} menit</strong>.
          </p>
          <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
            Jika Anda tidak meminta reset kata sandi, abaikan email ini.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} UPT Bahasa &bull; Universitas Dharma Andalas<br/>
            Email ini dikirim secara otomatis, harap tidak membalas.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  };
}
