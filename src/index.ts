import { format } from 'date-fns'
import RedisClient from './RedisClient'
import { type MixpanelEvent, processData } from './mixpanel'

console.log('Hello from TypeScript and Node.js!')
console.log(`My timezone is: ${process.env.TZ}`)

const redisClient = new RedisClient()
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// const test = async () => {
//   const output = await redisClient.get('numActiveNodes')
//   console.log('numActiveNodes: ', output)
// }
// void test()

const eventPrefix = 'event::'
const eventsByDayPrefixWithoutDate = 'eventsByDay'
const makeAEventsByDayPrefix = (yyyyMMddString: string): string =>
  `${eventsByDayPrefixWithoutDate}::${yyyyMMddString}`

let transfers = 0
const transferAnEvent = async (event: MixpanelEvent): Promise<void> => {
  // save event to redis
  const redisEventId = `${eventPrefix}${event.properties.$insert_id}`
  await redisClient.set(redisEventId, JSON.stringify(event))

  // add event to day set
  const yyyyMMddString = format(event.properties.time * 1000, 'yyyy-MM-dd')
  const eventsByDayPrefix = makeAEventsByDayPrefix(yyyyMMddString)
  await redisClient.addToSet(eventsByDayPrefix, redisEventId)

  transfers++
  console.log('transfers: ', transfers)
}

void processData(transferAnEvent)
