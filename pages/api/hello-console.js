// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import logger from "../../logger/logger";

export default function handler(req, res) {
  res.status(200)

  const data = {
    request: {
      method: req.method,
      url: req.url
    },
    response: {
      status: res.statusCode
    }
  }

  // Logging to SigNoz
  logger.info("Handled response. Logged with SigNoz.", {
    ...data,
    source: 'api/hello-console'
  })

  res.json({ name: 'John Doe' })
}
