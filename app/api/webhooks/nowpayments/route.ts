import { handleNowPaymentsWebhook } from "@/lib/billing/webhook";

export async function POST(request: Request) {
  return handleNowPaymentsWebhook(request, "/api/webhooks/nowpayments");
}
