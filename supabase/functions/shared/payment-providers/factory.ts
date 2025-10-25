// Payment Provider Factory

import type { PaymentProvider } from './types.ts';
import { MockProviderAdapter } from './mock-adapter.ts';
import { HighRiskCardAdapter } from './highrisk-adapter.ts';
import { ACHAdapter } from './ach-adapter.ts';

export type ProviderType = 'mock' | 'highrisk' | 'ach';

export function getPaymentProvider(providerType?: ProviderType): PaymentProvider {
  const provider = providerType || (Deno.env.get('PAYMENTS_PROVIDER') as ProviderType) || 'mock';
  
  console.log(`[PaymentFactory] Creating provider: ${provider}`);
  
  switch (provider) {
    case 'mock':
      return new MockProviderAdapter();
    
    case 'highrisk':
      return new HighRiskCardAdapter();
    
    case 'ach':
      return new ACHAdapter();
    
    default:
      console.warn(`[PaymentFactory] Unknown provider: ${provider}, defaulting to mock`);
      return new MockProviderAdapter();
  }
}
