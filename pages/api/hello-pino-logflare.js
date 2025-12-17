// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import logger from '../../logger/logger';

export default function handler(req, res) {
  res.status(200);

  const data = {
    request: {
      method: req.method,
      url: req.url,
    },
    response: {
      status: res.statusCode,
    },
  };

  // Logging to SigNoz via OTLP
  logger.info('Handled response. Logged with SigNoz.', {
    ...data,
    source: 'server',
  });
  console.log('Handled response. Logged with SigNoz.', { source: 'server' });

  res.json({ name: 'John Doe' });
}
