import { dailyActiveNodesSet, monthlyActiveNodesSet, weeklyActiveNodesSet, type NodeJson, nodePrefix } from './redisTypes'
import { impactDashRedisClient, iterateSet } from './RedisClient'

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
  if (nodeJson.lastRunningTimestampMs > dailyActiveThreshold) {
    await impactDashRedisClient.addToSet(dailyActiveNodesSet, nodeJson.nodeId)
  }
  if (nodeJson.lastRunningTimestampMs > weeklyActiveThreshold) {
    await impactDashRedisClient.addToSet(weeklyActiveNodesSet, nodeJson.nodeId)
  }
  if (nodeJson.lastRunningTimestampMs > monthlyActiveThreshold) {
    await impactDashRedisClient.addToSet(monthlyActiveNodesSet, nodeJson.nodeId)
  }
}

const processNode = async (nodeIdStrOrNum: string | number): Promise<void> => {
  const nodeId = nodeIdStrOrNum as string
  const node: NodeJson = await impactDashRedisClient.client.json.get(`${nodePrefix}${nodeId}`, '$')
  if (node.lastRunningTimestampMs == null) {
    // remove from all sets
  }
  if (node.lastRunningTimestampMs > dailyActiveThreshold) {
    await impactDashRedisClient.addToSet(dailyActiveNodesSet, nodeJson.nodeId)
  }
}

// country, specId
export const indexActiveNodeSets = async (): Promise<void> => {
  // iterate daily, weekly, monthly set
  await iterateSet(impactDashRedisClient, monthlyActiveNodesSet, processNode)

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
