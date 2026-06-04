import { PrismaClient } from '@prisma/client';
import { Logger } from '../../shared/Logger';
import { getEmailService } from '../../shared/serviceProvider';
import { createPendingBalanceReminderEmailHtml } from '../../infrastructure/services/emailTemplates/pendingBalanceReminderTemplate';
import type { EmailData } from '../../infrastructure/services/EmailService';

interface PendingBalanceReminderError {
  clientId: number;
  email?: string;
  error: string;
}

export class PendingBalanceReminderService {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Busca clientes activos con mensualidad definida cuyo día de pago ya venció
   * y envía UN SOLO correo recordatorio al COMPANY_EMAIL con todos los clientes como BCC.
   */
  async sendPendingBalanceReminders(): Promise<{
    sent: number;
    skipped: number;
    errors: PendingBalanceReminderError[];
  }> {
    this.logger.logInfo('Running pending balance reminders');

    const now = new Date();
    const colombiaOffset = -5 * 60;
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
    const errors: PendingBalanceReminderError[] = [];
    let skipped = 0;

    if (!companyReminderEmail) {
      this.logger.logError('COMPANY_EMAIL is not configured');
      errors.push({ clientId: 0, error: 'COMPANY_EMAIL is not configured' });
      return { sent: 0, skipped: 0, errors };
    }

    const clientEmails: Array<{ email: string; name?: string }> = [];

    for (const client of clients) {
      const paymentDay = client.paymentDayMonth as number | null;
      if (!paymentDay || paymentDay >= today) {
        skipped++;
        continue;
      }

      if (!client.email) {
        this.logger.logWarning('Client has no email, skipping reminder', {
          clientId: client.id,
        });
        skipped++;
        continue;
      }

      clientEmails.push({
        email: client.email,
        name: client.companyName || client.name,
      });
    }

    if (clientEmails.length === 0) {
      this.logger.logInfo('No clients with pending balance to notify');
      return { sent: 0, skipped, errors };
    }

    const contactNumber = process.env.CONTACT_MIGUEL_NUMBER;
    const contactName = process.env.CONTACT_MIGUEL_NAME;
    const colombiaTimeLabel = colombiaTime.toLocaleTimeString('es-CO', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const subject = `Recordatorio de saldos pendientes - ${colombiaDate} ${colombiaTimeLabel}`;

    const htmlContent = createPendingBalanceReminderEmailHtml({
      contactName,
      contactNumber,
    });

    const textContent = `Estimado cliente,\n\nTienen pagos pendientes de mensualidad y/o saldos correspondientes a implementación. Por favor comuníquense con nosotros para coordinar el pago.\n\nPor favor comunicarse con ${contactName} al número ${contactNumber} para coordinar el pago.\n\nGracias.`;

    try {
      await this.sendEmailWithSingleRetry(emailService, {
        toEmail: companyReminderEmail,
        toName: 'Dataor',
        subject,
        htmlContent,
        textContent,
        bccEmails: clientEmails,
      });

      this.logger.logInfo('Pending balance reminder sent', {
        toEmail: companyReminderEmail,
        bccCount: clientEmails.length,
      });

      return { sent: 1, skipped, errors };
    } catch (error) {
      this.logger.logError('Pending balance reminder failed after retry', {
        error,
        toEmail: companyReminderEmail,
      });
      errors.push({
        clientId: 0,
        email: companyReminderEmail,
        error: (error as Error).message || error,
      });
      return { sent: 0, skipped, errors };
    }
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

  private async sendEmailWithSingleRetry(
    emailService: { sendEmail: (emailData: EmailData) => Promise<void> },
    emailData: EmailData
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
