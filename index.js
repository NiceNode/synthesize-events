const fetch = require('node-fetch')
const ndjson = require('ndjson')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const username = process.env.MP_SA_USERNAME
const secret = process.env.MP_SA_SECRET

// API docs: https://developer.mixpanel.com/reference/raw-event-export
const baseUrl = 'https://data-eu.mixpanel.com/api/2.0/export'

// yyyy-mm-dd (no later than today)
const project_id = process.env.MP_PROJECT_ID
// const from_date = '2023-01-01';
const from_date = '2023-11-21'
const to_date = '2023-11-27'
let queryParams = `?project_id=${project_id}&from_date=${from_date}&to_date=${to_date}`
const fullUrl = baseUrl + queryParams

// const events = ["DailyUserReport"];
const events = ['OpenApp']

if (events) {
  // Convert the array to a JSON string
  const jsonString = JSON.stringify(events)

  // URL encode the JSON string
  const encodedJson = encodeURIComponent(jsonString)
  console.log(`Only fetching ${events} events`)
  queryParams = `${queryParams}&event=${encodedJson}`
}

console.log(`queryParams: ${queryParams}`)

const options = {
  method: 'GET',
  headers: {
    accept: 'text/plain',
    authorization:
      'Basic ' + Buffer.from(username + ':' + secret).toString('base64'),
  },
}

// {
//     event: 'OpenAddNodeModal',
//     properties: {
//       time: 1698461843,
//       distinct_id: '85d1886b-f20f-42ed-8cbb-e315e240523a',
//       '$browser': 'Chrome',
//       '$browser_version': 114,
//       '$city': 'Frankfurt am Main',
//       '$current_url': 'file:///opt/NiceNode/resources/app.asar/dist/renderer/index.html',
//       '$device_id': '18b74119ca9369-0447663868ce9b-433510f-142120-18b74119ca9369',
//       '$initial_referrer': '$direct',
//       '$initial_referring_domain': '$direct',
//       '$insert_id': 'g66tr2iytclgiqfp',
//       '$lib_version': '2.47.0',
//       '$mp_api_endpoint': 'api-js.mixpanel.com',
//       '$mp_api_timestamp_ms': 1698461844355,
//       '$os': 'Linux',
//       '$region': 'Hesse',
//       '$screen_height': 850,
//       '$screen_width': 1552,
//       '$user_id': '85d1886b-f20f-42ed-8cbb-e315e240523a',
//       context: {
//         arch: 'x64',
//         freeMemory: 132595785728,
//         niceNodeVersion: '4.5.1-alpha',
//         platform: 'linux',
//         platformRelease: '5.15.0-84-generic',
//         totalMemory: 134952845312
//       },
//       mp_country_code: 'DE',
//       mp_lib: 'web',
//       mp_processing_time_ms: 1698461844591,
//       mp_sent_by_lib_version: '2.47.0'
//     }
//   }

// {
//     event: 'DailyUserReport',
//     properties: {
//       time: 1698429141,
//       distinct_id: 'baee494c-5839-4152-8aa1-7c3067aa83a9',
//       '$browser': 'Chrome',
//       '$browser_version': 114,
//       '$city': 'Dublin',
//       '$current_url': 'file:///Applications/NiceNode.app/Contents/Resources/app.asar/dist/renderer/index.html',
//       '$device_id': '18b16635f2624b-08e8e63f12532c-f272d57-1d73c0-18b16635f2624b',
//       '$initial_referrer': '$direct',
//       '$initial_referring_domain': '$direct',
//       '$insert_id': 'nclivhxst2at47j4',
//       '$lib_version': '2.47.0',
//       '$mp_api_endpoint': 'api-js.mixpanel.com',
//       '$mp_api_timestamp_ms': 1698429142148,
//       '$os': 'Mac OS X',
//       '$region': 'California',
//       '$screen_height': 1117,
//       '$screen_width': 1728,
//       '$user_id': 'baee494c-5839-4152-8aa1-7c3067aa83a9',
//       context: {
//         arch: 'arm64',
//         freeMemory: 91013120,
//         niceNodeVersion: '4.5.0-alpha',
//         platform: 'darwin',
//         platformRelease: '23.0.0',
//         totalMemory: 17179869184
//       },
//       eventData: {
//         '20798359-66c4-4259-9d67-f8845847a153': [Object],
//         'c713eedb-318f-4074-bd60-273f00538c57': [Object]
//       },
//       mp_country_code: 'US',
//       mp_lib: 'web',
//       mp_processing_time_ms: 1698429142875,
//       mp_sent_by_lib_version: '2.47.0'
//     }
//   }

// nodeid: {
//      maxDiskUsage:
//      reports:
// }
const allNodes = {}
let ethereumNodeCount = 0
let farcasterNodeCount = 0
let otherNodeCount = 0

const calcNodeDiskUsage = (node) => {
  if (node?.nodes) {
    const diskUsedForServicesArray = Object.values(node.nodes).map(
      (service) => service.diskUsedGBs,
    )
    console.log('diskUsedForServicesArray: ', diskUsedForServicesArray)
    return diskUsedForServicesArray.reduce((partialSum, diskUsed) => {
      return partialSum + diskUsed ?? 0
    })
  } else {
    return 0
  }
}

// console.log('test calcNodeDiskUsage: ', calcNodeDiskUsage({nodes: { '1': { diskUsedGBs: 5.6, idk: 'what' }, '123': { diskUsedGBs: 10.6 }}}))

