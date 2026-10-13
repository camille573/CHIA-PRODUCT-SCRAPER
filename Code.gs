/* Bind to the existing spreadsheet. Public FirstEnroll search needs no credentials. */
const FE = Object.freeze({
  testOnly: true, // Change only after Tiffany TEST COPY has passed preservation checks.
  protectedTabs: ['Master Agent List', 'Calc_Data'],
  families: {
    'SUMMIT': /^SUMMIT PLAN (100|200|200\+|300|500|750|1000|1000\+)$/i,
    'SUMMIT LITE': /^SUMMIT LITE (100A|200A)$/i,
    'SIGMA': /^SIGMA CARE PLUS (100A|100|200|200\+|500|750|1000)$/i,
    'MED 1st': /^MEDFIRST (WELLNESS|[1-5])$/i,
    'TRUE HEALTH': /^TRUE HEALTH [1-3]$/i,
    'TDK': /^TDK [1-5]$/i,
    'ADV WELL': /^ADVANCED WELLNESS PLUS (100A|100|200|200\+|300|500|750|1000)$/i,
    'HCS': /^HEALTH CHOICE SILVER (100A|100|200|200\+|300|500|750|1000)$/i,
    'GOOD HEALTH': /^GOOD HEALTH DISTRIBUTION PARTNER (WELLNESS|[1-5])$/i,
    'STM': /^ACCESS HEALTH (TRADITIONAL|LITE) STM$/i
  }
});

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FirstEnroll Updates')
    .addItem('Refresh All Agents', 'refreshAllAgents')
    .addItem('Refresh Current Agent', 'refreshCurrentAgent')
    .addItem('Refresh Selected State', 'refreshSelectedState')
    .addItem('Show Last Scan Result', 'showLastScanResult').addToUi();
}
function refreshAllAgents() { startScan_('all'); }
function refreshCurrentAgent() { startScan_('agent'); }
function refreshSelectedState() { startScan_('state'); }
function showLastScanResult() { showPanel_(); }

