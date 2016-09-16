module.exports = {
  sqs: null,
  sns: null,
  set(clients) {
    this.sqs = clients.sqs || this.sqs
    this.sns = clients.sns || this.sns
  },
}