const parseDailyReportEventData = (eventData, otherData) => {
  Object.keys(eventData).map((nodeId) => {
    const nodePackage = eventData[nodeId]
    if (!allNodes[nodeId]) {
      allNodes[nodeId] = {
        reports: 0,
        maxDiskUsage: 0,
        type: nodePackage.specId,
        region: otherData.$region,
        os: otherData.$os,
      }

      // first time seeing this node, do first time things
      if (nodePackage.specId == 'ethereum') {
        ethereumNodeCount++
      } else if (nodePackage.specId == 'farcaster') {
        farcasterNodeCount++
      } else {
        otherNodeCount++
      }
    }
    allNodes[nodeId].reports = allNodes[nodeId].reports + 1
    const reportedDiskUsage = calcNodeDiskUsage(nodePackage)
    if (allNodes[nodeId].maxDiskUsage !== undefined) {
      if (reportedDiskUsage > allNodes[nodeId].maxDiskUsage) {
        allNodes[nodeId].maxDiskUsage = reportedDiskUsage
      }
    } else {
      allNodes[nodeId].maxDiskUsage = reportedDiskUsage
    }
  })
}

// userId: openCount
const userOpenApps = {}

const parseOpenAppEventData = (eventData, otherData) => {
  const user_id = otherData.$user_id
  if (!userOpenApps[user_id]) {
    userOpenApps[user_id] = {
      openAppCount: 0,
      region: otherData.$region,
      os: otherData.$os,
    }
  }
  userOpenApps[user_id].openAppCount = userOpenApps[user_id].openAppCount + 1
}

const printResults = () => {
  console.log(
    `num of distinct user that opened app at least once.... userOpenApps: ${Object.keys(userOpenApps).length}`,
  )
  console.log('userOpenApps: ', userOpenApps)

  // console.log(`node counts.... ethereum: ${ethereumNodeCount}, farcaster: ${farcasterNodeCount}, other: ${otherNodeCount},`)
  // console.log(`allNodes: `, allNodes)
}

// Function to convert JSON to CSV
function jsonToCSV(jsonData) {
  const rows = []

  // Common headers
  const headers = [
    'event',
    'datetime',
    'distinct_id',
    'user_id',
    'nice_node_version',
    'city',
    'region',
    'os',
    'arch',
    'platform_release',
    'device_id',
    'time',
    'event_data',
  ]

  rows.push(headers.join(','))

  // Extract rows
  jsonData.forEach((obj) => {
    const values = headers.map((header) => {
      if (header === 'event') {
        return JSON.stringify(obj.event, replacer)
      }
      const props = obj.properties
      if (props[header]) {
        return JSON.stringify(props[header], replacer)
      }
      if (props[`$${header}`]) {
        return JSON.stringify(props[`$${header}`], replacer)
      }
      if (header === 'event_data') {
        if (obj.event === 'DailyUserReport') {
          parseDailyReportEventData(props.eventData, props)
        } else if (obj.event === 'OpenApp') {
          parseOpenAppEventData(props.eventData, props)
        }
        return removeCommas(JSON.stringify(props.eventData, replacer))
      }
      if (header === 'nice_node_version') {
        return JSON.stringify(props?.context?.niceNodeVersion, replacer)
      }
      if (header === 'platform_release') {
        return JSON.stringify(props?.context?.platformRelease, replacer)
      }
      if (header === 'arch') {
        return JSON.stringify(props?.context?.arch, replacer)
      }
      if (header === 'datetime') {
        const date = new Date(props?.time * 1000)
        return JSON.stringify(date.toISOString(), replacer)
      }
    })
    rows.push(values.join(','))
  })

  return rows.join('\n')
}

const removeCommas = (str) => {
  if (str?.replace) {
    return str.replace(/,/g, '..')
  }
  return str
}
// Custom replacer function - you can modify this as per your requirements
function replacer(key, value) {
  return value === null ? '' : value
}

const mpObjects = []

const writeDateToCSV = () => {
  // Convert JSON to CSV
  const csvData = jsonToCSV(mpObjects)

  // Path where the CSV file will be saved
  const filePath = path.join(__dirname, `data-${Date.now()}.csv`)

  // Write CSV to a file
  fs.writeFile(filePath, csvData, (err) => {
    if (err) throw err
    console.log('CSV file has been saved.')
  })
}

const getData = async () => {
  try {
    const res = await fetch(fullUrl, options)
    const body = await res.text()

    // console.log(body)
    // const resJson = JSON.parse(body);
    // console.log(resJson)

    // Create a stream from the string
    const stream = ndjson.parse()

    let objCount = 0
    // Handling each parsed object
    stream.on('data', (obj) => {
      // Mp's event param doesn't seem to work, so
      // we filter only for the objects we want here
      if (events.includes(obj.event)) {
        mpObjects.push(obj)
        objCount++
      }
    })

    // Handling any errors
    stream.on('error', (error) => {
      console.error('Error parsing JSONL:', error)
    })

    // Handling the end of the stream
    stream.on('end', () => {
      console.log('Finished parsing all JSONL objects.')
      console.log('obj count: ', objCount)

      writeDateToCSV()
      printResults()
    })

    // Write the JSONL string to the stream
    stream.end(body)
  } catch (err) {
    console.error('error:' + err)
  }
}

getData()
