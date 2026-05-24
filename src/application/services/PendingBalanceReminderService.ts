import { PrismaClient } from '@prisma/client';
import { Logger } from '../../shared/Logger';
import { getEmailService } from '../../shared/serviceProvider';
import { createPendingBalanceReminderEmailHtml } from '../../infrastructure/services/emailTemplates/pendingBalanceReminderTemplate';

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
    const colombiaDate = colombiaTime.toLocaleDateString('es-CO');
    const reminderIntervalDays = this.getReminderIntervalDays();
    const shouldSendReminderToday = (today - 1) % reminderIntervalDays === 0;

    this.logger.logInfo('Resetting hasPaid for clients whose payment day is today', { today });
    await this.prisma.client.updateMany({
      where: {
        isActive: true,
        paymentDayMonth: today,
      },
      data: {
        hasPaid: false,
      },
    });

    if (!shouldSendReminderToday) {
      this.logger.logInfo('Today is not a reminder day, skipping reminder run', {
        today,
        reminderIntervalDays,
      });

      return { sent: 0, skipped: 0, errors: [] };
    }

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
    const companyReminderEmail = process.env.COMPANY_EMAIL;

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

        const contactNumber = process.env.CONTACT_MIGUEL_NUMBER;
        const contactName = process.env.CONTACT_MIGUEL_NAME;
        const clientDisplayName = client.companyName || client.name;
        const colombiaTimeLabel = colombiaTime.toLocaleTimeString('es-CO', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const subject = `Recordatorio pago a Dataor - ${clientDisplayName} - ${colombiaDate} ${colombiaTimeLabel}`;

        const htmlContent = createPendingBalanceReminderEmailHtml({
          clientName: client.name,
          companyName: client.companyName,
          monthlyAmount: client.monthlyAmount?.toString() ?? null,
          paymentDay,
          contactName,
          contactNumber,
        });

        const textContent = `Hola ${client.companyName || client.name},\n\nPor favor cancelar saldo pendiente correspondiente a la mensualidad de ${
          client.monthlyAmount ?? 'N/A'
        } cuyo día de pago es el ${paymentDay}.\n\nPor favor comunicarse con Miguel Bustos al número ${contactNumber} para coordinar el pago.\n\nGracias.`;

        const recipients = Array.from(
          new Set(
            [companyReminderEmail, client.email].filter((email): email is string => Boolean(email))
          )
        );

        if (recipients.length === 0) {
          this.logger.logWarning('Client has no email and company email is missing, skipping', {
            clientId: client.id,
          });
          skipped++;
          continue;
        }

        for (const recipientEmail of recipients) {
          try {
            await this.sendEmailWithSingleRetry(emailService, {
              toEmail: recipientEmail,
              toName: recipientEmail === companyReminderEmail ? 'Empresa' : clientDisplayName,
              subject,
              htmlContent,
              textContent,
            });

            sent++;
            this.logger.logInfo('Pending balance reminder sent', {
              clientId: client.id,
              email: recipientEmail,
            });
          } catch (error) {
            this.logger.logError('Pending balance reminder failed after retry', {
              error,
              clientId: client.id,
              email: recipientEmail,
            });
            errors.push({
              clientId: client.id,
              email: recipientEmail,
              error: (error as Error).message || error,
            });
          }

          if (recipientEmail !== recipients[recipients.length - 1]) {
            await this.sleep(500);
          }
        }
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

  private getReminderIntervalDays(): number {
    const rawInterval = process.env.PENDING_BALANCE_REMINDER_INTERVAL_DAYS;
    const parsedInterval = rawInterval ? Number.parseInt(rawInterval, 10) : 3;

    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
      this.logger.logWarning('Invalid reminder interval configured, using default value', {
        rawInterval,
        fallbackIntervalDays: 3,
      });

      return 3;
    }

    return parsedInterval;
  }

  private async sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private async sendEmailWithSingleRetry(
    emailService: { sendEmail: (emailData: any) => Promise<void> },
    emailData: {
      toEmail: string;
      toName: string;
      subject: string;
      htmlContent: string;
      textContent?: string;
    }
  ): Promise<void> {
    try {
      await emailService.sendEmail(emailData);
    } catch (firstError) {
      this.logger.logWarning('Email send failed, retrying once', {
        toEmail: emailData.toEmail,
        subject: emailData.subject,
        error: firstError instanceof Error ? firstError.message : String(firstError),
      });

      await emailService.sendEmail(emailData);
    }
  }
}

export default PendingBalanceReminderService;
