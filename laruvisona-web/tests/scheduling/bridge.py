"""Local test HTTP adapter; every scheduling query/RPC runs against disposable PostgreSQL.
Not a replacement for Supabase Auth integration testing. Authentication is an explicit fixed fixture.
"""
import json, re, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs

def serve(sql,lit,site,owner,day):
 initial=json.loads(sql(f"select config from hp_booking_calendars where site_id='{site}'"))
 tables={'sites','profiles','hp_booking_calendars','hp_appointments','hp_booking_events','hp_booking_allocations'}
 functions={'hp_schedule_slots','hp_schedule_configure','hp_schedule_book','hp_schedule_change'}
 class Handler(BaseHTTPRequestHandler):
  def log_message(self,*a):pass
  def send(self,value,status=200):
   content=json.dumps(value,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','*');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
  def do_OPTIONS(self):self.send({})
  def do_GET(self):self.handle_request()
  def do_POST(self):self.handle_request()
  def do_PATCH(self):self.handle_request()
  def handle_request(self):
   try:
    u=urlsplit(self.path);q={k:v[0] for k,v in parse_qs(u.query).items()};auth=self.headers.get('Authorization','')
    if u.path=='/__reset' and self.command=='POST':
     sql('truncate hp_booking_events,hp_booking_allocations,hp_appointments cascade;update hp_booking_calendars set config='+lit(initial)+'::jsonb,version=1');return self.send({'ok':True})
    if u.path=='/health':return self.send({'site':site,'owner':owner,'day':day})
    if u.path.startswith('/auth/v1/'):
     if 'stub-access-token' not in auth and 'stub-service' not in auth:return self.send({'error':'Unauthorized'},401)
     return self.send({'id':owner,'email':'owner@example.invalid','aud':'authenticated','role':'authenticated'})
    role='service_role' if 'stub-service' in auth else 'authenticated' if 'stub-access-token' in auth else 'anon'
    # Match production PostgREST: timestamptz JSON uses UTC +00:00, not the Mac's timezone.
    prefix=f"set time zone 'UTC';set role {role};set request.jwt.claims={lit(json.dumps({'sub':owner} if role=='authenticated' else {}))};"
    body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or '{}') if self.command in ('POST','PATCH') else {}
    if '/rpc/' in u.path:
     name=u.path.rsplit('/',1)[1]
     if name not in functions:return self.send({'error':'not found'},404)
     if any(not re.fullmatch(r'p_[a-z_]+',k) for k in body):return self.send({'error':'invalid'},400)
     args=','.join(k+'=>'+lit(v) for k,v in body.items())
     query=f'select coalesce(jsonb_agg(x),\'[]\') from {name}({args}) x' if name=='hp_schedule_slots' else f'select {name}({args})'
    else:
     table=u.path.rsplit('/',1)[1]
     if table not in tables:return self.send([])
     where=[]
     for k,v in q.items():
      if k in ('select','limit','offset','order'):continue
      if not re.fullmatch(r'[a-z_]+',k):return self.send({'error':'invalid'},400)
      op,val=v.split('.',1);symbol={'eq':'=','gte':'>=','gt':'>','lte':'<=','lt':'<','neq':'<>'}.get(op)
      if symbol:where.append(k+symbol+lit(val))
     condition=' where '+' and '.join(where) if where else ''
     if self.command=='PATCH':
      if table!='hp_booking_events':return self.send({'error':'unsupported'},400)
      if any(not re.fullmatch(r'[a-z_]+',k) for k in body):return self.send({'error':'invalid'},400)
      query='with changed as (update '+table+' set '+','.join(k+'='+lit(v if not isinstance(v,bool) else str(v).lower()) for k,v in body.items())+condition+' returning *) select coalesce(jsonb_agg(changed),\'[]\') from changed'
     else:
      selection=q.get('select','*')
      if selection!='*' and not re.fullmatch(r'[a-z_,]+',selection):return self.send({'error':'invalid selection'},400)
      order=''
      if q.get('order'):
       k,_,direction=q['order'].partition('.')
       if re.fullmatch(r'[a-z_]+',k):order=' order by '+k+(' desc' if direction=='desc' else ' asc')
      limit=' limit '+str(min(int(q.get('limit','1000')),1000))
      query='select coalesce(jsonb_agg(x),\'[]\') from (select '+selection+' from '+table+condition+order+limit+') x'
    p=sql(prefix+query,False)
    if p.returncode:
     message=next((x.split('ERROR:',1)[1].strip() for x in p.stderr.splitlines() if 'ERROR:' in x),'db error')
     code='42501' if 'permission denied' in message else '23P01' if 'exclusion constraint' in message else 'P0001'
     return self.send({'code':code,'message':message},400)
    data=json.loads(p.stdout.strip())
    if 'vnd.pgrst.object' in self.headers.get('Accept','') and isinstance(data,list):
     if len(data)!=1:return self.send({'code':'PGRST116','message':'JSON object requested, multiple (or no) rows returned','details':f'The result contains {len(data)} rows'},406)
     data=data[0]
    return self.send(data)
   except Exception as e:self.send({'error':str(e)},500)
 port=int(os.environ.get('SCHEDULE_FIXTURE_PORT','55019'));print(f'Fixture http://127.0.0.1:{port} day={day}',flush=True)
 ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
