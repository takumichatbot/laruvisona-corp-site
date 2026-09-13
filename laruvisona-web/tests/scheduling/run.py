#!/usr/bin/env python3
"""Disposable local PostgreSQL only. SQL regression + actual parallel reservations.
--serve keeps this fresh DB alive and exposes a narrowly scoped PostgREST-compatible test adapter.
No existing DB, Supabase project, email provider or customer data is used.
"""
import concurrent.futures, datetime, json, os, pathlib, shutil, subprocess, tempfile, uuid, sys, signal
def stop(*args):raise KeyboardInterrupt
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
ROOT=pathlib.Path(__file__).resolve().parents[2]
PG=os.environ.get('PG_BIN','')
def binary(name):return str(pathlib.Path(PG)/name) if PG else shutil.which(name)
WORK=pathlib.Path(tempfile.mkdtemp(prefix='hp-scheduling-'))
SITE='11111111-1111-4111-8111-111111111111'; OTHER='22222222-2222-4222-8222-222222222222'
OWNER='7c9e6679-7425-40de-944b-e07fc1f90ae7'; STRANGER='44444444-4444-4444-8444-444444444444'
DAY=(datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))+datetime.timedelta(days=3)).date().isoformat()
C={'enabled':True,'weekly':[[{'start':540,'end':1080}] for _ in range(7)],'daysOff':[],
 'staff':[{'id':i,'name':name,'weekly':[[{'start':540,'end':1080}] for _ in range(7)],'daysOff':[]} for i,name in [('p1','担当者 青木'),('p2','担当者 田中')]],
 'resources':[{'id':'r1','name':'相談室1'}],
 'services':[{'id':'s1','name':'初回相談','duration':60,'buffer':15,'price':5000,'staffIds':['p1','p2'],'resourceIds':['r1']}],
 'step':15,'leadMinutes':0,'advanceDays':60,'cancelHours':24}
def lit(v):
 if v is None:return 'null'
 if isinstance(v,(dict,list)):v=json.dumps(v,ensure_ascii=False)
 return "'"+str(v).replace("'","''")+"'"
def sql(q,ok=True):
 p=subprocess.run([binary('psql'),'-X','-h',str(WORK),'-d','postgres','-v','ON_ERROR_STOP=1','-Atq','-c',q],capture_output=True,text=True)
 if ok and p.returncode:raise AssertionError(p.stderr+'\n'+q[:180])
 return p.stdout.strip() if ok else p
count=0
def check(name,condition):
 global count
 if not condition:raise AssertionError(name)
 count+=1;print('OK',name,flush=True)
def configure(config,version=1,who=OWNER,site=SITE,ok=True):return sql(f'select hp_schedule_configure({lit(site)},{lit(who)},{lit(config)}::jsonb,{version});',ok)
def book(hour='10:00',staff='p1',key=None,token='a'*64,site=SITE,ok=True):
 b={'configVersion':int(sql(f"select version from hp_booking_calendars where site_id={lit(site)}") or '1'),'clientKey':key or str(uuid.uuid4()),'name':'検証 来店者','email':'guest@example.invalid','phone':'','serviceId':'s1','staffId':staff,'startsAt':DAY+'T'+hour+':00+09:00'}
 return sql(f'select hp_schedule_book({lit(site)},{lit(b)}::jsonb,{lit(token)},{lit("b"*64)});',ok)
def change(a,action='cancel',start=None,staff=None,token='a'*64,owner=None,revision=None,ok=True):
 return sql(f'select hp_schedule_change({lit(SITE)},{lit(a["id"])},{lit(token)},{lit(owner)},{lit(action)},{lit(start)},{lit(staff)},{revision or a["revision"]});',ok)
def reset():
 sql('truncate hp_booking_events,hp_booking_allocations,hp_appointments,hp_booking_calendars cascade;')
 configure(C,0)