function props_() { return PropertiesService.getUserProperties(); }
function key_() { return 'FE_JOB_' + SpreadsheetApp.getActive().getId(); }
function load_() { const s = props_().getProperty(key_()); return s ? JSON.parse(s) : null; }
function save_(job) { props_().setProperty(key_(), JSON.stringify(job)); }
function rep_(sheet) {
  if (!sheet || FE.protectedTabs.includes(sheet.getName())) throw Error('Select a representative tab.');
  if (FE.testOnly && sheet.getName() !== 'Tiffany Wilson') throw Error('Tiffany test must pass before scanning the roster.');
  const links = sheet.getRange('A2:B2').getDisplayValues()[0].filter(x => /^https:\/\/manage\.firstenroll\.com\/index\.cfm\?id=\d+$/.test(x));
  if (links.length !== 1) throw Error('Expected one FirstEnroll URL in A2:B2.');
  const headers = sheet.getRange(4, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  if (headers[0] !== 'STATE' || headers[3] !== 'FE STS') throw Error('Unexpected representative layout.');
  const productHeaders = headers.slice(4).filter(Boolean);
  if (new Set(productHeaders).size !== productHeaders.length) throw Error('Duplicate product headings.');
  return {id:sheet.getSheetId(), name:sheet.getName(), url:links[0], headers:headers};
}
function startScan_(mode) {
  const lock = LockService.getDocumentLock(); lock.waitLock(10000);
  try {
    const old = load_();
    if (old && !old.done) throw Error('A scan is already pending. Open Show Last Scan Result to continue it.');
    const ss = SpreadsheetApp.getActive();
    let sheets = mode === 'all' ? ss.getSheets().filter(s => !FE.protectedTabs.includes(s.getName())) : [ss.getActiveSheet()];
    if (FE.testOnly && mode === 'all') sheets = sheets.filter(s => s.getName() === 'Tiffany Wilson');
    const agents = sheets.map(rep_);
    const selected = ss.getActiveRange();
    if (mode === 'state' && (!selected || selected.getRow() < 5 || selected.getNumRows() !== 1)) throw Error('Select one state row (row 5 or below).');
    const job = {agents:agents.map(a=>({id:a.id,name:a.name})), agentIndex:0, row: mode === 'state' ? selected.getRow() : 5,
      selectedOnly:mode==='state', started:new Date().toISOString(), done:false,
      summary:{agentsChecked:0,statesChecked:0,successfulScans:0,failedScans:0,uncheckedStates:0,productsAdded:0,productsRemoved:0,
      unmatchedProducts:[],unmappedColumns:[],warnings:[],lastSuccessfulScanTime: old ? old.summary.lastSuccessfulScanTime : null}};
    save_(job);
  } finally { lock.releaseLock(); }
  showPanel_();
}
function showPanel_() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('FirstEnroll Updates'));
}
function getScanStatus() { const j=load_(); return j ? {done:j.done,summary:j.summary,agent:j.agents[j.agentIndex]?.name} : {done:true,summary:{message:'No scan yet.'}}; }
function clean_(s) {
  return s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();
}
function fetchState_(url, state) {
  const response = UrlFetchApp.fetch(url,{method:'post',payload:{state:state},followRedirects:false,muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw Error('FirstEnroll HTTP '+response.getResponseCode());
  const body = response.getContentText();
  const selector = body.match(/<select\b[^>]*name=["']state["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selector || !/<\/html\s*>/i.test(body) || !/CONTACT US/i.test(body)) throw Error('Incomplete FirstEnroll response.');
  const options = [...selector[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
  let selected=null, available=[];
  options.forEach(o=>{const v=o[1].match(/\bvalue=["']([^"']*)["']/i); if(v&&v[1]) {available.push(v[1]); if(/\bselected\b/i.test(o[1])) selected=v[1];}});
  if (!available.includes(state)) return {unchecked:true,products:[]};
  if (selected !== state) throw Error('FirstEnroll did not confirm '+state+'.');
  const products=[...body.matchAll(/<h4\b[^>]*>\s*<a\b[^>]*href=["'][^"']*\/information\/product\.cfm[^"']*["'][^>]*>([\s\S]*?)<\/a>\s*<\/h4>/gi)].map(m=>clean_(m[1]));
  return {unchecked:false,products:[...new Set(products)]};
}
function warn_(summary, message) { if(summary.warnings.length<20) summary.warnings.push(message); }
function scanNextState() {
  const lock=LockService.getDocumentLock(); lock.waitLock(10000);
  try {
    const job=load_(); if(!job || job.done) return getScanStatus();
    const ss=SpreadsheetApp.getActive(), agent=job.agents[job.agentIndex], sheet=ss.getSheetById(agent.id);
    let rep;
    try { rep=rep_(sheet); } catch(e) { job.done=true; warn_(job.summary,String(e.message)); save_(job); return getScanStatus(); }
    if (job.row > sheet.getLastRow()) { finishAgent_(job); save_(job); return getScanStatus(); }
    const row=job.row, state=String(sheet.getRange(row,1).getValue()).trim();
    if (!state) { finishAgent_(job); save_(job); return getScanStatus(); }
    job.summary.statesChecked++;
    try {
      const identities=sheet.getRange(5,1,Math.max(1,sheet.getLastRow()-4),1).getDisplayValues().flat();
      if (!/^[A-Z]{2}$/.test(state) || identities.filter(s=>s===state).length!==1) throw Error('Invalid or duplicate state row.');
      const protectedValues=JSON.stringify(sheet.getRange(row,1,1,4).getValues());
      const result=fetchState_(rep.url,state);
      if(result.unchecked) { job.summary.uncheckedStates++; warn_(job.summary,rep.name+' '+state+': absent from dropdown; preserved.'); }
      else {
        const current=rep_(sheet);
        if(JSON.stringify(current)!==JSON.stringify(rep) || JSON.stringify(sheet.getRange(row,1,1,4).getValues())!==protectedValues) throw Error('Workbook changed during scan; state preserved.');
        const matched=new Set();
        result.products.forEach(p=>{
          const names=rep.headers.slice(4).filter(h=>h && (h.toUpperCase()===p.toUpperCase() || (FE.families[h]&&FE.families[h].test(p))));
          if(names.length===1) matched.add(names[0]);
          else if(!job.summary.unmatchedProducts.includes(p) && job.summary.unmatchedProducts.length<100) job.summary.unmatchedProducts.push(p);
        });
        const last=rep.headers.length, updates=[];
        let added=0, removed=0;
        for(let c=5;c<=last;c++) {
          const heading=rep.headers[c-1]; if(!heading) continue;
          // Unconfigured families are preserved, including STBL GUARD, ZURICH, BWA, MED VALUE, PREMIER.
          if(!FE.families[heading] && !matched.has(heading)) { if(!job.summary.unmappedColumns.includes(heading)) job.summary.unmappedColumns.push(heading); continue; }
          const cell=sheet.getRange(row,c), previous=cell.getValue();
          if(cell.getFormula() || cell.getDataValidation() || !['','✓'].includes(previous)) { warn_(job.summary,rep.name+' '+state+' '+heading+': formula, validation or other value; preserved.'); continue; }
          const next=matched.has(heading)?'✓':'';
          if(previous!==next) {
            updates.push({updateCells:{range:{sheetId:rep.id,startRowIndex:row-1,endRowIndex:row,startColumnIndex:c-1,endColumnIndex:c},
              rows:[{values:[next ? {userEnteredValue:{stringValue:next}} : {}]}],fields:'userEnteredValue'}});
            if(next) added++; else removed++;
          }
        }
        // Sheets batchUpdate applies the state's content changes atomically.
        if(updates.length) Sheets.Spreadsheets.batchUpdate({requests:updates},ss.getId());
        job.summary.productsAdded+=added; job.summary.productsRemoved+=removed;
        job.summary.successfulScans++; job.summary.lastSuccessfulScanTime=new Date().toISOString();
      }
    } catch(e) { job.summary.failedScans++; warn_(job.summary,rep.name+' '+state+': '+e.message); }
    if(job.selectedOnly) finishAgent_(job); else { job.row++; if(job.row>sheet.getLastRow()) finishAgent_(job); }
    save_(job); return getScanStatus();
  } finally { lock.releaseLock(); }
}
function finishAgent_(job) { job.summary.agentsChecked++; job.agentIndex++; job.row=5; if(job.agentIndex>=job.agents.length) {job.done=true;job.finished=new Date().toISOString();} }
