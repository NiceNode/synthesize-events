import { dailyActiveNodesSet, monthlyActiveNodesSet, weeklyActiveNodesSet, type NodeJson, nodePrefix, makeAKeyByDay, dailyActiveNodesSetByDay, dailyActiveNodesByDay, weeklyActiveNodesByDay, monthlyActiveNodesByDay } from './redisTypes'
import { impactDashRedisClient, iterateSet } from './RedisClient'
import { DAY_TO_INDEX_YYYY_MM_DD } from './index'

const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000 // 24 hours, 60 minutes per hour, 60 seconds per minute, 1000 milliseconds per second
const ONE_WEEK_MILLISECONDS = 7 * ONE_DAY_MILLISECONDS // 7 days in a week
const ONE_MONTH_MILLISECONDS = 30 * ONE_DAY_MILLISECONDS // Assuming 30 days in a month for simplicity

const now = new Date()
// todo: do yesterday
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const timestampStartOfDay = startOfDay.getTime()

const dailyActiveThreshold = timestampStartOfDay - ONE_DAY_MILLISECONDS
const weeklyActiveThreshold = timestampStartOfDay - ONE_WEEK_MILLISECONDS
const monthlyActiveThreshold = timestampStartOfDay - ONE_MONTH_MILLISECONDS

/**
 * Used to keep track of historically active nodes by day
 */
const dailyActiveNodesByDayKey = makeAKeyByDay(dailyActiveNodesSetByDay, DAY_TO_INDEX_YYYY_MM_DD)

/**
 * This function looks a node's lastRunningTimestampMs to see if it
 * has been active recently. Using this and the node's other metadata,
 * this function indexes active nodes by specId, region, os, etc.
 * @param nodeJson
 */
export const indexSingleNodeReport = async (nodeJson: NodeJson): Promise<void> => {
  // if node is active, save to active node sets
  if (nodeJson.lastRunningTimestampMs == null) {
    return
  }
  if (nodeJson.lastRunningTimestampMs >= dailyActiveThreshold) {
    await impactDashRedisClient.addToSet(dailyActiveNodesSet, nodeJson.nodeId)
    await impactDashRedisClient.addToSet(dailyActiveNodesByDayKey, nodeJson.nodeId)
  }
  if (nodeJson.lastRunningTimestampMs >= weeklyActiveThreshold) {
    await impactDashRedisClient.addToSet(weeklyActiveNodesSet, nodeJson.nodeId)
  }
  if (nodeJson.lastRunningTimestampMs >= monthlyActiveThreshold) {
    await impactDashRedisClient.addToSet(monthlyActiveNodesSet, nodeJson.nodeId)
  }
}

export interface activeNodesIndex {
  count: number
  specId: Record<string, number>
  country: Record<string, number>
  [key: string]: unknown // redis req
}

const dailyActiveNodesIndex: activeNodesIndex = {
  count: 0,
  specId: {},
  country: {}
}
const weeklyActiveNodesIndex: activeNodesIndex = {
  count: 0,
  specId: {},
  country: {}
}
const monthlyActiveNodesIndex: activeNodesIndex = {
  count: 0,
  specId: {},
  country: {}
}

const processNode = async (
  nodeIdStrOrNum: string | number,
  setKey: typeof dailyActiveNodesSet | typeof weeklyActiveNodesSet | typeof monthlyActiveNodesSet
): Promise<void> => {
  const nodeId = nodeIdStrOrNum as string
  const node: NodeJson = await impactDashRedisClient.client.json.get(`${nodePrefix}${nodeId}`, '$')

  let indexToUpdate
  if (setKey === dailyActiveNodesSet) {
    if (node.lastRunningTimestampMs == null || node.lastRunningTimestampMs < dailyActiveThreshold) {
      await impactDashRedisClient.removeFromSet(dailyActiveNodesSet, nodeId)
    } else {
      // node was detected running that day, update indexing data
      indexToUpdate = dailyActiveNodesIndex
    }
  } else if (setKey === weeklyActiveNodesSet) {
    if (node.lastRunningTimestampMs == null || node.lastRunningTimestampMs < weeklyActiveThreshold) {
      await impactDashRedisClient.removeFromSet(weeklyActiveNodesSet, nodeId)
    } else {
      // node was detected running that week, update indexing data
      indexToUpdate = weeklyActiveNodesIndex
    }
  } else if (setKey === monthlyActiveNodesSet) {
    if (node.lastRunningTimestampMs == null || node.lastRunningTimestampMs < monthlyActiveThreshold) {
      await impactDashRedisClient.removeFromSet(monthlyActiveNodesSet, nodeId)
    } else {
      // node was detected running that month, update indexing data
      indexToUpdate = monthlyActiveNodesIndex
    }
  }

  // if undefined, setKey is not an expected value
  if (indexToUpdate !== undefined) {
    indexToUpdate.count++
    if (indexToUpdate.specId[node.specId] === undefined) {
      indexToUpdate.specId[node.specId] = 0
    } else {
      indexToUpdate.specId[node.specId]++
    }
    if (indexToUpdate.country[node.country] === undefined) {
      indexToUpdate.country[node.country] = 0
    } else {
      indexToUpdate.country[node.country]++
    }
  }
}

// country, specId
export const indexActiveNodeSets = async (): Promise<void> => {
  // clean active sets - iterate daily, weekly, monthly sets
  await iterateSet(impactDashRedisClient, monthlyActiveNodesSet, processNode)

  // save indexed data
  await impactDashRedisClient.client.json.set(makeAKeyByDay(dailyActiveNodesByDay, DAY_TO_INDEX_YYYY_MM_DD), '$', dailyActiveNodesIndex)
  await impactDashRedisClient.client.json.set(makeAKeyByDay(weeklyActiveNodesByDay, DAY_TO_INDEX_YYYY_MM_DD), '$', weeklyActiveNodesIndex)
  await impactDashRedisClient.client.json.set(makeAKeyByDay(monthlyActiveNodesByDay, DAY_TO_INDEX_YYYY_MM_DD), '$', monthlyActiveNodesIndex)

  // for each node
  //  if not active "enough", remove from set
  //  else
  //      bump count for set
  //      bump count for region, type, etc.

  // once done with all nodes
  // store count of each set byDay
  // store count of each region, type, etc. byDay
}

// todo: retro fill in active nodes
