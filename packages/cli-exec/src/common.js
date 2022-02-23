export const flags = [{
  name: 'port',
  description: 'Local CLI server port',
  env: 'PERCY_SERVER_PORT',
  percyrc: 'port',
  type: 'number',
  parse: Number,
  default: 5338,
  short: 'P'
}];
