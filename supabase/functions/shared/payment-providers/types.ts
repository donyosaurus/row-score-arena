// Payment Provider Interface (SPI)

export interface CheckoutRequest {
  userId: string;
  amountCents: number;
  stateCode: string;
  returnUrl: string;
  metadata?: Record<string, any>;
}

export interface CheckoutResponse {
  sessionId: string;
  checkoutUrl?: string;
  clientToken?: string;
  expiresAt: Date;
}

export interface CaptureRequest {
  sessionId: string;
  providerSessionId: string;
}

export interface CaptureResponse {
  success: boolean;
  transactionId: string;
  feeCents?: number;
}

export interface PayoutRequest {
  userId: string;
  amountCents: number;
  destinationToken: string;
  metadata?: Record<string, any>;
}

export interface PayoutResponse {
  success: boolean;
  payoutId: string;
  estimatedArrival?: Date;
}

export interface RefundRequest {
  transactionId: string;
  amountCents: number;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
}

export interface TransactionStatusRequest {
  providerTransactionId: string;
}

export interface TransactionStatusResponse {
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  amountCents: number;
  feeCents?: number;
  metadata?: Record<string, any>;
}

export interface WebhookVerificationRequest {
  signature: string;
  payload: string;
  timestamp?: string;
}

export interface PaymentProvider {
  name: string;
  
  // Create hosted checkout session or return client token
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
  
  // Capture/confirm a deposit after user completes checkout
  captureDeposit(request: CaptureRequest): Promise<CaptureResponse>;
  
  // Initiate payout to user's account
  initiatePayout(request: PayoutRequest): Promise<PayoutResponse>;
  
  // Refund a transaction
  refund(request: RefundRequest): Promise<RefundResponse>;
  
  // Get status of a transaction
  getTransactionStatus(request: TransactionStatusRequest): Promise<TransactionStatusResponse>;
  
  // Verify webhook signature
  verifyWebhook(request: WebhookVerificationRequest): Promise<boolean>;
  
  // Handle webhook payload
  handleWebhook(payload: any): Promise<WebhookEvent>;
}

export interface WebhookEvent {
  eventType: 'payment.succeeded' | 'payment.failed' | 'payout.succeeded' | 'payout.failed' | 'refund.succeeded';
  providerSessionId?: string;
  providerTransactionId?: string;
  amountCents: number;
  feeCents?: number;
  status: string;
  metadata?: Record<string, any>;
}
