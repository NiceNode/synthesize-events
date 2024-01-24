/* eslint-disable @typescript-eslint/indent */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/naming-convention */
import ndjson from 'ndjson'

const username = process.env.MP_SA_USERNAME
const secret = process.env.MP_SA_SECRET
const project_id = process.env.MP_PROJECT_ID

// Replace these with your Upstash Redis connection details
if (username == null || secret == null || project_id == null) {
  throw new Error('env vars MP_... not set')
}

// API docs: https://developer.mixpanel.com/reference/raw-event-export
const baseUrl = 'https://data-eu.mixpanel.com/api/2.0/export'

// yyyy-mm-dd (no later than today)
// const from_date = '2023-01-01';
// const from_date = '2023-11-25'
// const to_date = '2023-11-27'
const from_date = '2023-11-01'
const to_date = '2024-01-01'
const queryParams = `?project_id=${project_id}&from_date=${from_date}&to_date=${to_date}`
const fullUrl = baseUrl + queryParams

// const events = ["DailyUserReport"];
// const events = ['OpenApp']

// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
// if (events) {
//   // Convert the array to a JSON string
//   const jsonString = JSON.stringify(events)

//   // URL encode the JSON string
//   const encodedJson = encodeURIComponent(jsonString)
//   // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
//   console.log(`Only fetching ${events} events`)
//   queryParams = `${queryParams}&event=${encodedJson}`
// }

console.log(`queryParams: ${queryParams}`)

const options = {
  method: 'GET',
  headers: {
    accept: 'text/plain',
    authorization:
      'Basic ' + Buffer.from(username + ':' + secret).toString('base64'),
  },
}

export interface NiceNodeContext {
  arch: string
  freeMemory: number
  niceNodeVersion: string
  platform: 'win32' | 'macOS' | 'linux'
  platformRelease: string
  totalMemory: number
}
/**
 * Mixpanel docs https://docs.mixpanel.com/docs/data-structure/property-reference#event-properties-1
 */
export interface MixpanelEvent {
  event:
    | 'OpenApp'
    | 'AddNodePackage'
    | 'DailyUserReport'
    | 'UserCheckForUpdateNN'
    | 'ErrorInstallPodman'
    | '$mp_web_page_view'
    | string
  properties: {
    /**
     * unique event identifier
     * More https://docs.mixpanel.com/docs/data-structure/property-reference#event-properties-1
     */
    $insert_id: string
    /**
     * utc timestamp in seconds
     */
    time: number
    /**
     * same as $user_id, distinct user id set by NN
     */
    distinct_id: string
    $city: string
    $region: string
    $os: string
    mp_country_code: string
    /**
     * set by mixpanel
     */
    $device_id: string
    /**
     * same as distinct_id, distinct user id set by NN
     */
    $user_id: string
    context?: NiceNodeContext
    eventData?: any
    [key: string]: any
  }
}

export const processData = async (
  onReceiveEvent: (mixPanelEvent: MixpanelEvent) => Promise<void>,
): Promise<void> => {
  try {
    const res = await fetch(fullUrl, options)
    const body = await res.text()

    // Create a stream from the string
    const stream = ndjson.parse()

    let objCount = 0
    // Handling each parsed object
    stream.on('data', (obj) => {
      // Mp's event param doesn't seem to work, so
      // we filter only for the objects we want here
      //   if (events.includes(obj.event)) {
      void onReceiveEvent(obj)
      objCount++
    })

    // Handling any errors
    stream.on('error', (error) => {
      console.error('Error parsing JSONL:', error)
    })

    // Handling the end of the stream
    stream.on('end', () => {
      console.log('Finished parsing all JSONL objects.')
      console.log('obj count: ', objCount)
    })

    // Write the JSONL string to the stream
    stream.end(body)
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    console.error('error:' + err)
  }
}
