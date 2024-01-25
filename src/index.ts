import { format } from 'date-fns'
import RedisClient from './RedisClient'
import { type MixpanelEvent, processData } from './mixpanel'

console.log('Hello from TypeScript and Node.js!')
console.log(`My timezone is: ${process.env.TZ}`)

let eventsRedisUrl = process.env.DEV_EVENTS_REDIS_REST_URL
let eventsRedisToken = process.env.DEV_EVENTS_REDIS_REST_TOKEN
let impactDashRedisUrl = process.env.DEV_IMPACT_DASH_REDIS_REST_URL
let impactDashRedisToken = process.env.DEV_IMPACT_DASH_REDIS_REST_TOKEN
if (process.env.NN_ENV === 'production') {
  eventsRedisUrl = process.env.EVENTS_REDIS_REST_URL
  eventsRedisToken = process.env.EVENTS_REDIS_REST_TOKEN
  impactDashRedisUrl = process.env.IMPACT_DASH_REDIS_REST_URL
  impactDashRedisToken = process.env.IMPACT_DASH_REDIS_REST_TOKEN
}
const eventsRedisClient = new RedisClient({
  initRedisUrl: eventsRedisUrl,
  initRedisToken: eventsRedisToken,
})
const impactDashRedisClient = new RedisClient({
  initRedisUrl: impactDashRedisUrl,
  initRedisToken: impactDashRedisToken,
})

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

// let transfers = 0
// const transferAnEvent = async (event: MixpanelEvent): Promise<void> => {
//   // save event to redis
//   const redisEventId = `${eventPrefix}${event.properties.$insert_id}`
//   await redisClient.set(redisEventId, JSON.stringify(event))

//   // add event to day set
//   const yyyyMMddString = format(event.properties.time * 1000, 'yyyy-MM-dd')
//   const eventsByDayPrefix = makeAEventsByDayPrefix(yyyyMMddString)
//   await redisClient.addToSet(eventsByDayPrefix, redisEventId)

//   transfers++
//   console.log('transfers: ', transfers)
// }

const iterateSet = async (redis: RedisClient, setName: string, processElement: () => Promise<void>): Promise<void> => {
  let cursor = 0

  do {
    // Use SSCAN to get elements from the set
    const reply = await redis.sscan(setName, cursor, { count: 100 })
    cursor = reply[0]
    const elements = reply[1]

    for (const element of elements) {
      console.log(element)
    }
  } while (cursor !== 0)
}

// Main high-level algo
// 1. Iterate new (daily) events
// 2. Save/update node data from the new events
// 3. Iterate all the nodes and calc active node metadata
void processData(transferAnEvent)
