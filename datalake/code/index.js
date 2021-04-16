const constants = require('./constants');
const AWS = require('aws-sdk');
const firehose = new AWS.Firehose();
const kinesis = new AWS.Kinesis();
const sqs = new AWS.SQS();

// test demo 6
// A record to be logged in the data lake.
class DataRecord {
  constructor() {
    // Set the defaults for the data record
    this.addTracking({}).addMetadata({}).addProperties().addRequestBody().addValidation().addExperiments().addResponse().addError();
  }

  addTracking({ requestId, xrayId, visitorId, principalId, correlationId, externalCorrelationId, ingressDateTime }) {
    this.tracking = {
      requestId: requestId || '',
      xrayId: xrayId || '',
      visitorId: visitorId || '',
      principalId: principalId || '',
      correlationId: correlationId || '',
      externalCorrelationId: externalCorrelationId || '',
      ingressDateTime: ingressDateTime || '',
    };
    return this;
  }

  addMetadata({ event, action, domain, stage, version, canonicalUrl, httpMethod, userAgent, locale, protocol, sourceIps, landingPageReferrer, landingPage, referrer, isAsyncrhonousRequest }) {
    this.metadata = {
      event: event || '',
      action: action || '',
      domain: domain || 'slyp.com.au',
      stage: stage || 'production',
      version: version || '1',
      canonicalUrl: canonicalUrl || '',
      httpMethod: httpMethod || '',
      userAgent: userAgent || '',
      locale: locale || 'en_AU',
      protocol: protocol || '',
      sourceIps: sourceIps || '',
      landingPageReferrer: landingPageReferrer || '',
      landingPage: landingPage || '',
      referrer: referrer || '',
      isAsyncrhonousRequest: !!isAsyncrhonousRequest,
    };
    return this;
  }

  // Removes undefineds before extending the object
  static _objectAssign(object, additionalProps) {
    const noUndefineds = Object.keys(additionalProps).reduce((prevHash, key) => {
      if (additionalProps[key] !== undefined) {
        return { ...prevHash, [key]: additionalProps[key] };
      }
      return { ...prevHash };
    }, {});
    return Object.assign(object, noUndefineds);
  }

  addProperties(properties) {
    this.properties = { ...properties };
    return this;
  }

  addRequestBody(request) {
    this.request = { ...request };
    return this;
  }

  addValidation(validation) {
    this.validation = { ...validation };
    return this;
  }

  addExperiments(features) {
    this.experiments = features !== undefined ? { features } : {};
    return this;
  }

  addResponse(code, response) {
    this.responseCode = code;
    this.responseCode = { ...response };
    return this;
  }

  addError(error) {
    this.error = { ...error };
    return this;
  }

  addTraceIds({ correlationId, externalCorrelationId, requestId, xrayId }) {
    return this.addTracking(
      DataRecord._objectAssign(this.tracking, {
        correlationId,
        externalCorrelationId,
        requestId,
        xrayId,
      }),
    );
  }

  addPrincipal({ principalId, visitorId }) {
    return this.addTracking(
      DataRecord._objectAssign(this.tracking, {
        visitorId,
        principalId,
      }),
    );
  }

  addIngestionTime({ ingressDateTime }) {
    return this.addTracking(DataRecord._objectAssign(this.tracking, { ingressDateTime }));
  }

  addOperation({ event, action }) {
    return this.addMetadata(DataRecord._objectAssign(this.metadata, { event, action }));
  }

  addPlatform({ domain, stage, version }) {
    return this.addMetadata(
      DataRecord._objectAssign(this.metadata, {
        domain,
        stage,
        version,
      }),
    );
  }

  addHttpRequestEndpoint({ canonicalUrl, httpMethod, protocol, isAsyncrhonousRequest }) {
    return this.addMetadata(
      DataRecord._objectAssign(this.metadata, {
        canonicalUrl,
        httpMethod,
        protocol,
        isAsyncrhonousRequest,
      }),
    );
  }

  addHttpClient({ userAgent, locale, sourceIps, landingPageReferrer, landingPage, referrer }) {
    return this.addMetadata(
      DataRecord._objectAssign(this.metadata, {
        userAgent,
        locale,
        sourceIps,
        landingPageReferrer,
        landingPage,
        referrer,
      }),
    );
  }

  formatRecord() {
    const tracking = {
      ...this.tracking,
      egressDateTime: new Date().toISOString(),
    };
    return {
      tracking,
      metadata: this.metadata,
      properties: this.properties,
      request: this.request,
      validation: this.validation,
      experiments: this.experiments,
      responseCode: this.responseCode,
      response: this.response,
      error: this.error,
    };
  }

