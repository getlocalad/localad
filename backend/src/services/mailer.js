// LocalAd – E-Mail-Service via Resend (https://resend.com)
// Kein npm-Paket nötig – reines HTTP.
// Falls RESEND_API_KEY nicht gesetzt: E-Mails werden nur geloggt (kein Crash).

const RESEND_API = 'https://api.resend.com/emails';
const FROM       = process.env.MAIL_FROM || 'LocalAd <noreply@getlocalad.de>';
const API_KEY    = process.env.RESEND_API_KEY;

async function sendMail({ to, subject, html, replyTo }) {
  if (!API_KEY) {
    console.log(`[Mailer] RESEND_API_KEY fehlt – Mail nicht gesendet: ${subject} → ${to}`);
    return;
  }
  try {
    const payload = { from: FROM, to: [to], subject, html };
    if (replyTo) payload.reply_to = replyTo;
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Mailer] Fehler:', res.status, err);
    } else {
      console.log(`[Mailer] Mail gesendet: ${subject} → ${to}`);
    }
  } catch (e) {
    console.error('[Mailer] Netzwerkfehler:', e.message);
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function sendWelcomeMail(email) {
  await sendMail({
    to:      email,
    subject: 'Willkommen bei LocalAd!',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="color:#2563eb;margin-bottom:8px">Willkommen bei LocalAd</h1>
        <p>Schön, dass du dabei bist! Dein Account ist jetzt aktiv.</p>
        <p style="margin-top:16px">
          Als nächstes kannst du deine Postleitzahl eingeben und ein Abo abschließen –
          dann blockiert die Extension Konzernwerbung und zeigt dir lokale Anzeigen aus deiner Region.
        </p>
        <a href="https://getlocalad.de/onboarding"
           style="display:inline-block;margin-top:20px;padding:12px 24px;
                  background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Zum Onboarding
        </a>
        <p style="margin-top:32px;font-size:0.8rem;color:#64748b">
          Du erhältst diese E-Mail, weil du dich auf getlocalad.de registriert hast.
        </p>
      </div>
    `,
  });
}

export async function sendContactMail({ name, email, subject, message }) {
  const CONTACT_TO = process.env.CONTACT_EMAIL || 'info@getlocalad.de';
  const subjectMap = {
    allgemein:  'Allgemeine Anfrage',
    abo:        'Frage zum Abo',
    werbung:    'Werbung schalten',
    publisher:  'Als Publisher registrieren',
    technisch:  'Technisches Problem',
    presse:     'Presse / Kooperation',
  };
  const subjectLabel = subjectMap[subject] || subject;

  await sendMail({
    to:      CONTACT_TO,
    replyTo: `${name} <${email}>`,
    subject: `[LocalAd Kontakt] ${subjectLabel} – ${name}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="color:#2563eb;margin-bottom:16px">Neue Kontaktanfrage</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:6px 0;font-weight:600;width:100px">Name</td><td>${name}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">E-Mail</td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Betreff</td><td>${subjectLabel}</td></tr>
        </table>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;line-height:1.6">${message}</div>
        <p style="margin-top:24px;font-size:12px;color:#64748b">
          Gesendet über getlocalad.de/kontakt
        </p>
      </div>
    `,
  });
}

export async function sendSubscriptionConfirmMail(email, subscriptionEnd) {
  const endDate = new Date(subscriptionEnd).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  await sendMail({
    to:      email,
    subject: 'Dein LocalAd-Abo ist aktiv',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="color:#16a34a;margin-bottom:8px">Abo erfolgreich aktiviert ✓</h1>
        <p>Vielen Dank! Dein LocalAd-Abo ist jetzt aktiv.</p>
        <ul style="margin-top:16px;padding-left:20px;line-height:1.8">
          <li>Konzernwerbung wird blockiert</li>
          <li>Lokale Anzeigen aus deiner Region werden angezeigt</li>
          <li>Nächste Abbuchung: ${endDate}</li>
        </ul>
        <a href="https://getlocalad.de/account"
           style="display:inline-block;margin-top:20px;padding:12px 24px;
                  background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Mein Konto
        </a>
        <p style="margin-top:32px;font-size:0.8rem;color:#64748b">
          Du kannst dein Abo jederzeit unter getlocalad.de/account kündigen.
        </p>
      </div>
    `,
  });
}
