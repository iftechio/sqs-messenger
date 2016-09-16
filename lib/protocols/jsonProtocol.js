module.exports = {
  encode(msg) {
    return JSON.stringify(msg)
  },
  decode(msg) {
    try {
      return JSON.parse(msg.Body)
    } catch (e) {
      console.error(e)
      return null
    }
  },
}