  fromApiEvent(apiEvent, { event, action }) {
    if (!apiEvent) {
      return this.addOperation({
        event,
        action,
      });
    }
    const requestContext = apiEvent.requestContext || {};
    const authorizer = requestContext.authorizer || {};
    // Get the headers with lower case
    const headers = Object.fromEntries(Object.entries(apiEvent.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
    const multiValueHeaders = Object.fromEntries(Object.entries(apiEvent.multiValueHeaders || {}).map(([key, value]) => [key.toLowerCase(), value]));
    const forwardedFor = Array.isArray(multiValueHeaders[constants.HEADERS.X_FORWARDED_FOR]) ? multiValueHeaders[constants.HEADERS.X_FORWARDED_FOR][0].split(/\s*,\s*/) : [];
    const sourceIps = requestContext.identity
      && requestContext.identity.sourceIp
      && forwardedFor.includes(requestContext.identity.sourceIp) ?
        forwardedFor : [ ...forwardedFor, requestContext.identity.sourceIp ];
    return this.addTraceIds({
      requestId: requestContext.requestId,
      xrayId: headers[constants.HEADERS.X_AMZN_TRACE_ID],
      correlationId: headers[constants.HEADERS.X_SLYP_CORRELATION_ID],
      externalCorrelationId: headers[constants.HEADERS.X_SLYP_EXTERNAL_CORRELATION_ID],
    }).addPrincipal({
      principalId: authorizer.principalId,
      visitorId: headers[constants.HEADERS.AUTHORIZATION],
    }).addIngestionTime({
      ingressDateTime: authorizer[constants.AUTHORIZER.X_SLYP_INGRESS_TIME],
    }).addOperation({
      event,
      action,
    }).addPlatform({
      domain: `api.${ requestContext.stage === 'prod' ? '' : `${ requestContext.stage }-` }slyp.com.au`,
      stage: requestContext.stage,
      version: '1',
    }).addHttpRequestEndpoint({
      canonicalUrl: requestContext.path,
      httpMethod: apiEvent.httpMethod,
      protocol: requestContext.protocol,
    }).addHttpClient({
      userAgent: headers[constants.HEADERS.USER_AGENT],
      sourceIps,
    });
  }
}

async function sendThroughFirehose({ streamName, data }) {
  const params = {
    DeliveryStreamName: streamName,
    Record: {
      Data: JSON.stringify(data) + '\n',
    },
  };
  try {
    const START_OF_PUSH = Date.now();
    const firehoseResponse = await firehose.putRecord(params).promise();
    const pushDuration = Date.now() - START_OF_PUSH;
    console.log({
      message: 'Successful push to firehose',
      responseStringified: JSON.stringify(firehoseResponse),
      response: firehoseResponse,
      duration: pushDuration,
    });
  } catch (e) {
    console.error({
      message: 'Problem pushing record to firehose',
      reason: e.message,
    });
  }
}

async function sendThroughKinesis({ streamName, data }) {
  const params = {
    PartitionKey: '1', // use something unique if adding more than 1 shard
    StreamName: streamName,
    Data: JSON.stringify(data) + '\n', // do we need to add a newline for kinesis or only for firehose?
  };
  try {
    const START_OF_PUSH = Date.now();
    const kinesisResponse = await kinesis.putRecord(params).promise();
    const pushDuration = Date.now() - START_OF_PUSH;
    console.log({
      message: 'Successful push to kinesis',
      responseStringified: JSON.stringify(kinesisResponse),
      response: kinesisResponse,
      duration: pushDuration,
    });
  } catch (e) {
    console.error({
      message: 'Problem pushing record to kinesis',
      reason: e.message,
    });
  }
}

async function sendThroughSqs({ queueUrl, data }) {
  const params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(data),
  };
  try {
    const START_OF_PUSH = Date.now();
    const sqsResponse = await sqs.sendMessage(params).promise();
    const pushDuration = Date.now() - START_OF_PUSH;
    console.log({
      message: 'Successful push to sqs',
      responseStringified: JSON.stringify(sqsResponse),
      response: sqsResponse,
      duration: pushDuration,
    });
  } catch (e) {
    console.error({
      message: 'Problem pushing record to sqs',
      reason: e.message,
    });
  }
}

// sendThroughMock to test code artifact
async function sendThroughMock({ data }) {
  console.log('===sendThroughMock!===v1.0.10');
  console.log(data);
}

module.exports = { sendThroughFirehose, sendThroughKinesis, sendThroughSqs, sendThroughMock, DataRecord, DataEvents: constants.EVENTS, DataActions: constants.ACTIONS };
