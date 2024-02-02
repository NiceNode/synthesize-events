import { nodePrefix, type NodeJson, type UserJson, type NodeServiceJson, nodeServicePrefix, userPrefix } from './redisTypes'
import { eventsRedisClient, impactDashRedisClient, iterateSet } from './RedisClient'
import { type MixpanelEvent, type DailyUserReport } from './mixpanel'
import { logDeepObj } from './util'
import { indexActiveNodeSets, indexSingleNodeReport } from './activeNodesIndexing'

/**
 * This script reads events from this day and indexes active
 * nodes (across 3 sliding windows day, week, month) for this day only.
 * yyyy-MM-dd (ex. 2024-01-25)
 */
export const DAY_TO_INDEX_YYYY_MM_DD = '2024-01-28'
// '2024-01-31'

console.log('Hello from TypeScript and Node.js!')
console.log(`My timezone is: ${process.env.TZ}`)
console.log(`Indexing for day: ${DAY_TO_INDEX_YYYY_MM_DD}`)

const eventsByDayPrefixWithoutDate = 'eventsByDay'
const makeAEventsByDayPrefix = (yyyyMMddString: string): string =>
  `${eventsByDayPrefixWithoutDate}::${yyyyMMddString}`

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
      await impactDashRedisClient.client.json.set(`${userPrefix}${userId}`, '$', userJson)
      // todo: active users sets

      // Upsave the node into active node sets
      await indexSingleNodeReport(nodeJson)
    } // end processing a single node in a DailyUserReport
  } // end looping nodes in a DailyUserReport (for (const nodeId in properties.eventData))
} // end iterate set

// ===============  Main high-level algo  ===================
// 1. Iterate new (daily) events
// 2. Save/update node, service, and user data from the new events
// 3. Iterate all the nodes and calc active node metadata
export const dailyIndexingRoutine = async (): Promise<void> => {
  await iterateSet(eventsRedisClient, makeAEventsByDayPrefix(DAY_TO_INDEX_YYYY_MM_DD), processEvent)
  await indexActiveNodeSets()
}
void dailyIndexingRoutine()

// ============ Troubleshooting ==============
// const testConnection = async (): Promise<void> => {
//   console.log(await eventsRedisClient.get('hi'))
//   console.log(await impactDashRedisClient.get('hi'))
// }
// void testConnection()
