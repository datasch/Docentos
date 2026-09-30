const { handleStripeWebhook, simulateDevPaymentSuccess } = await import('../server/paymentService.js');
let webhookRejected = false;
let simulationRejected = false;
try {
  await handleStripeWebhook(JSON.stringify({ id: `evt_d2_${Date.now()}`, type: 'd2.probe', data: { object: {} } }));
} catch {
  webhookRejected = true;
}
try {
  await simulateDevPaymentSuccess('missing-payment');
} catch (error) {
  simulationRejected = String(error).includes('development');
}
process.stdout.write(`PAYMENT_PROBE:${JSON.stringify({ webhookRejected, simulationRejected })}\n`);
