export function encode(msg) {
  return JSON.stringify(msg)
}

export function decode(msg) {
  return JSON.parse(msg.Body)
}
