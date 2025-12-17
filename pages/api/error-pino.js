import logger from '../../logger/logger';

export default function handler(req, res) {
  // Lets log an error with SigNoz here.

  try {
    throw new Error('Whoops! Error with SigNoz.');
  } catch (e) {
    logger.error('API error sent to SigNoz', {
      error: e.message,
      stack: e.stack,
      source: 'api/error-pino',
    });
  }

  res.status(500).json({ error: 'true' });
}
