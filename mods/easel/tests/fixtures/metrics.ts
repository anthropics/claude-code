import { START_SECONDS } from './start-seconds.js'

/**
 * The answer of a Prometheus range query, as the host stores it.
 */
export const METRICS = [
  {
    type: 'text',
    text: JSON.stringify({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { job: 'kettle' },
            values: [12, 18, 15, 21, 30].map((value, index) => [
              START_SECONDS + index * 60,
              String(value),
            ]),
          },
        ],
      },
    }),
  },
]
