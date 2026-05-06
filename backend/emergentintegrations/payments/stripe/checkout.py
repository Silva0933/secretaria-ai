class CheckoutSessionRequest:
    def __init__(self, amount, currency, success_url, cancel_url, metadata):
        self.amount = amount
        self.currency = currency
        self.success_url = success_url
        self.cancel_url = cancel_url
        self.metadata = metadata

class CheckoutSessionResponse:
    def __init__(self, session_id, url, status="open", payment_status="unpaid"):
        self.session_id = session_id
        self.url = url
        self.status = status
        self.payment_status = payment_status

class StripeCheckout:
    def __init__(self, api_key, webhook_url):
        self.api_key = api_key
        self.webhook_url = webhook_url
    
    async def create_checkout_session(self, request):
        return CheckoutSessionResponse(session_id="mock_session", url="http://localhost:3000/mock-checkout")
    
    async def get_checkout_status(self, session_id):
        return CheckoutSessionResponse(session_id=session_id, url="", status="complete", payment_status="paid")
