module.exports = Object.freeze({
  HEADERS: {
    INGRESS_DATE_TIME: 'x-slyp-ingress-date-time',
    X_AMZN_TRACE_ID: 'x-amzn-trace-id',
    X_SLYP_CORRELATION_ID: 'x-slyp-correlation-id',
    X_SLYP_EXTERNAL_CORRELATION_ID: 'x-slyp-external-correlation-id',
    AUTHORIZATION: 'authorization',
    USER_AGENT: 'user-agent',
    X_FORWARDED_FOR: 'x-forwarded-for',
  },
  AUTHORIZER: {
    X_SLYP_INGRESS_TIME: 'x-slyp-ingress-date-time',
  },
  EVENTS: {
    MERCHANT_API_RECEIPT: 'merchant_api_receipt',
  },
  ACTIONS: {
    RECEIPT_CREATE: 'receipt_create',
  },
});
