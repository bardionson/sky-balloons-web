import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutForm from '../CheckoutForm'

// Mock Thirdweb SDK
vi.mock('thirdweb', () => ({
  createThirdwebClient: () => ({}),
  defineChain: (id: number) => ({ id }),
}))

vi.mock('thirdweb/react', () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BuyWidget: ({ purchaseData }: { purchaseData: Record<string, unknown> }) => (
    <div data-testid="thirdweb-widget" data-order-id={purchaseData?.orderId}>
      Thirdweb Pay
    </div>
  ),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const BASE_PROPS = {
  mintId: 'mint-123',
  mintUrl: 'https://example.com/mint/mint-123',
  priceUsd: '50.00',
}

const VALID_CLIENT_SECRET = JSON.stringify({
  orderId: 'order-1',
  treasuryAddress: '0xTreasury',
  chainId: 11155111,
  priceEth: '0.02',
  recipientEmail: 'buyer@test.com',
  recipientWallet: null,
})

describe('CheckoutForm', () => {
  beforeEach(() => mockFetch.mockReset())

  it('renders the email and name fields', () => {
    render(<CheckoutForm {...BASE_PROPS} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders the mint price on the submit button', () => {
    render(<CheckoutForm {...BASE_PROPS} />)
    expect(screen.getByRole('button', { name: /Mint Now.*50/i })).toBeInTheDocument()
  })

  it('shows mailing address fields when expanded', async () => {
    render(<CheckoutForm {...BASE_PROPS} />)
    const toggle = screen.getByText(/add mailing address/i)
    await userEvent.click(toggle)
    expect(screen.getByLabelText(/street/i)).toBeInTheDocument()
  })

  it('shows error message when order creation fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Payment provider error' }),
    })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Test User')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByText(/payment provider error/i)).toBeInTheDocument()
    })
  })

  it('shows error when order returns without clientSecret', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'order-1' }), // no clientSecret
    })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'buyer@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Buyer Name')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByText(/payment session unavailable/i)).toBeInTheDocument()
    })
  })

  it('renders Thirdweb BuyWidget after successful order creation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'order-1', clientSecret: VALID_CLIENT_SECRET }),
    })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'buyer@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Buyer Name')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByTestId('thirdweb-widget')).toBeInTheDocument()
    })
  })

  it('passes orderId to BuyWidget via purchaseData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'order-abc', clientSecret: VALID_CLIENT_SECRET }),
    })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'buyer@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Buyer Name')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      const widget = screen.getByTestId('thirdweb-widget')
      // orderId comes from the API response orderId (passed into config)
      expect(widget).toHaveAttribute('data-order-id', 'order-abc')
    })
  })
})
