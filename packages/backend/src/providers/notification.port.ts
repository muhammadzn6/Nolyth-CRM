export type CreateInAppNotificationInput = {
  idempotencyKey: string;
  recipientUserId: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export type CreateInAppNotificationResult = {
  notificationId: string;
};

export interface NotificationProvider {
  createInApp(
    input: CreateInAppNotificationInput,
  ): Promise<CreateInAppNotificationResult>;
}
