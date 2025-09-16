// SMS helper: Twilio REST API if configured, else no-op

type SmsPayload = { to: string; body: string };

function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_FROM || "";
  return { sid, token, from };
}

export async function sendSms({ to, body }: SmsPayload): Promise<{ ok: boolean }> {
  const { sid, token, from } = getTwilio();
  if (!sid || !token || !from) return { ok: true };
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", from);
    params.set("Body", body);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!res.ok) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

