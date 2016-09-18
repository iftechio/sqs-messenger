module.exports = {
  encode(msg) {
    return JSON.stringify(msg)
  },
  decode(msg) {
    return JSON.parse(msg.Body)
  },
}
