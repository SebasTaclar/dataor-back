import { PrismaClient } from '@prisma/client';
import { Logger } from '../../shared/Logger';
import { getEmailService } from '../../shared/serviceProvider';

export class PendingBalanceReminderService {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Busca clientes activos con mensualidad definida cuyo día de pago ya venció
   * y envía un correo recordatorio.
   */
  async sendPendingBalanceReminders(): Promise<{ sent: number; skipped: number; errors: any[] }> {
    this.logger.logInfo('Running pending balance reminders');

    // Hora en Colombia (UTC-5)
    const now = new Date();
    const colombiaOffset = -5 * 60; // en minutos
    const colombiaTime = new Date(now.getTime() + colombiaOffset * 60 * 1000);
    const today = colombiaTime.getDate();

    // Buscar clientes activos, no pagados, con mensualidad y día de pago configurado
    const clients = await this.prisma.client.findMany({
      where: {
        isActive: true,
        hasPaid: false,
        monthlyAmount: { not: null },
        paymentDayMonth: { not: null },
      },
    });

    const emailService = getEmailService(this.logger);

    let sent = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const client of clients) {
      try {
        const paymentDay = client.paymentDayMonth as number | null;
        if (!paymentDay) {
          skipped++;
          continue;
        }

        // Si el día configurado ya venció en el mes actual
        if (paymentDay >= today) {
          skipped++;
          continue;
        }

        if (!client.email) {
          this.logger.logWarning('Client has no email, skipping', { clientId: client.id });
          skipped++;
          continue;
        }

        const contactNumber = process.env.CONTACT_MIGUEL_NUMBER || 'NÚMERO_A_COMPLETAR';

        const subject = `Recordatorio: saldo pendiente - ${client.companyName || client.name}`;

        const htmlContent = `
          <p>Hola ${client.companyName || client.name},</p>
          <p>Por favor cancelar saldo pendiente correspondiente a la mensualidad de <strong>${
            client.monthlyAmount ?? 'N/A'
          }</strong> cuyo día de pago es el <strong>${paymentDay}</strong>.</p>
          <p>Por favor comunicarse con Miguel Bustos al número ${contactNumber} para coordinar el pago.</p>
          <p>Gracias.</p>
        `;

        const textContent = `Hola ${client.companyName || client.name},\n\nPor favor cancelar saldo pendiente correspondiente a la mensualidad de ${
          client.monthlyAmount ?? 'N/A'
        } cuyo día de pago es el ${paymentDay}.\n\nPor favor comunicarse con Miguel Bustos al número ${contactNumber} para coordinar el pago.\n\nGracias.`;

        await emailService.sendEmail({
          toEmail: client.email,
          toName: client.companyName || client.name,
          subject,
          htmlContent,
          textContent,
        });

        sent++;
        this.logger.logInfo('Pending balance reminder sent', {
          clientId: client.id,
          email: client.email,
        });
      } catch (error) {
        this.logger.logError('Error sending pending balance reminder', {
          error,
          clientId: client.id,
        });
        errors.push({ clientId: client.id, error: (error as Error).message || error });
      }
    }

    return { sent, skipped, errors };
  }
}

export default PendingBalanceReminderService;
