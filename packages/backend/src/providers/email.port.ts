export type SendEmailInput = {
  idempotencyKey: string;
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = {
  providerMessageId: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
