import { ThirdwebAdapter } from './thirdweb'
import type { PaymentProvider } from './provider'

// Swap this line to change payment providers
export const paymentProvider: PaymentProvider = new ThirdwebAdapter()