def run():
 global count
 check('受付設定の保存',json.loads(configure(C,0))['version']==1)
 check('別の所有者は設定を書けない','not_found' in configure(C,1,STRANGER,ok=False).stderr)
 check('設定の古い版は書けない','config_conflict' in configure(C,0,ok=False).stderr)
 key=str(uuid.uuid4());a=json.loads(book(key=key))
 check('確定時の時間・価格はDB設定から',a['price']==5000 and a['resource_id']=='r1' and a['status']=='confirmed')
 check('同じ送信の再試行は同じ予約',json.loads(book(key=key))['id']==a['id'])
 check('別の確認鍵で再送しても個人情報を返さない','request_conflict' in book(key=key,token='c'*64,ok=False).stderr)
 check('同じ担当者の時間の重なりを拒否','slot_taken' in book('10:30',ok=False).stderr)
 check('別担当者でも同じ設備の重なりを拒否','slot_taken' in book('10:00','p2',ok=False).stderr)
 check('準備時間も占有する','slot_taken' in book('11:00','p2',ok=False).stderr)
 check('準備が終わる境界で予約できる',json.loads(book('11:15','p2'))['status']=='confirmed')
 check('誤った鍵では予約を読めない','not_found' in change(a,'lookup',token='c'*64,ok=False).stderr)
 check('別サイトのIDへ変更できない','not_found' in sql(f"select hp_schedule_change('{OTHER}','{a['id']}','{'a'*64}',null,'lookup',null,null,null)",False).stderr)
 check('閉店をはみ出す枠はない','slot_taken' in book('17:00',ok=False).stderr)
 check('変更先が埋まっていると失敗','slot_taken' in change(a,'reschedule',DAY+'T11:15:00+09:00','p2',ok=False).stderr)
 check('変更失敗でも元の予約を保持',json.loads(change(a,'lookup'))['starts_at']==a['starts_at'])
 moved=json.loads(change(a,'reschedule',DAY+'T13:00:00+09:00','p2'))
 check('担当者変更と日時変更は同時に確定',moved['staff_id']=='p2' and moved['revision']==2)
 check('旧版からのキャンセルを拒否','booking_conflict' in change(a,ok=False).stderr)
 check('元の時間を解放',json.loads(book('10:00'))['status']=='confirmed')
 change(moved)
 check('キャンセルで設備と担当者を解放',json.loads(book('13:00','p1'))['status']=='confirmed')
 cc=json.loads(json.dumps(C));cc['staff']=cc['staff'][1:]
 check('未来の予約がある担当者は削除不可','assigned_in_use' in configure(cc,ok=False).stderr)
 cc=json.loads(json.dumps(C));cc['enabled']=False;configure(cc)
 check('受付停止で新規だけ止まる','slot_taken' in book('15:00',ok=False).stderr)
 check('新予約が残る間は受付停止でも旧方式の割り込みを拒否','schedule_enabled' in sql(f"insert into hp_reservations(site_id,slot_id,slot_datetime,name,email,status) values('{SITE}','old','{DAY}T10:00:00+09:00','test','t@example.invalid','confirmed')",False).stderr)
 check('受付停止でも既存の確認はできる',json.loads(change(moved,'lookup'))['status']=='canceled')
 reset();cc=json.loads(json.dumps(C));cc['daysOff']=[DAY];configure(cc)
 check('休業日に予約できない','slot_taken' in book(ok=False).stderr)
 reset();cc=json.loads(json.dumps(C));cc['staff'][0]['daysOff']=[DAY];configure(cc)
 check('担当者の休日に予約できない','slot_taken' in book(ok=False).stderr)
 check('指名なしは空いている担当者へ',json.loads(book(staff=''))['staff_id']=='p2')
 reset();cc=json.loads(json.dumps(C));cc['weekly']=[[{'start':540,'end':720},{'start':780,'end':1080}] for _ in range(7)];configure(cc)
 check('昼休みを跨ぐ予約を拒否','slot_taken' in book('11:00',ok=False).stderr)
 reset()
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: responses=list(pool.map(lambda _:book(ok=False),range(12)))
 check('12接続の同時予約は1件だけ確定',sum(p.returncode==0 for p in responses)==1)
 check('同時予約の割当は担当者・設備の2件',sql('select count(*) from hp_booking_allocations')=='2')
 sql("insert into hp_appointments select (jsonb_populate_record(null::hp_appointments,to_jsonb(a)||jsonb_build_object('id','55555555-5555-4555-8555-555555555555','client_key',gen_random_uuid()))).* from hp_appointments a limit 1")
 check('DB排他制約も独立に拒否','exclusion constraint' in sql("insert into hp_booking_allocations select site_id,'55555555-5555-4555-8555-555555555555','staff',unit_id,span from hp_booking_allocations where kind='staff'",False).stderr)
 reset();cc=json.loads(json.dumps(C));cc['resources'].append({'id':'r2','name':'相談室2'});cc['services'][0]['resourceIds'].append('r2');configure(cc)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: responses=list(pool.map(lambda p:book(staff=p,ok=False),['p1','p2']))
 check('担当者と設備が別なら同時刻に2件',all(p.returncode==0 for p in responses))
 check('匿名は予約テーブルを読めない',sql('set role anon;select * from hp_appointments',False).returncode!=0)
 check('匿名はRPCを直接呼べない',sql(f"set role anon;select * from hp_schedule_slots('{SITE}','{DAY}','s1')",False).returncode!=0)
 check('所有者は自分の予約だけ読める',sql(f'''set role authenticated;set request.jwt.claims='{json.dumps({'sub':OWNER})}';select count(*) from hp_appointments''')=='2')
 check('他の利用者は公開店舗でも予約を読めない',sql(f'''set role authenticated;set request.jwt.claims='{json.dumps({'sub':STRANGER})}';select count(*) from hp_appointments''')=='0')
 check('所有者も直接変更不可',sql(f"set role authenticated;update hp_appointments set status='canceled'",False).returncode!=0)
 check('旧固定枠から本格予約へ割り込めない','schedule_enabled' in sql(f"insert into hp_reservations(site_id,slot_id,slot_datetime,name,email,status) values('{SITE}','old','{DAY}T10:00:00+09:00','test','t@example.invalid','confirmed')",False).stderr)
 reset();sql('delete from hp_booking_calendars');sql(f"insert into hp_reservations(site_id,slot_id,slot_datetime,name,email,status) values('{SITE}','old','{DAY}T10:00:00+09:00','test','t@example.invalid','confirmed')")
 check('旧予約が残る間は新方式に切り替えない','legacy_active' in configure(C,0,ok=False).stderr)
 sql('delete from hp_reservations');reset()
 # Cutoff test: an existing appointment may be near its start even when creation has a shorter lead time.
 a=json.loads(book());sql(f"update hp_appointments set starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hour',occupied_until=now()+interval '3 hour' where id='{a['id']}'")
 check('利用者は変更締切を過ぎた予約を取り消せない','change_closed' in change(a,ok=False).stderr)
 check('店舗は締切後も取り消せる',json.loads(change(a,owner=OWNER))['status']=='canceled')
 reset()
 b={'clientKey':str(uuid.uuid4()),'configVersion':1,'name':'検証','email':'t@example.invalid','phone':'','serviceId':'s1','staffId':'p1','startsAt':DAY+'T10:00:00+09:00'}
 configure(C,1)
 check('表示後に設定が変わると旧料金のまま予約しない','quote_changed' in sql(f"select hp_schedule_book('{SITE}',{lit(b)},'{('a'*64)}','{('b'*64)}')",False).stderr)
 b['configVersion']=2;b['startsAt']='2000-01-01T10:00:00+09:00'
 check('過去の時刻を直接POSTしても予約不可','slot_taken' in sql(f"select hp_schedule_book('{SITE}',{lit(b)},'{('a'*64)}','{('b'*64)}')",False).stderr)
 b['startsAt']=(datetime.date.fromisoformat(DAY)+datetime.timedelta(days=181)).isoformat()+'T10:00:00+09:00'
 check('受付期間より先の日付を直接POSTしても予約不可','slot_taken' in sql(f"select hp_schedule_book('{SITE}',{lit(b)},'{('a'*64)}','{('b'*64)}')",False).stderr)
 reset();print(f'{count}/{count} SQL checks passed',flush=True)
