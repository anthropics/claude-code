import type Types from '../types'

/**
 * The order matters: a result is read as the first format that gives
 * points, and two formats can start at the same key (`series`).
 *
 * Prometheus starts under `data.result`, since the reading of tables
 * searches the values of any other record. Grafana's frames state their own
 * field types: see `grafanaMetrics`.
 */
export const METRIC_FORMATS: readonly Types.MetricFormat[] = [
  {
    name: 'Prometheus',
    series: '[]',
    labels: ['metric'],
    time: 'values.[].0',
    value: 'values.[].1',
    isReadAtInstants: true,
  },
  {
    name: 'Datadog',
    series: 'series.[]',
    labels: ['metric', 'scope', 'group', 'functions'],
    time: 'pointlist.[].0',
    value: 'pointlist.[].1',
    isReadAtInstants: false,
    unit: 'unit.[].short_name',
  },
  {
    name: 'named-series',
    series: 'series.[]',
    labels: ['name'],
    time: 'data.[].0',
    value: 'data.[].1',
    isReadAtInstants: false,
  },
  {
    name: 'Datadog-buckets',
    series: 'data.buckets.[]',
    labels: ['by'],
    time: 'computes.*.[].time',
    value: 'computes.*.[].value',
    isReadAtInstants: false,
  },
  {
    name: 'Graphite',
    series: '[]',
    labels: ['target'],
    time: 'datapoints.[].1',
    value: 'datapoints.[].0',
    isReadAtInstants: false,
  },
  {
    name: 'CloudWatch',
    series: 'MetricDataResults.[]',
    labels: ['Label'],
    time: 'Timestamps.[]',
    value: 'Values.[]',
    isReadAtInstants: false,
  },
  {
    name: 'Cloud-Monitoring',
    series: 'timeSeries.[]',
    labels: ['metric.labels'],
    time: 'points.[].interval.endTime',
    value: 'points.[].value.*',
    isReadAtInstants: true,
  },
  {
    name: 'Cost-Explorer',
    series: '',
    labels: [],
    time: 'ResultsByTime.[].TimePeriod.Start',
    value: 'ResultsByTime.[].Total.*.Amount',
    isReadAtInstants: false,
    unit: 'ResultsByTime.0.Total.*.Unit',
  },
]
