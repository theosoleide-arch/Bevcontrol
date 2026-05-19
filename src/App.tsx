import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── TOKENS ──────────────────────────────────────────────────────
const G = {
  gold:"#C9A84C", goldLight:"#E8C96B", blue:"#3B82F6",
  danger:"#EF4444", success:"#10B981", warning:"#F59E0B", muted:"#64748B",
  bg:"#070B16", surface:"#0C1120", card:"rgba(255,255,255,0.03)",
  border:"rgba(255,255,255,0.07)", text:"#F1F5F9", sub:"#94A3B8",
};
const inp = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"11px 14px", color:G.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
const sel = { ...inp, cursor:"pointer" };

// ─── CONSTANTS ───────────────────────────────────────────────────
const CATEGORIES = ["Wine","Beer","Spirits","Cocktails","Non-alcoholic","Cider","Sake"];
const ALCOHOL_TYPES = { Wine:["Red wine","White wine","Rosé","Sparkling","Dessert wine"], Beer:["Lager","IPA","Stout","Pale Ale","Wheat","Pilsner"], Spirits:["Vodka","Gin","Whiskey","Rum","Tequila","Cognac","Aquavit"], Cocktails:["Classic cocktail","Signature","Frozen","Mocktail"], "Non-alcoholic":["Juice","Soft drink","Water","Energy drink"], Cider:["Dry cider","Sweet cider","Fruit cider"], Sake:["Junmai","Ginjo","Daiginjo"] };
const PRESET_PACKAGING = [{ name:"Single bottle",units:1,vol:750 },{ name:"Case of 6",units:6,vol:750 },{ name:"Case of 12",units:12,vol:750 },{ name:"Case of 24",units:24,vol:330 },{ name:"20L keg",units:1,vol:20000 },{ name:"30L keg",units:1,vol:30000 }];
const PRESET_SERVINGS = [{ name:"Wine glass",ml:150 },{ name:"Large wine glass",ml:200 },{ name:"Shot",ml:40 },{ name:"Double shot",ml:80 },{ name:"Pint",ml:568 },{ name:"Half pint",ml:284 },{ name:"Cocktail glass",ml:120 },{ name:"Highball",ml:300 }];
const WIZARD_STEPS = [{ id:1,label:"Product",icon:"◎" },{ id:2,label:"Packaging",icon:"◫" },{ id:3,label:"Serving",icon:"▦" },{ id:4,label:"Financial",icon:"◈" },{ id:5,label:"Behavior",icon:"✦" }];

// ─── HELPERS ─────────────────────────────────────────────────────
function uid() { return "x"+Date.now()+Math.random().toString(36).slice(2,5); }
function fmtMl(ml){ return ml>=1000?`${+(ml/1000).toFixed(1)}L`:`${ml}ml`; }
function fmt(n,d=0){ return Number(n).toLocaleString("nb-NO",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function calcFinancials(pkg,srv,fin){
  const totalMl=(pkg.units||0)*(pkg.volPerUnit||0);
  const sml=srv.ml||0;
  const servingsPerPkg=sml>0?totalMl/sml:0;
  const cost=Number(fin.costPerPackage)||0;
  const sale=Number(fin.salePricePerServing)||0;
  const revenue=servingsPerPkg*sale;
  const margin=revenue>0?(revenue-cost)/revenue*100:0;
  return { totalMl, servingsPerPkg, revenue, margin, profit:revenue-cost, servingsPerUnit:pkg.volPerUnit>0&&sml>0?pkg.volPerUnit/sml:0 };
}

// ─── STORAGE ─────────────────────────────────────────────────────
function useStorage(key, fallback){
  const [data,setData]=useState(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{ const r=await window.storage.get(key); setData(r?JSON.parse(r.value):fallback); }
      catch{ setData(fallback); }
      setReady(true);
    })();
  },[key]);
  const save=useCallback(async(next)=>{ setData(next); try{ await window.storage.set(key,JSON.stringify(next)); }catch{} },[key]);
  return [data??fallback, save, ready];
}

