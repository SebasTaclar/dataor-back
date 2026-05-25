interface PendingBalanceReminderTemplateParams {
  clientName: string;
  companyName?: string | null;
  pendingAmount?: number | string | null;
  paymentDay: number;
  contactName: string;
  contactNumber: string;
}

const formatCurrency = (value?: number | string | null): string => {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(numericValue);
};

export const createPendingBalanceReminderEmailHtml = ({
  clientName,
  companyName,
  pendingAmount,
  paymentDay,
  contactName,
  contactNumber,
}: PendingBalanceReminderTemplateParams): string => {
  const displayName = companyName || clientName;
  const formattedAmount = formatCurrency(pendingAmount);
  const whatsappMessage = encodeURIComponent(
    `Hola, quiero coordinar el pago del saldo pendiente de ${displayName}.`
  );

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Notificación de pago</title>
  <style>
    @media only screen and (max-width: 520px) {
      .reference-cell {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .reference-cell + .reference-cell {
        padding-top: 14px !important;
      }
    }
  </style>
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
              <h1 style="margin:18px 0 12px; font-size:30px; line-height:1.2; color:#0f172a;">Hola ${displayName},</h1>
              <p style="margin:0; font-size:16px; line-height:1.7; color:#475569;">
                Por favor cancelar el <strong style="color:#0f172a;">valor mensualidad y saldos pendientes</strong> (<strong style="color:#0f172a;">saldos de implementación o mensualidades o saldos de mensualidades pasadas</strong>) de <strong style="color:#0f172a;">${formattedAmount}</strong>, cuyo día de pago es el <strong style="color:#0f172a;">${paymentDay}</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:13px; text-transform:uppercase; letter-spacing:1.8px; color:#64748b; margin-bottom:10px; font-weight:700;">Datos de referencia</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="reference-cell" style="padding:10px 0; width:48%; vertical-align:top;">
                          <div style="font-size:13px; color:#64748b; margin-bottom:4px;">Valor mensualidad</div>
                          <div style="font-size:22px; font-weight:800; color:#0f172a;">${formattedAmount}</div>
                        </td>
                        <td class="reference-cell" style="padding:10px 0; width:52%; vertical-align:top;">
                          <div style="font-size:13px; color:#64748b; margin-bottom:4px;">Día de pago</div>
                          <div style="font-size:22px; font-weight:800; color:#0f172a;">${paymentDay} de cada mes</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 8px;">
              <p style="margin:0 0 14px; font-size:16px; line-height:1.7; color:#475569;">
                Por favor comunicarse con <strong style="color:#0f172a;">${contactName}</strong> al número <strong style="color:#0f172a;">${contactNumber}</strong> para coordinar el pago.
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
                Gracias por su atención. Quedamos atentos a su confirmación.
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
