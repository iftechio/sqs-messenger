export let sqs: any = null

export let sns: any = null

export function set(clients) {
  sqs = clients.sqs || sqs
  sns = clients.sns || sns
}
