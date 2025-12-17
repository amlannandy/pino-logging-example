import pino from 'pino';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { Writable } from 'stream';

let provider;
let configured = false;

const serviceName =
  process.env.NEXT_PUBLIC_SIGNOZ_SERVICE_NAME ||
  process.env.SIGNOZ_SERVICE_NAME ||
  'next-log-example';

const serviceNamespace =
  process.env.NEXT_PUBLIC_SIGNOZ_SERVICE_NAMESPACE ||
  process.env.SIGNOZ_SERVICE_NAMESPACE;

const serviceVersion =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'dev';

const resolveConfig = () => {
  const isBrowser = typeof window !== 'undefined';
  const endpoint =
    (isBrowser
      ? process.env.NEXT_PUBLIC_SIGNOZ_ENDPOINT
      : process.env.SIGNOZ_ENDPOINT) ||
    (isBrowser
      ? process.env.NEXT_PUBLIC_SIGNOZ_REGION
        ? `https://ingest.${process.env.NEXT_PUBLIC_SIGNOZ_REGION}.staging.signoz.cloud:443/v1/logs`
        : undefined
      : process.env.SIGNOZ_REGION
      ? `https://ingest.${process.env.SIGNOZ_REGION}.staging.signoz.cloud:443/v1/logs`
      : undefined);

  const ingestionKey = isBrowser
    ? process.env.NEXT_PUBLIC_SIGNOZ_INGESTION_KEY
    : process.env.SIGNOZ_INGESTION_KEY;

  return {
    endpoint,
    headers: ingestionKey
      ? { 'signoz-ingestion-key': ingestionKey }
      : undefined,
  };
};

export const initSignozLogger = () => {
  if (provider || configured) return;

  const { endpoint, headers } = resolveConfig();

  if (!endpoint) {
    configured = false;
    if (typeof console !== 'undefined') {
      console.warn(
        '[SigNoz] Logging not configured. Set SIGNOZ_ENDPOINT or SIGNOZ_REGION (and optional SIGNOZ_INGESTION_KEY).'
      );
    }
    return;
  }

  provider = new LoggerProvider({
    resource: new Resource(
      {
        'service.name': serviceName,
        'service.namespace': serviceNamespace,
        'service.version': serviceVersion,
        'deployment.environment': process.env.NODE_ENV || 'development',
      },
      undefined
    ),
  });

  provider.addLogRecordProcessor(
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: endpoint,
        headers,
      })
    )
  );

  logs.setGlobalLoggerProvider(provider);
  configured = true;
};

const emitLog = (severityNumber, severityText, body, attributes = {}) => {
  if (!provider && !configured) {
    initSignozLogger();
  }

  if (!provider) {
    // Fallback to console so logs are not lost if SigNoz is not configured.
    // eslint-disable-next-line no-console
    console.log(`[SigNoz fallback][${severityText}]`, body, attributes);
    return;
  }

  const logger = logs.getLogger('next-signoz-logger');

  logger.emit({
    body,
    severityNumber,
    severityText,
    attributes,
  });
};

const levelToSeverity = level => {
  switch (level) {
    case 10:
      return { num: SeverityNumber.TRACE, text: 'TRACE' };
    case 20:
      return { num: SeverityNumber.DEBUG, text: 'DEBUG' };
    case 30:
      return { num: SeverityNumber.INFO, text: 'INFO' };
    case 40:
      return { num: SeverityNumber.WARN, text: 'WARN' };
    case 50:
      return { num: SeverityNumber.ERROR, text: 'ERROR' };
    case 60:
      return { num: SeverityNumber.FATAL, text: 'FATAL' };
    default:
      return { num: SeverityNumber.INFO, text: 'INFO' };
  }
};

const otelStream = () =>
  new Writable({
    objectMode: true,
    write(chunk, _enc, cb) {
      try {
        const logObj = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
        const { num, text } = levelToSeverity(logObj.level);
        const { msg, message, ...rest } = logObj;
        emitLog(num, text, msg || message || '', rest);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[SigNoz] Failed to process pino log', err);
      } finally {
        cb();
      }
    },
  });

const isBrowser = typeof window !== 'undefined';

// In the browser we skip pino's stream transport and emit directly via OTEL.
const browserLogger = {
  debug: (body, attributes = {}) =>
    emitLog(SeverityNumber.DEBUG, 'DEBUG', body, attributes),
  info: (body, attributes = {}) =>
    emitLog(SeverityNumber.INFO, 'INFO', body, attributes),
  warn: (body, attributes = {}) =>
    emitLog(SeverityNumber.WARN, 'WARN', body, attributes),
  error: (body, attributes = {}) =>
    emitLog(SeverityNumber.ERROR, 'ERROR', body, attributes),
};

// On the server, keep pino with the OTEL transport.
const serverLogger = pino(
  {
    level: process.env.LOG_LEVEL || 'debug',
    base: {
      env: process.env.NODE_ENV,
      revision: process.env.VERCEL_GIT_COMMIT_SHA,
    },
  },
  otelStream()
);

const logger = isBrowser ? browserLogger : serverLogger;

export default logger;