// ─── UI ATOMS ────────────────────────────────────────────────────
function Badge({ children, color="gold" }){
  const c={gold:["#C9A84C18","#C9A84C","#C9A84C33"],green:["#10B98118","#10B981","#10B98133"],red:["#EF444418","#EF4444","#EF444433"],blue:["#3B82F618","#3B82F6","#3B82F633"],gray:["rgba(255,255,255,0.06)","#94A3B8","rgba(255,255,255,0.1)"]}[color]||["#C9A84C18","#C9A84C","#C9A84C33"];
  return <span style={{background:c[0],color:c[1],border:`1px solid ${c[2]}`,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>{children}</span>;
}
function KPICard({ label,value,sub,accent }){
  return(
    <div style={{background:accent?`${G.gold}0E`:"rgba(255,255,255,0.03)",border:`1px solid ${accent?G.gold+"2A":G.border}`,borderRadius:12,padding:"18px 20px"}}>
      <div style={{fontSize:11,color:G.muted,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
      <div style={{fontSize:24,fontWeight:700,color:accent?G.gold:G.text,marginBottom:sub?2:0}}>{value||"—"}</div>
      {sub&&<div style={{fontSize:12,color:G.muted}}>{sub}</div>}
    </div>
  );
}
function Toggle({ label,desc,value,onChange }){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 0",borderBottom:`1px solid ${G.border}`}}>
      <div><div style={{fontSize:14,fontWeight:500,marginBottom:2}}>{label}</div>{desc&&<div style={{fontSize:12,color:G.muted}}>{desc}</div>}</div>
      <div onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:12,background:value?G.gold:"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0,marginLeft:16}}>
        <div style={{position:"absolute",top:3,left:value?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
      </div>
    </div>
  );
}
function Field({ label,hint,children }){
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
        <label style={{fontSize:13,fontWeight:500,color:G.sub}}>{label}</label>
        {hint&&<span style={{fontSize:11,color:G.muted}}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function VolBar({ pct }){
  const c=pct>60?G.success:pct>25?G.warning:G.danger;
  return(
    <div style={{background:"rgba(255,255,255,0.08)",borderRadius:4,height:6,overflow:"hidden",flex:1}}>
      <div style={{background:c,width:`${Math.min(100,pct)}%`,height:"100%",borderRadius:4,transition:"width 0.5s ease"}}/>
    </div>
  );
}
function Modal({ title,onClose,children }){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#0C1120",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:28,width:440,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div style={{fontSize:16,fontWeight:600}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:G.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",label:"Dashboard",icon:"▦"},
  {id:"bottles",label:"Open bottles",icon:"◎"},
  {id:"inventory",label:"Products",icon:"◫"},
  {id:"settings",label:"Settings",icon:"◌"},
];
function Sidebar({ page, setPage, venue, onLogout }){
  return(
    <div style={{width:210,background:G.surface,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",flexShrink:0,height:"100vh",position:"sticky",top:0}}>
      <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#1A1A2E"}}>B</div>
        <span style={{fontWeight:700,fontSize:15,letterSpacing:"-0.02em"}}>BevControl</span>
      </div>
      <div style={{padding:"12px 8px",flex:1}}>
        <div style={{fontSize:10,color:"#475569",fontWeight:600,letterSpacing:"0.08em",padding:"0 10px",marginBottom:8}}>{(venue?.name||"My Venue").toUpperCase()}</div>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",background:page===n.id?`${G.gold}14`:"transparent",border:page===n.id?`1px solid ${G.gold}33`:"1px solid transparent",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:page===n.id?600:400,color:page===n.id?G.gold:G.sub,marginBottom:2,textAlign:"left"}}>
            <span style={{fontSize:14}}>{n.icon}</span>{n.label}
          </button>
        ))}
      </div>
      <div style={{padding:"14px 18px",borderTop:`1px solid ${G.border}`}}>
        <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{venue?.manager||"Manager"}</div>
        <div style={{fontSize:11,color:G.muted,marginBottom:10}}>{venue?.name||"My Venue"}</div>
        <button onClick={onLogout} style={{fontSize:11,color:G.muted,background:"none",border:"none",cursor:"pointer",padding:0}}>← Sign out</button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────
function DashboardPage({ products, openBottles }){
  const totalVolumeMl=products.reduce((s,p)=>s+(p.packaging?.totalVolumeMl||0),0);
  const totalRevEst=products.reduce((s,p)=>s+calcFinancials(p.packaging,p.serving,p.financial).revenue,0);
  const avgMargin=products.length?products.reduce((s,p)=>s+calcFinancials(p.packaging,p.serving,p.financial).margin,0)/products.length:0;
  const alertBottles=openBottles.filter(b=>b.pctRemaining<20||(b.actualMl>b.expectedMl&&b.expectedMl>0));
  const totalLossMl=openBottles.reduce((s,b)=>s+Math.max(0,b.actualMl-(b.expectedMl||0)),0);
  const estLossKr=openBottles.reduce((s,b)=>{
    const p=products.find(x=>x.id===b.productId);
    if(!p||!b.expectedMl||b.actualMl<=b.expectedMl)return s;
    const pricePerMl=(Number(p.financial?.salePricePerServing)||0)/(p.serving?.ml||1);
    return s+Math.max(0,b.actualMl-b.expectedMl)*pricePerMl;
  },0);

  const weekDays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const chartData=weekDays.map((day,i)=>{
    const base=openBottles.length*8+i*12;
    return { day, expected:Math.round(base*(0.9+i*0.03)), actual:Math.round(base*(0.88+i*0.05)) };
  });

  const catMap={};
  products.forEach(p=>{ catMap[p.info?.category]=(catMap[p.info?.category]||0)+1; });
  const pieData=Object.entries(catMap).filter(([k])=>k).map(([name,value])=>({name,value}));
  const PIE_C=[G.gold,G.blue,"#8B5CF6",G.success,G.warning,G.danger];

  return(
    <div style={{padding:32,overflowY:"auto",height:"100vh",boxSizing:"border-box"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>Dashboard</h1>
          <p style={{fontSize:13,color:G.muted,margin:"4px 0 0"}}>Live overview — {new Date().toLocaleDateString("nb-NO",{weekday:"long",day:"numeric",month:"long"})}</p>
        </div>
        <Badge color="green">● Live</Badge>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        <KPICard label="Products catalogued" value={products.length} sub={`${openBottles.length} bottles open`}/>
        <KPICard label="Total inventory volume" value={fmtMl(totalVolumeMl)} sub="Across all products"/>
        <KPICard label="Avg product margin" value={`${avgMargin.toFixed(1)}%`} sub="Based on financials" accent/>
        <KPICard label="Est. revenue potential" value={`kr ${fmt(totalRevEst)}`} sub="Per package cycle"/>
      </div>

      {alertBottles.length>0&&(
        <div style={{background:`${G.danger}12`,border:`1px solid ${G.danger}33`,borderRadius:10,padding:"12px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:G.danger,fontSize:16}}>⚠</span>
          <div style={{flex:1,fontSize:13}}>
            <span style={{color:G.danger,fontWeight:600}}>{alertBottles.length} open bottle{alertBottles.length>1?"s":""} need attention — </span>
            <span style={{color:G.sub}}>{alertBottles.map(b=>b.name).join(", ")}</span>
          </div>
          {estLossKr>0&&<Badge color="red">−kr {fmt(estLossKr,0)} est. loss</Badge>}
        </div>
      )}

      {products.length===0&&openBottles.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",color:G.muted}}>
          <div style={{fontSize:36,marginBottom:12,opacity:0.2}}>▦</div>
          <div style={{fontSize:15,color:G.sub,marginBottom:6}}>Your dashboard is empty</div>
          <div style={{fontSize:13}}>Add products in the Products tab to get started.</div>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,padding:20}}>
              <div style={{fontSize:13,fontWeight:600,color:G.sub,marginBottom:16}}>Weekly consumption — expected vs actual</div>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                {[{c:G.blue,l:"Expected"},{c:G.gold,l:"Actual"}].map(x=>(
                  <span key={x.l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:G.muted}}>
                    <span style={{width:10,height:10,borderRadius:2,background:x.c}}/>
                    {x.l}
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={2}>
                  <XAxis dataKey="day" tick={{fill:G.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:G.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#1E293B",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:G.text,fontSize:12}}/>
                  <Bar dataKey="expected" fill={G.blue} name="Expected" radius={[3,3,0,0]}/>
                  <Bar dataKey="actual" fill={G.gold} name="Actual" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,padding:20}}>
              <div style={{fontSize:13,fontWeight:600,color:G.sub,marginBottom:16}}>Products by category</div>
              {pieData.length>0?(
                <div style={{display:"flex",alignItems:"center",gap:20}}>
                  <PieChart width={130} height={130}>
                    <Pie data={pieData} cx={60} cy={60} innerRadius={36} outerRadius={58} dataKey="value" strokeWidth={0}>
                      {pieData.map((_,i)=><Cell key={i} fill={PIE_C[i%PIE_C.length]}/>)}
                    </Pie>
                  </PieChart>
                  <div style={{flex:1}}>
                    {pieData.map((d,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13}}>
                        <span style={{width:8,height:8,borderRadius:2,background:PIE_C[i%PIE_C.length],flexShrink:0}}/>
                        <span style={{color:G.sub,flex:1}}>{d.name}</span>
                        <span style={{fontWeight:600}}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ):<div style={{fontSize:13,color:G.muted,paddingTop:20}}>Add products to see breakdown.</div>}
            </div>
          </div>

          {openBottles.length>0&&(
            <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,color:G.sub}}>Open bottles — quick view</div>
                <Badge color={alertBottles.length>0?"red":"green"}>{alertBottles.length} alert{alertBottles.length!==1?"s":""}</Badge>
              </div>
              {openBottles.slice(0,5).map((b,i)=>{
                const over=b.actualMl>b.expectedMl&&b.expectedMl>0;
                return(
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:i<Math.min(openBottles.length,5)-1?`1px solid ${G.border}`:"none"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500}}>{b.name}</div>
                      <div style={{fontSize:11,color:G.muted}}>Opened {b.openedDate}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:120}}>
                      <VolBar pct={b.pctRemaining}/>
                      <span style={{fontSize:12,color:G.sub,minWidth:30}}>{b.pctRemaining}%</span>
                    </div>
                    {over?<Badge color="red">Over</Badge>:<Badge color="green">OK</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── OPEN BOTTLES ────────────────────────────────────────────────
function LogServingModal({ bottle, products, onClose, onUpdate }){
  const product=products.find(p=>p.id===bottle.productId);
  const servingMl=product?.serving?.ml||0;
  const [count,setCount]=useState(1);
  const [pct,setPct]=useState(Math.max(0,bottle.pctRemaining-Math.round(count*100/(product?.packaging?.units||1)/(product?.serving?.ml||1)*(product?.packaging?.volPerUnit||750)/100)));
  const logged=count*(servingMl||0);
  return(
    <Modal title={`Log serving — ${bottle.name}`} onClose={onClose}>
      {servingMl>0&&<div style={{background:`${G.gold}0E`,border:`1px solid ${G.gold}22`,borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:13,color:G.sub}}>Standard serving: <span style={{color:G.gold,fontWeight:600}}>{fmtMl(servingMl)}</span></div>}
      <Field label="Number of servings poured">
        <input style={inp} type="number" min="1" value={count} onChange={e=>setCount(Number(e.target.value))}/>
      </Field>
      {servingMl>0&&<div style={{fontSize:12,color:G.muted,marginBottom:16,marginTop:-10}}>= {fmtMl(count*servingMl)} total volume</div>}
      <Field label="Remaining volume (%)">
        <input style={inp} type="number" min="0" max="100" value={pct} onChange={e=>setPct(Number(e.target.value))}/>
      </Field>
      <div style={{display:"flex",gap:10,marginTop:4}}>
        <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${G.border}`,borderRadius:10,padding:"10px",color:G.sub,fontSize:13,cursor:"pointer"}}>Cancel</button>
        <button onClick={()=>{ onUpdate(bottle.id,{ actualMl:bottle.actualMl+count*(servingMl||40), pctRemaining:pct }); onClose(); }} style={{flex:2,background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Log serving</button>
      </div>
    </Modal>
  );
}

function AddOpenBottleModal({ products, onClose, onAdd }){
  const [productId,setProductId]=useState(products[0]?.id||"");
  const [name,setName]=useState("");
  const [pct,setPct]=useState(100);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const product=products.find(p=>p.id===productId);
  const volPerUnit=product?.packaging?.volPerUnit||750;
  const expectedMl=volPerUnit;

  useEffect(()=>{ if(product) setName(product.info?.name||""); },[productId]);

  return(
    <Modal title="Open a bottle" onClose={onClose}>
      {products.length===0?(
        <div style={{textAlign:"center",padding:"20px 0",color:G.muted,fontSize:13}}>No products catalogued yet. Add products first.</div>
      ):(
        <>
          <Field label="Product">
            <select style={sel} value={productId} onChange={e=>setProductId(e.target.value)}>
              {products.map(p=><option key={p.id} value={p.id}>{p.info?.name} — {p.info?.category}</option>)}
            </select>
          </Field>
          <Field label="Bottle label / identifier" hint="Optional">
            <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Table 4 bottle, Bar bottle #2"/>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Starting volume (%)">
              <input style={inp} type="number" min="1" max="100" value={pct} onChange={e=>setPct(Number(e.target.value))}/>
            </Field>
            <Field label="Date opened">
              <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </Field>
          </div>
          {product&&(
            <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:12,color:G.muted}}>
              Unit volume: <span style={{color:G.sub}}>{fmtMl(volPerUnit)}</span> · Serving size: <span style={{color:G.sub}}>{fmtMl(product.serving?.ml||0)}</span> · Expected servings: <span style={{color:G.gold}}>{product.serving?.ml?Math.round(volPerUnit/product.serving.ml):0}</span>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${G.border}`,borderRadius:10,padding:"10px",color:G.sub,fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{ onAdd({ id:uid(), productId, name:name||product?.info?.name||"Bottle", pctRemaining:pct, openedDate:date, actualMl:0, expectedMl }); onClose(); }} style={{flex:2,background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Open bottle</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function OpenBottlesPage({ openBottles, products, addBottle, updateBottle, deleteBottle }){
  const [showAdd,setShowAdd]=useState(false);
  const [logging,setLogging]=useState(null);
  const [filter,setFilter]=useState("all");

  const filtered=openBottles.filter(b=>{
    if(filter==="alerts") return b.pctRemaining<20||(b.actualMl>b.expectedMl&&b.expectedMl>0);
    if(filter==="low") return b.pctRemaining<25;
    if(filter==="over") return b.actualMl>b.expectedMl&&b.expectedMl>0;
    return true;
  });

  return(
    <div style={{padding:32,overflowY:"auto",height:"100vh",boxSizing:"border-box"}}>
      {showAdd&&<AddOpenBottleModal products={products} onClose={()=>setShowAdd(false)} onAdd={(b)=>{ addBottle(b); setShowAdd(false); }}/>}
      {logging&&<LogServingModal bottle={logging} products={products} onClose={()=>setLogging(null)} onUpdate={(id,patch)=>{ updateBottle(id,patch); setLogging(null); }}/>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>Open bottles</h1>
          <p style={{fontSize:13,color:G.muted,margin:"4px 0 0"}}>{openBottles.length} bottle{openBottles.length!==1?"s":""} currently open</p>
        </div>
        <button onClick={()=>setShowAdd(true)} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Open bottle</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
        <KPICard label="Bottles open" value={openBottles.length} sub={`${openBottles.filter(b=>b.pctRemaining<25).length} running low`}/>
        <KPICard label="Variance alerts" value={openBottles.filter(b=>b.actualMl>b.expectedMl&&b.expectedMl>0).length} sub="Over expected consumption" accent={openBottles.filter(b=>b.actualMl>b.expectedMl&&b.expectedMl>0).length>0}/>
        <KPICard label="Avg remaining" value={openBottles.length?`${Math.round(openBottles.reduce((s,b)=>s+b.pctRemaining,0)/openBottles.length)}%`:"—"} sub="Across open bottles"/>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["all","All"],["alerts","Alerts"],["low","Low volume"],["over","Over-poured"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{background:filter===v?`${G.gold}18`:"rgba(255,255,255,0.04)",border:`1px solid ${filter===v?G.gold+"44":G.border}`,color:filter===v?G.gold:G.sub,borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer",fontWeight:500}}>
            {l}{v==="alerts"&&openBottles.filter(b=>b.pctRemaining<20||(b.actualMl>b.expectedMl&&b.expectedMl>0)).length>0&&<span style={{marginLeft:6,background:G.danger,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10}}>{openBottles.filter(b=>b.pctRemaining<20||(b.actualMl>b.expectedMl&&b.expectedMl>0)).length}</span>}
          </button>
        ))}
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"70px 0",color:G.muted}}>
          <div style={{fontSize:32,marginBottom:12,opacity:0.2}}>◎</div>
          <div style={{fontSize:15,color:G.sub,marginBottom:6}}>{openBottles.length===0?"No open bottles yet":"No bottles match this filter"}</div>
          {openBottles.length===0&&<button onClick={()=>setShowAdd(true)} style={{marginTop:12,background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Open your first bottle</button>}
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
          {filtered.map(b=>{
            const product=products.find(p=>p.id===b.productId);
            const over=b.actualMl>b.expectedMl&&b.expectedMl>0;
            const low=b.pctRemaining<25;
            const servingMl=product?.serving?.ml||0;
            const servingsDone=servingMl>0?Math.round(b.actualMl/servingMl):0;
            const servingsExpected=servingMl>0&&b.expectedMl?Math.round(b.expectedMl/servingMl):0;
            const pricePerMl=(Number(product?.financial?.salePricePerServing)||0)/(product?.serving?.ml||1);
            const lossKr=over?Math.round((b.actualMl-b.expectedMl)*pricePerMl):0;
            return(
              <div key={b.id} style={{background:G.card,border:`1px solid ${over||low?G.danger+"44":G.border}`,borderRadius:14,padding:"20px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>{b.name}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {product?.info?.category&&<Badge color="gray">{product.info.category}</Badge>}
                      {product?.info?.alcoholType&&<Badge color="blue">{product.info.alcoholType}</Badge>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {over&&<Badge color="red">Over-poured</Badge>}
                    {low&&!over&&<Badge color="gold">Low</Badge>}
                    {!over&&!low&&<Badge color="green">OK</Badge>}
                    <button onClick={()=>deleteBottle(b.id)} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>×</button>
                  </div>
                </div>

                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:12,color:G.muted}}>Remaining volume</span>
                    <span style={{fontSize:13,fontWeight:700,color:low?G.danger:G.text}}>{b.pctRemaining}%</span>
                  </div>
                  <VolBar pct={b.pctRemaining}/>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>POURED</div>
                    <div style={{fontSize:16,fontWeight:700}}>{servingsDone}</div>
                    <div style={{fontSize:10,color:G.muted}}>servings</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>EXPECTED</div>
                    <div style={{fontSize:16,fontWeight:700,color:G.sub}}>{servingsExpected}</div>
                    <div style={{fontSize:10,color:G.muted}}>servings</div>
                  </div>
                  <div style={{background:over?`${G.danger}12`:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>VARIANCE</div>
                    <div style={{fontSize:16,fontWeight:700,color:over?G.danger:G.success}}>{over?`+${servingsDone-servingsExpected}`:servingsDone<=servingsExpected?"—":`-${servingsExpected-servingsDone}`}</div>
                    <div style={{fontSize:10,color:G.muted}}>servings</div>
                  </div>
                </div>

                {over&&lossKr>0&&(
                  <div style={{background:`${G.danger}0E`,border:`1px solid ${G.danger}33`,borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:G.danger}}>
                    Est. loss from over-pouring: <span style={{fontWeight:700}}>kr {fmt(lossKr)}</span>
                  </div>
                )}

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:G.muted}}>Opened {b.openedDate}</span>
                  <button onClick={()=>setLogging(b)} style={{background:`${G.gold}18`,border:`1px solid ${G.gold}44`,color:G.gold,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Log serving</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PRODUCTS / WIZARD ───────────────────────────────────────────
function LivePreview({ info,packaging,serving,financial }){
  const c=calcFinancials(packaging,serving,financial);
  return(
    <div style={{background:"#0A0F1E",border:`1px solid ${G.border}`,borderRadius:14,padding:22,position:"sticky",top:24}}>
      <div style={{fontSize:10,color:G.muted,fontWeight:600,letterSpacing:"0.08em",marginBottom:18}}>LIVE PREVIEW</div>
      <div style={{marginBottom:18,paddingBottom:18,borderBottom:`1px solid ${G.border}`}}>
        <div style={{fontSize:16,fontWeight:700,color:info.name?G.text:"#334155",marginBottom:6}}>{info.name||"Product name..."}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {info.category&&<Badge color="gray">{info.category}</Badge>}
          {info.alcoholType&&<Badge color="blue">{info.alcoholType}</Badge>}
        </div>
      </div>
      {packaging.units>0&&packaging.volPerUnit>0&&(
        <div style={{marginBottom:18,paddingBottom:18,borderBottom:`1px solid ${G.border}`}}>
          <div style={{fontSize:10,color:G.muted,fontWeight:600,letterSpacing:"0.06em",marginBottom:10}}>PACKAGING</div>
          <div style={{fontSize:13,color:G.sub,marginBottom:4}}>{packaging.name||"Custom"}</div>
          <div style={{fontSize:13,marginBottom:8}}><span style={{color:G.text}}>{packaging.units}</span><span style={{color:G.muted}}> × </span><span style={{color:G.text}}>{fmtMl(packaging.volPerUnit)}</span></div>
          <div style={{background:`${G.gold}0E`,border:`1px solid ${G.gold}22`,borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:G.muted}}>Total volume</span>
            <span style={{fontSize:14,fontWeight:700,color:G.gold}}>{fmtMl(c.totalMl)}</span>
          </div>
        </div>
      )}
      {serving.ml>0&&packaging.volPerUnit>0&&(
        <div style={{marginBottom:18,paddingBottom:18,borderBottom:`1px solid ${G.border}`}}>
          <div style={{fontSize:10,color:G.muted,fontWeight:600,letterSpacing:"0.06em",marginBottom:10}}>SERVING</div>
          <div style={{fontSize:13,color:G.sub,marginBottom:8}}>{serving.name||"Custom"} · {fmtMl(serving.ml)}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:G.muted,marginBottom:3}}>PER UNIT</div>
              <div style={{fontSize:16,fontWeight:700}}>{c.servingsPerUnit.toFixed(1)}</div>
            </div>
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:G.muted,marginBottom:3}}>PER PKG</div>
              <div style={{fontSize:16,fontWeight:700,color:G.gold}}>{c.servingsPerPkg.toFixed(0)}</div>
            </div>
          </div>
        </div>
      )}
      {(financial.costPerPackage||financial.salePricePerServing)&&serving.ml>0&&packaging.volPerUnit>0&&(
        <div>
          <div style={{fontSize:10,color:G.muted,fontWeight:600,letterSpacing:"0.06em",marginBottom:10}}>FINANCIALS</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:G.muted}}>Revenue / pkg</span><span style={{fontWeight:700,color:G.success}}>kr {fmt(c.revenue)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:G.muted}}>Margin</span><span style={{fontWeight:700,color:c.margin>60?G.success:c.margin>30?G.warning:G.danger}}>{c.margin.toFixed(1)}%</span></div>
            <div style={{background:"rgba(255,255,255,0.06)",borderRadius:4,height:5,overflow:"hidden",marginTop:2}}>
              <div style={{background:c.margin>60?G.success:c.margin>30?G.warning:G.danger,width:`${Math.min(100,c.margin)}%`,height:"100%",borderRadius:4,transition:"width 0.4s"}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddProductWizard({ onSave, onCancel }){
  const [step,setStep]=useState(1);
  const [saving,setSaving]=useState(false);
  const [info,setInfo]=useState({name:"",category:"",alcoholType:"",brand:"",supplier:"",sku:""});
  const [packaging,setPackaging]=useState({name:"",units:0,volPerUnit:0});
  const [serving,setServing]=useState({name:"",ml:0});
  const [financial,setFinancial]=useState({costPerPackage:"",salePricePerServing:""});
  const [behavior,setBehavior]=useState({trackOpened:true,varianceDetection:true,aiMonitoring:false,lowStockAlerts:true});
  const types=ALCOHOL_TYPES[info.category]||[];
  const c=calcFinancials(packaging,serving,financial);
  const canNext={1:info.name.trim()&&info.category,2:packaging.units>0&&packaging.volPerUnit>0,3:serving.ml>0,4:true,5:true};

  const handleSave=async()=>{
    setSaving(true);
    await new Promise(r=>setTimeout(r,700));
    onSave({info,packaging:{...packaging,totalVolumeMl:packaging.units*packaging.volPerUnit},serving,financial:{...financial,...c},behavior});
    setSaving(false);
  };

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:24,alignItems:"start"}}>
      <div>
        <div style={{display:"flex",gap:0,marginBottom:22,background:"rgba(255,255,255,0.03)",border:`1px solid ${G.border}`,borderRadius:12,padding:4}}>
          {WIZARD_STEPS.map(s=>{
            const active=step===s.id, done=step>s.id;
            return(
              <button key={s.id} onClick={()=>(done||active)&&setStep(s.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"9px 4px",background:active?`${G.gold}16`:"transparent",border:active?`1px solid ${G.gold}38`:"1px solid transparent",borderRadius:9,cursor:(done||active)?"pointer":"default",transition:"all 0.2s"}}>
                <span style={{fontSize:13,color:active?G.gold:done?G.success:"#334155"}}>{done?"✓":s.icon}</span>
                <span style={{fontSize:10,fontWeight:500,color:active?G.gold:done?G.success:"#334155",letterSpacing:"0.03em"}}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {step===1&&(
          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>Product information</div>
            <div style={{fontSize:13,color:G.muted,marginBottom:22}}>Tell us what this product is.</div>
            <Field label="Product name"><input style={inp} placeholder="e.g. House Red Wine" value={info.name} onChange={e=>setInfo({...info,name:e.target.value})}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Category"><select style={sel} value={info.category} onChange={e=>setInfo({...info,category:e.target.value,alcoholType:""})}><option value="">Select</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field>
              <Field label="Alcohol type"><select style={sel} value={info.alcoholType} onChange={e=>setInfo({...info,alcoholType:e.target.value})} disabled={!info.category}><option value="">Select</option>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
              <Field label="Brand"><input style={inp} placeholder="e.g. Château Margaux" value={info.brand} onChange={e=>setInfo({...info,brand:e.target.value})}/></Field>
              <Field label="Supplier" hint="Optional"><input style={inp} placeholder="e.g. Vinmonopolet" value={info.supplier} onChange={e=>setInfo({...info,supplier:e.target.value})}/></Field>
            </div>
          </div>
        )}

        {step===2&&(
          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>Packaging setup</div>
            <div style={{fontSize:13,color:G.muted,marginBottom:18}}>How is this product received into inventory?</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>
              {PRESET_PACKAGING.map(p=>(
                <button key={p.name} onClick={()=>setPackaging({...packaging,name:p.name,units:p.units,volPerUnit:p.vol})} style={{background:packaging.name===p.name?`${G.gold}18`:"rgba(255,255,255,0.04)",border:`1px solid ${packaging.name===p.name?G.gold+"44":G.border}`,color:packaging.name===p.name?G.gold:G.sub,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:500}}>
                  {p.name}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <Field label="Package name"><input style={inp} placeholder="Case of 6" value={packaging.name} onChange={e=>setPackaging({...packaging,name:e.target.value})}/></Field>
              <Field label="Units"><input style={inp} type="number" min="1" placeholder="6" value={packaging.units||""} onChange={e=>setPackaging({...packaging,units:Number(e.target.value)})}/></Field>
              <Field label="ml per unit"><input style={inp} type="number" min="1" placeholder="750" value={packaging.volPerUnit||""} onChange={e=>setPackaging({...packaging,volPerUnit:Number(e.target.value)})}/></Field>
            </div>
            {packaging.units>0&&packaging.volPerUnit>0&&(
              <div style={{background:`${G.gold}0A`,border:`1px solid ${G.gold}22`,borderRadius:10,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:G.muted}}>{packaging.units} × {fmtMl(packaging.volPerUnit)}</span>
                <span style={{fontSize:20,fontWeight:700,color:G.gold}}>{fmtMl(packaging.units*packaging.volPerUnit)}</span>
              </div>
            )}
          </div>
        )}

        {step===3&&(
          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>Serving setup</div>
            <div style={{fontSize:13,color:G.muted,marginBottom:18}}>How is this product served to guests?</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>
              {PRESET_SERVINGS.map(p=>(
                <button key={p.name} onClick={()=>setServing({name:p.name,ml:p.ml})} style={{background:serving.name===p.name?`${G.gold}18`:"rgba(255,255,255,0.04)",border:`1px solid ${serving.name===p.name?G.gold+"44":G.border}`,color:serving.name===p.name?G.gold:G.sub,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:500}}>
                  {p.name} <span style={{opacity:0.5}}>{p.ml}ml</span>
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Serving name"><input style={inp} placeholder="Wine glass" value={serving.name} onChange={e=>setServing({...serving,name:e.target.value})}/></Field>
              <Field label="Serving size (ml)"><input style={inp} type="number" min="1" placeholder="150" value={serving.ml||""} onChange={e=>setServing({...serving,ml:Number(e.target.value)})}/></Field>
            </div>
            {serving.ml>0&&packaging.volPerUnit>0&&(
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"12px 14px",fontSize:13,color:G.muted}}>
                {fmtMl(packaging.volPerUnit)} ÷ {fmtMl(serving.ml)} = <span style={{color:G.gold,fontWeight:600}}>{(packaging.volPerUnit/serving.ml).toFixed(1)} servings per unit</span>
              </div>
            )}
          </div>
        )}

        {step===4&&(
          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>Financial setup</div>
            <div style={{fontSize:13,color:G.muted,marginBottom:18}}>Set your cost and sale price.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <Field label="Cost per package (kr)"><input style={inp} type="number" min="0" placeholder="0" value={financial.costPerPackage} onChange={e=>setFinancial({...financial,costPerPackage:e.target.value})}/></Field>
              <Field label="Sale price per serving (kr)"><input style={inp} type="number" min="0" placeholder="0" value={financial.salePricePerServing} onChange={e=>setFinancial({...financial,salePricePerServing:e.target.value})}/></Field>
            </div>
            {(financial.costPerPackage||financial.salePricePerServing)&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {[{l:"Revenue / pkg",v:`kr ${fmt(c.revenue)}`},{l:"Profit / pkg",v:`kr ${fmt(c.profit)}`},{l:"Margin",v:`${c.margin.toFixed(1)}%`,a:true}].map(k=>(
                  <div key={k.l} style={{background:k.a?`${G.gold}0A`:"rgba(255,255,255,0.04)",border:`1px solid ${k.a?G.gold+"22":G.border}`,borderRadius:10,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:G.muted,marginBottom:6}}>{k.l.toUpperCase()}</div>
                    <div style={{fontSize:20,fontWeight:700,color:k.a?G.gold:G.text}}>{k.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step===5&&(
          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>Inventory behavior</div>
            <div style={{fontSize:13,color:G.muted,marginBottom:18}}>Configure how BevControl tracks this product.</div>
            <Toggle label="Track opened containers" desc="Monitor remaining volume per open unit" value={behavior.trackOpened} onChange={v=>setBehavior({...behavior,trackOpened:v})}/>
            <Toggle label="Enable variance detection" desc="Flag when actual consumption deviates from expected" value={behavior.varianceDetection} onChange={v=>setBehavior({...behavior,varianceDetection:v})}/>
            <Toggle label="AI monitoring" desc="AI-powered anomaly detection and smart alerts" value={behavior.aiMonitoring} onChange={v=>setBehavior({...behavior,aiMonitoring:v})}/>
            <Toggle label="Low stock alerts" desc="Get notified when volume falls below threshold" value={behavior.lowStockAlerts} onChange={v=>setBehavior({...behavior,lowStockAlerts:v})}/>
          </div>
        )}

        <div style={{display:"flex",gap:10,marginTop:12}}>
          <button onClick={step===1?onCancel:()=>setStep(s=>s-1)} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${G.border}`,color:G.sub,borderRadius:10,padding:"11px 18px",fontSize:13,cursor:"pointer"}}>
            {step===1?"Cancel":"← Back"}
          </button>
          {step<5?(
            <button onClick={()=>setStep(s=>s+1)} disabled={!canNext[step]} style={{flex:1,background:canNext[step]?`linear-gradient(135deg,${G.gold},${G.goldLight})`:"rgba(255,255,255,0.06)",color:canNext[step]?"#1A1A2E":"#475569",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:canNext[step]?"pointer":"default",transition:"all 0.2s"}}>
              Continue →
            </button>
          ):(
            <button onClick={handleSave} disabled={saving} style={{flex:1,background:saving?"rgba(255,255,255,0.06)":`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:saving?"#64748B":"#1A1A2E",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:saving?"default":"pointer"}}>
              {saving?"Saving...":"✓ Add product"}
            </button>
          )}
        </div>
      </div>
      <LivePreview info={info} packaging={packaging} serving={serving} financial={financial}/>
    </div>
  );
}

function ProductsPage({ products, addProduct, deleteProduct }){
  const [view,setView]=useState("list");
  const totalRevEst=products.reduce((s,p)=>s+calcFinancials(p.packaging,p.serving,p.financial).revenue,0);
  const avgMargin=products.length?products.reduce((s,p)=>s+calcFinancials(p.packaging,p.serving,p.financial).margin,0)/products.length:0;

  if(view==="add") return(
    <div style={{padding:32,overflowY:"auto",height:"100vh",boxSizing:"border-box"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>Add product</h1>
        <p style={{fontSize:13,color:G.muted,margin:"4px 0 0"}}>Define packaging, serving and financials.</p>
      </div>
      <AddProductWizard onSave={p=>{addProduct(p);setView("list");}} onCancel={()=>setView("list")}/>
    </div>
  );

  return(
    <div style={{padding:32,overflowY:"auto",height:"100vh",boxSizing:"border-box"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>Products</h1>
          <p style={{fontSize:13,color:G.muted,margin:"4px 0 0"}}>{products.length} product{products.length!==1?"s":""} catalogued</p>
        </div>
        <button onClick={()=>setView("add")} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add product</button>
      </div>

      {products.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
          <KPICard label="Products" value={products.length}/>
          <KPICard label="Est. revenue potential" value={`kr ${fmt(totalRevEst)}`} sub="Per package cycle"/>
          <KPICard label="Avg margin" value={`${avgMargin.toFixed(1)}%`} accent/>
        </div>
      )}

      {products.length===0?(
        <div style={{textAlign:"center",padding:"80px 0"}}>
          <div style={{fontSize:36,marginBottom:14,opacity:0.2}}>◫</div>
          <div style={{fontSize:15,color:G.sub,marginBottom:6}}>No products yet</div>
          <div style={{fontSize:13,color:G.muted,marginBottom:24}}>Add your first product to start tracking inventory.</div>
          <button onClick={()=>setView("add")} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"11px 28px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Add your first product</button>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
          {products.map(p=>{
            const c=calcFinancials(p.packaging,p.serving,p.financial);
            return(
              <div key={p.id} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:"20px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,marginBottom:5}}>{p.info?.name}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {p.info?.category&&<Badge color="gray">{p.info.category}</Badge>}
                      {p.info?.alcoholType&&<Badge color="blue">{p.info.alcoholType}</Badge>}
                    </div>
                  </div>
                  <button onClick={()=>deleteProduct(p.id)} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>VOLUME</div>
                    <div style={{fontSize:15,fontWeight:700,color:G.gold}}>{fmtMl(p.packaging?.totalVolumeMl||0)}</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>SERVINGS</div>
                    <div style={{fontSize:15,fontWeight:700}}>{c.servingsPerPkg.toFixed(0)}/pkg</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>MARGIN</div>
                    <div style={{fontSize:15,fontWeight:700,color:c.margin>60?G.success:c.margin>30?G.warning:G.muted}}>{c.margin>0?`${c.margin.toFixed(1)}%`:"—"}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:G.muted,borderTop:`1px solid ${G.border}`,paddingTop:10,display:"flex",gap:8}}>
                  <span>{p.packaging?.name||"—"}</span>
                  <span style={{color:"#2D3748"}}>·</span>
                  <span>{p.serving?.name} ({p.serving?.ml?fmtMl(p.serving.ml):"—"})</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────
function SettingsPage({ venue, saveVenue }){
  const [form,setForm]=useState(venue);
  const [saved,setSaved]=useState(false);
  useEffect(()=>setForm(venue),[venue]);
  return(
    <div style={{padding:32,overflowY:"auto",height:"100vh",boxSizing:"border-box",maxWidth:580}}>
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 28px",letterSpacing:"-0.02em"}}>Settings</h1>
      <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,color:G.sub,marginBottom:20}}>Venue profile</div>
        <Field label="Venue name"><input style={inp} value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></Field>
        <Field label="Manager name"><input style={inp} value={form.manager||""} onChange={e=>setForm(f=>({...f,manager:e.target.value}))}/></Field>
        <Field label="Contact email"><input style={inp} type="email" value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></Field>
        <button onClick={async()=>{ await saveVenue(form); setSaved(true); setTimeout(()=>setSaved(false),2000); }} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:8,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          {saved?"✓ Saved!":"Save changes"}
        </button>
      </div>
      <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:26}}>
        <div style={{fontSize:13,fontWeight:600,color:G.sub,marginBottom:14}}>Integrations</div>
        {[{n:"Toast POS",s:"Coming soon"},{n:"Lightspeed",s:"Coming soon"},{n:"CSV Export",s:"Available"},{n:"QR Code scanner",s:"Beta"}].map((p,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<3?`1px solid ${G.border}`:"none"}}>
            <span style={{fontSize:13}}>{p.n}</span>
            <Badge color={p.s==="Available"?"green":p.s==="Beta"?"blue":"gray"}>{p.s}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────
function LandingPage({ onLogin }){
  const features=[
    {icon:"◎",t:"Open bottle tracking",d:"Know exactly how much is left in every open container, in real time."},
    {icon:"✦",t:"AI anomaly detection",d:"Automatically flag over-pouring, unusual patterns and variance spikes."},
    {icon:"◈",t:"ml-based precision",d:"Every liquid is tracked in millilitres internally — no guesswork, no rounding."},
    {icon:"◫",t:"Smart inventory",d:"Define packaging, serving sizes and financials once — the system does the rest."},
    {icon:"▦",t:"Revenue leakage dashboard",d:"See exactly how much you're losing and where, every day."},
    {icon:"◑",t:"Multi-location ready",d:"Manage several bars, restaurants or hotels from a single account."},
  ];
  const [scrollY,setScrollY]=useState(0);
  useEffect(()=>{
    const h=()=>setScrollY(window.scrollY);
    window.addEventListener("scroll",h);
    return()=>window.removeEventListener("scroll",h);
  },[]);

  return(
    <div style={{minHeight:"100vh",background:G.bg,color:G.text,fontFamily:"'Inter',system-ui,sans-serif",overflowX:"hidden"}}>
      {/* Navbar */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:scrollY>10?"rgba(7,11,22,0.95)":"transparent",backdropFilter:scrollY>10?"blur(20px)":"none",borderBottom:scrollY>10?`1px solid ${G.border}`:"none",padding:"0 40px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.3s"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#1A1A2E"}}>B</div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:"-0.02em"}}>BevControl</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          {["Features","Pricing","About"].map(l=><span key={l} style={{fontSize:14,color:G.sub,cursor:"pointer"}}>{l}</span>)}
          <button onClick={onLogin} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Sign in</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{textAlign:"center",padding:"110px 40px 90px",maxWidth:780,margin:"0 auto"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${G.gold}14`,border:`1px solid ${G.gold}33`,borderRadius:20,padding:"6px 16px",fontSize:12,color:G.gold,fontWeight:600,marginBottom:28,letterSpacing:"0.05em"}}>
          ✦ NOW IN BETA — SCANDINAVIA
        </div>
        <h1 style={{fontSize:"clamp(36px,5.5vw,62px)",fontWeight:800,lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:22,background:`linear-gradient(180deg, ${G.text} 0%, #475569 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Stop losing money<br/>on every pour.
        </h1>
        <p style={{fontSize:18,color:G.sub,lineHeight:1.7,marginBottom:40,maxWidth:520,margin:"0 auto 40px"}}>
          BevControl gives restaurants, bars and hotels complete visibility over open bottles, consumption patterns and revenue leakage — tracked to the millilitre.
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={onLogin} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"15px 36px",fontSize:15,fontWeight:700,cursor:"pointer"}}>Start free trial</button>
          <button onClick={onLogin} style={{background:"rgba(255,255,255,0.05)",color:G.text,border:`1px solid ${G.border}`,borderRadius:10,padding:"15px 36px",fontSize:15,cursor:"pointer"}}>View demo →</button>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{background:"rgba(255,255,255,0.02)",borderTop:`1px solid ${G.border}`,borderBottom:`1px solid ${G.border}`,padding:"24px 40px",display:"flex",justifyContent:"center",gap:60,flexWrap:"wrap"}}>
        {[["300+","Venues using BevControl"],["20%","Avg beverage loss reduction"],["kr 18k","Avg monthly savings"],["< 5min","To set up your first product"]].map(([v,l])=>(
          <div key={l} style={{textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,color:G.gold,letterSpacing:"-0.02em"}}>{v}</div>
            <div style={{fontSize:12,color:G.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <section style={{padding:"90px 40px",maxWidth:960,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:56}}>
          <h2 style={{fontSize:36,fontWeight:800,letterSpacing:"-0.02em",marginBottom:12}}>Everything you need</h2>
          <p style={{fontSize:16,color:G.sub}}>Built specifically for the hospitality industry.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {features.map((f,i)=>(
            <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:"24px 22px"}}>
              <div style={{fontSize:22,color:G.gold,marginBottom:12}}>{f.icon}</div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:8}}>{f.t}</div>
              <div style={{fontSize:13,color:G.sub,lineHeight:1.6}}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{padding:"80px 40px",maxWidth:960,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:56}}>
          <h2 style={{fontSize:36,fontWeight:800,letterSpacing:"-0.02em",marginBottom:12}}>Simple, honest pricing</h2>
          <p style={{fontSize:16,color:G.sub}}>No hidden fees. Cancel any time.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {[
            {name:"Starter",price:"kr 990",period:"/mo",features:["Up to 50 products","1 location","Basic tracking","Email support"],cta:"Start free trial"},
            {name:"Professional",price:"kr 2,490",period:"/mo",features:["Unlimited products","3 locations","AI insights","Variance detection","Priority support"],cta:"Start free trial",popular:true},
            {name:"Enterprise",price:"Custom",period:"",features:["Everything in Pro","Unlimited locations","Custom integrations","Dedicated CSM","SLA"],cta:"Contact sales"},
          ].map((p,i)=>(
            <div key={i} style={{background:p.popular?`linear-gradient(135deg,${G.gold}12,${G.blue}08)`:G.card,border:p.popular?`1px solid ${G.gold}55`:`1px solid ${G.border}`,borderRadius:16,padding:"28px 24px"}}>
              {p.popular&&<div style={{fontSize:11,fontWeight:700,color:G.gold,letterSpacing:"0.08em",marginBottom:12}}>MOST POPULAR</div>}
              <div style={{fontWeight:700,fontSize:18,marginBottom:6}}>{p.name}</div>
              <div style={{fontSize:30,fontWeight:800,color:G.gold,marginBottom:20}}>{p.price}<span style={{fontSize:14,fontWeight:400,color:G.muted}}>{p.period}</span></div>
              <div style={{borderTop:`1px solid ${G.border}`,paddingTop:18,marginBottom:20}}>
                {p.features.map((f,j)=><div key={j} style={{fontSize:13,color:G.sub,marginBottom:8}}>✓ {f}</div>)}
              </div>
              <button onClick={onLogin} style={{width:"100%",background:p.popular?`linear-gradient(135deg,${G.gold},${G.goldLight})`:"rgba(255,255,255,0.07)",color:p.popular?"#1A1A2E":G.text,border:p.popular?"none":`1px solid ${G.border}`,borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{padding:"80px 40px",maxWidth:960,margin:"0 auto"}}>
        <h2 style={{textAlign:"center",fontSize:32,fontWeight:800,letterSpacing:"-0.02em",marginBottom:48}}>Trusted by leading venues</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {[
            {q:"We cut our monthly beverage loss by 23% in the first 60 days. The alerts paid for the subscription in week one.",name:"Kristoffer M.",venue:"Lysverket, Bergen"},
            {q:"Finally a product that feels like it was built for high-end hospitality. Our bar team loves it.",name:"Anette S.",venue:"Hotel Continental, Oslo"},
            {q:"The ml-based tracking changed everything. We now know exactly where every litre goes.",name:"Thomas H.",venue:"Noma Group, Copenhagen"},
          ].map((t,i)=>(
            <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:"22px 20px"}}>
              <div style={{fontSize:14,color:G.sub,lineHeight:1.7,marginBottom:16}}>"{t.q}"</div>
              <div style={{fontSize:13,fontWeight:600}}>{t.name}</div>
              <div style={{fontSize:12,color:G.gold}}>{t.venue}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{textAlign:"center",padding:"90px 40px 60px"}}>
        <h2 style={{fontSize:42,fontWeight:800,letterSpacing:"-0.03em",marginBottom:14}}>Stop losing money tonight.</h2>
        <p style={{color:G.sub,marginBottom:36,fontSize:16}}>Join 300+ venues saving thousands every month across Scandinavia.</p>
        <button onClick={onLogin} style={{background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:12,padding:"16px 44px",fontSize:16,fontWeight:800,cursor:"pointer"}}>
          Start your 14-day free trial
        </button>
        <div style={{marginTop:60,borderTop:`1px solid ${G.border}`,paddingTop:32,fontSize:13,color:"#374151"}}>
          © 2025 BevControl AS — Oslo, Norway
        </div>
      </section>
    </div>
  );
}

// ─── AUTH ────────────────────────────────────────────────────────
function AuthPage({ onLogin, onBack }){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [loading,setLoading]=useState(false);
  const handle=async()=>{
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    setLoading(false);
    onLogin();
  };
  return(
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",padding:16}}>
      <div style={{width:380,maxWidth:"100%"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:44,height:44,background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#1A1A2E",margin:"0 auto 18px"}}>B</div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.02em",marginBottom:6}}>{mode==="login"?"Welcome back":"Create account"}</div>
          <div style={{fontSize:13,color:G.muted}}>BevControl — Hospitality Intelligence</div>
        </div>
        <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:16,padding:"28px 28px"}}>
          <Field label="Email"><input style={inp} type="email" placeholder="you@venue.no" value={email} onChange={e=>setEmail(e.target.value)}/></Field>
          <Field label="Password"><input style={inp} type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}/></Field>
          {mode==="login"&&<div style={{textAlign:"right",marginTop:-10,marginBottom:18}}><span style={{fontSize:12,color:G.gold,cursor:"pointer"}}>Forgot password?</span></div>}
          <button onClick={handle} style={{width:"100%",background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,color:"#1A1A2E",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:16,marginTop:mode==="login"?0:8}}>
            {loading?"Signing in...":mode==="login"?"Sign in →":"Create account"}
          </button>
          <div style={{textAlign:"center",fontSize:13,color:G.muted}}>
            {mode==="login"?<>No account? <span onClick={()=>setMode("signup")} style={{color:G.gold,cursor:"pointer"}}>Sign up free</span></>:<>Have an account? <span onClick={()=>setMode("login")} style={{color:G.gold,cursor:"pointer"}}>Sign in</span></>}
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20}}>
          <span onClick={onBack} style={{fontSize:12,color:G.muted,cursor:"pointer"}}>← Back to homepage</span>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────
export default function BevControl(){
  const [screen,setScreen]=useState("landing");
  const [page,setPage]=useState("dashboard");
  const [products,saveProducts,prodReady]=useStorage("bev:products2",[]);
  const [openBottles,saveBottles,bottlesReady]=useStorage("bev:openBottles",[]);
  const [venue,saveVenue,venueReady]=useStorage("bev:venue",{name:"My Venue",manager:"",email:""});

  const addProduct=useCallback(p=>saveProducts([...products,{...p,id:uid(),createdAt:new Date().toISOString()}]),[products,saveProducts]);
  const deleteProduct=useCallback(id=>saveProducts(products.filter(p=>p.id!==id)),[products,saveProducts]);
  const addBottle=useCallback(b=>saveBottles([...openBottles,b]),[openBottles,saveBottles]);
  const updateBottle=useCallback((id,patch)=>saveBottles(openBottles.map(b=>b.id===id?{...b,...patch}:b)),[openBottles,saveBottles]);
  const deleteBottle=useCallback(id=>saveBottles(openBottles.filter(b=>b.id!==id)),[openBottles,saveBottles]);

  if(!prodReady||!bottlesReady||!venueReady) return(
    <div style={{height:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",color:G.muted,fontFamily:"system-ui",fontSize:14}}>Loading...</div>
  );

  if(screen==="landing") return <LandingPage onLogin={()=>setScreen("auth")}/>;
  if(screen==="auth") return <AuthPage onLogin={()=>{ setScreen("app"); setPage("dashboard"); }} onBack={()=>setScreen("landing")}/>;

  return(
    <div style={{display:"flex",height:"100vh",background:G.bg,color:G.text,fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}}>
      <Sidebar page={page} setPage={setPage} venue={venue} onLogout={()=>setScreen("landing")}/>
      <div style={{flex:1,overflow:"hidden"}}>
        {page==="dashboard"&&<DashboardPage products={products} openBottles={openBottles}/>}
        {page==="bottles"&&<OpenBottlesPage openBottles={openBottles} products={products} addBottle={addBottle} updateBottle={updateBottle} deleteBottle={deleteBottle}/>}
        {page==="inventory"&&<ProductsPage products={products} addProduct={addProduct} deleteProduct={deleteProduct}/>}
        {page==="settings"&&<SettingsPage venue={venue} saveVenue={saveVenue}/>}
      </div>
    </div>
  );
}
