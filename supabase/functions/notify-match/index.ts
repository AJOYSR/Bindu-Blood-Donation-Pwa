import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try{
    const auth=req.headers.get('Authorization')
    if(!auth) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}})
    const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
    const {data:{user},error:userError}=await supabase.auth.getUser()
    if(userError||!user) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}})
    const {requestId}=await req.json()
    if(!requestId) return new Response(JSON.stringify({error:'requestId is required'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}})
    const {data:request,error}=await supabase.from('blood_requests').select('id,blood_group,district,status').eq('id',requestId).single()
    if(error||!request||!['open','matched'].includes(request.status)) return new Response(JSON.stringify({error:'Request not available'}),{status:404,headers:{...corsHeaders,'Content-Type':'application/json'}})
    // Delivery is delegated to a provider adapter. Do not include names, notes, phone numbers, or exact addresses.
    return new Response(JSON.stringify({accepted:true,requestId:request.id,matchingScope:{bloodGroup:request.blood_group,district:request.district}}),{status:202,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}})
  }catch{return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}})}
})