try:
 subprocess.run([binary('initdb'),'-D',str(WORK/'data'),'--auth=trust'],stdout=subprocess.DEVNULL,check=True)
 subprocess.run([binary('pg_ctl'),'-D',str(WORK/'data'),'-o',f"-k {WORK} -h ''",'-l',str(WORK/'postgres.log'),'-w','start'],stdout=subprocess.DEVNULL,check=True)
 for f in ['test-bootstrap.sql','schema.sql','sites_data_column.sql','hp_reservations.sql','hp_scheduling.sql']:
  subprocess.run([binary('psql'),'-X','-h',str(WORK),'-d','postgres','-v','ON_ERROR_STOP=1','-q','-f',str(ROOT/'supabase'/f)],check=True,stdout=subprocess.DEVNULL)
 sql(f"insert into auth.users(id) values('{OWNER}'),('{STRANGER}');insert into sites(id,user_id,name,slug,published) values('{SITE}','{OWNER}','相談室 まどか','予約テスト',true),('{OTHER}','{STRANGER}','別の店舗','other-site',true)")
 run()
 if '--serve' in sys.argv:
  import importlib.util
  spec=importlib.util.spec_from_file_location('bridge',ROOT/'tests/scheduling/bridge.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.serve(sql,lit,SITE,OWNER,DAY)
finally:
 subprocess.run([binary('pg_ctl'),'-D',str(WORK/'data'),'-m','immediate','stop'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 shutil.rmtree(WORK)
