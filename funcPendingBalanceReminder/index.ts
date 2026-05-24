import { AzureFunction, Context } from '@azure/functions';
import { Logger } from '../src/shared/Logger';
import { getPendingBalanceReminderService } from '../src/shared/serviceProvider';

const funcPendingBalanceReminder: AzureFunction = async function (
  context: Context,
  reminderTimer: unknown
): Promise<void> {
  const logger = new Logger(context);

  try {
    logger.logInfo('Pending balance reminder timer started');

    const reminderService = getPendingBalanceReminderService(logger);
    const result = await reminderService.sendPendingBalanceReminders();

    logger.logInfo('Pending balance reminder run completed', {
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      logger.logWarning('Some reminders failed', { errors: result.errors });
    }

    if (
      typeof reminderTimer === 'object' &&
      reminderTimer !== null &&
      'isPastDue' in reminderTimer &&
      (reminderTimer as { isPastDue?: boolean }).isPastDue
    ) {
      logger.logWarning('Reminder timer is running late!');
    }
  } catch (error) {
    logger.logError('Critical error in pending balance reminder function', error);
    throw error;
  }
};

export default funcPendingBalanceReminder;
