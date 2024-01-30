import { nodePrefix, type NodeJson, type UserJson, NodeServiceJson, nodeServicePrefix } from './redisTypes'
// import { processData } from './../mixpanel'
import { type MixpanelEvent } from '../mixpanel'
import RedisClient, { eventsRedisClient, impactDashRedisClient } from './RedisClient'
import { type DailyUserReport } from './mixpanel'
import { logDeepObj } from './util'
// import { type MixpanelEvent } from './mixpanel'

console.log('Hello from TypeScript and Node.js!')
console.log(`My timezone is: ${process.env.TZ}`)


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

const iterateSet = async (redis: RedisClient, setName: string, processElement: (element: string | number) => Promise<void>): Promise<void> => {
  let cursor = 0

  do {
    // Use SSCAN to get elements from the set
    const reply = await redis.sscan(setName, cursor, { count: 100 })
    cursor = reply[0]
    const elements = reply[1]

    for (const element of elements) {
      // console.log(element)
      await processElement(element)
    }
  } while (cursor !== 0)
  console.log('cursor reached (if 0, then less than 100 items in the set): ', cursor)
}

const processEvent = async (eventId: string | number): Promise<void> => {
  const eventIdStr = eventId as string
  // console.log('process eventId: ', eventIdStr)

  // Only processing Daily Reports for now
  const eventRedisObj = await eventsRedisClient.client.json.get(eventIdStr)

  if (eventRedisObj === null) {
    throw new Error(`eventId not found in redis: ${eventId}`)
  }
  // console.log('process eventRedisObj: ', eventRedisObj, typeof eventRedisObj)

  const event = eventRedisObj as MixpanelEvent
  // console.log('process event: ', event)
  if (event.event === 'DailyUserReport') {
    logDeepObj(event)
    const dailyEvent = event as DailyUserReport
    const properties = dailyEvent.properties
    const userId = properties.$user_id
    const commonProperties = {
      region: properties.$region,
      city: properties.$city,
      country: properties.mp_country_code,
      userId,
    }
    const eventTime = properties.time

    // Upsave each node of the user
    for (const nodeId in properties.eventData) {
      const node = properties.eventData[nodeId]
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const serviceIds = Object.keys(node.nodes)
      const nodeJson: NodeJson = {
        nodeId,
        specId: node.specId,
        specVersion: node.specVersion,
        serviceIds,
        status: node.status,
        lastReportedTimestamp: eventTime,
        diskUsedGBs: node.diskUsedGBs,
        network: node.network,
        lastRunningTimestampMs: node.lastRunningTimestampMs,
        lastStartedTimestampMs: node.lastStartedTimestampMs,
        ...commonProperties
      }
      await impactDashRedisClient.client.json.set(`${nodePrefix}${nodeId}`, '$', nodeJson)
      // Upsave each service of the node
      for (const serviceId in node.nodes) {
        const service = node.nodes[serviceId]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const nodeServiceJson: NodeServiceJson = {
          nodeId,
          serviceId,
          specId: service.specId,
          specVersion: service.specVersion,
          status: service.status,
          lastReportedTimestamp: eventTime,
          diskUsedGBs: service.diskUsedGBs,
          network: service.network,
          lastRunningTimestampMs: service.lastRunningTimestampMs,
          lastStartedTimestampMs: service.lastStartedTimestampMs,
          ...commonProperties,
        }
        await impactDashRedisClient.client.json.set(`${nodeServicePrefix}${serviceId}`, '$', nodeServiceJson)
    }

    // Upsave user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const nodeIds = Object.keys(properties.eventData)
    const userJson: UserJson = {
      lastReportedTimestamp: eventTime,
      ...commonProperties,
      ...properties.context,
      nodeIds,
    }
    await impactDashRedisClient.client.json.set(`${nodePrefix}${userId}`, '$', userJson)

    // indexing for active node data

  } // end for (const nodeId in properties.eventData)
}
// Main high-level algo
// 1. Iterate new (daily) events
// 2. Save/update node, service, and user data from the new events
// 3. Iterate all the nodes and calc active node metadata
// void processData(transferAnEvent)

void iterateSet(impactDashRedisClient, makeAEventsByDayPrefix('2024-01-25'), processEvent)

// ============ Troubleshooting ==============
// const testConnection = async (): Promise<void> => {
//   console.log(await eventsRedisClient.get('hi'))
//   console.log(await impactDashRedisClient.get('hi'))
// }
// void testConnection()
