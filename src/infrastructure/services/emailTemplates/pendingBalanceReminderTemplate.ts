interface PendingBalanceReminderTemplateParams {
  contactName: string;
  contactNumber: string;
}

export const createPendingBalanceReminderEmailHtml = ({
  contactName,
  contactNumber,
}: PendingBalanceReminderTemplateParams): string => {
  const whatsappMessage = encodeURIComponent(
    'Hola, quiero coordinar el pago de saldos pendientes.'
  );

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Notificación de pago</title>
</head>
<body style="margin:0; padding:0; background:#f4f7fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb; width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="background:linear-gradient(135deg, #0f4c81 0%, #163f66 100%); padding:28px 32px 24px; text-align:left;">
              <div style="font-size:44px; line-height:1; font-weight:800; color:#ffffff; letter-spacing:-1px;">Data_or</div>
              <div style="margin-top:8px; font-size:16px; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.78);">Desarrollo de Software</div>
            </td>
          </tr>

          <tr>
            <td style="padding:34px 32px 8px;">
              <div style="display:inline-block; background:#eef6ff; color:#0f4c81; font-size:13px; font-weight:700; padding:8px 12px; border-radius:999px; letter-spacing:0.3px;">
                Aviso de pago pendiente
              </div>
              <h1 style="margin:18px 0 12px; font-size:30px; line-height:1.2; color:#0f172a;">Estimado cliente,</h1>
              <p style="margin:0; font-size:16px; line-height:1.7; color:#475569;">
                Tienes pagos pendientes de <strong style="color:#0f172a;">mensualidad y/o saldos correspondientes a implementación</strong>. Por favor comunicate con nosotros para coordinar el pago.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 14px; font-size:16px; line-height:1.7; color:#475569;">
                Por favor comunicate con <strong style="color:#0f172a;">${contactName}</strong> al número <strong style="color:#0f172a;">${contactNumber}</strong> para coordinar el pago.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
                <tr>
                  <td style="background:#25D366; border-radius:12px; box-shadow:0 10px 18px rgba(37, 211, 102, 0.22);">
                    <a href="https://wa.me/57${contactNumber.replace(/\D/g, '')}?text=${whatsappMessage}" style="display:inline-block; padding:14px 22px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">Enviar por WhatsApp</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 34px;">
              <div style="height:1px; background:#e2e8f0; margin:8px 0 18px;"></div>
              <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b;">
                Gracias por tu atención. Quedamos atentos a su confirmación.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};
