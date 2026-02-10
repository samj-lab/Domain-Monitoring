export const NOTIFICATION_SERVICE = 'NOTIFICATION_SERVICE';

export interface INotificationService {
  /**
   * Send a message via the notification provider
   * @param message - The message to send (max 4096 chars, will be truncated)
   * @returns true if message was sent successfully, false otherwise
   */
  sendMessage(message: string): Promise<boolean>;

  /**
   * Get the name of the notification provider
   * @returns Provider name (e.g., 'Signal', 'Telegram', 'WhatsApp')
   */
  getProviderName(): string;
}
