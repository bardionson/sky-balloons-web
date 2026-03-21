import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutForm from '../CheckoutForm'

// Mock Crossmint SDK
vi.mock('@crossmint/client-sdk-react-ui', () => ({
  CrossmintProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CrossmintEmbeddedCheckout: () => <div data-testid="crossmint-checkout">Checkout</div>,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const BASE_PROPS = {
  mintId: 'mint-123',
  mintUrl: 'https://example.com/mint/mint-123',
  priceUsd: '50.00',
}

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

  it('renders CrossmintEmbeddedCheckout after successful order creation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orderId: 'order-1', clientSecret: 'cs_test' }),
      })
      // Status polling returns pending first
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending' }),
      })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'buyer@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Buyer Name')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByTestId('crossmint-checkout')).toBeInTheDocument()
    })
  })
})
