const key=import.meta.env.VITE_POSTHOG_KEY
const host=import.meta.env.VITE_POSTHOG_HOST||'https://us.i.posthog.com'

const allowedEvents=new Set(['signup_started','signup_completed','donor_profile_completed','donor_search_performed','request_created','request_response_started','request_response_completed','notification_permission_granted','pwa_installed'])

export function track(event:string,properties:Record<string,string|number|boolean>={}){
  if(!key||!allowedEvents.has(event)) return
  const safeProperties=Object.fromEntries(Object.entries(properties).filter(([name])=>!/(name|phone|email|address|location|blood|hospital|note|description)/i.test(name)))
  void fetch(`${host}/i/v0/e/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,event,properties:{...safeProperties,distinct_id:'anonymous', $process_person_profile:false}}),keepalive:true})
}
