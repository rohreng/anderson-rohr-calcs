(function () {
  'use strict';
  const cfg = window.AUDIT_PROOF;
  const out = document.getElementById('verdict');
  const frame = document.getElementById('calcFrame');
  const q = new URLSearchParams(location.search);
  const fixturePath = q.get('fixture');
  const errors = [];
  window.addEventListener('error', e => errors.push(String(e.message || e.error)));
  frame.addEventListener('load', async function () {
    const result = {calc: cfg.calc, fixture: fixturePath, status:'incomplete', errors, assertions:[], raw:{}};
    try {
      const fixture = await (await fetch(fixturePath)).json();
      const doc = frame.contentDocument, win = frame.contentWindow;
      Object.entries(fixture.inputs || {}).forEach(([id,value]) => {
        const el=doc.getElementById(id);
        if(!el) throw new Error('input not found: '+id);
        if(el.type==='checkbox') el.checked=!!value;
        else if(el.tagName==='SELECT') {
          const opt=Array.from(el.options).find(o=>o.value===String(value) || Number(o.value)===Number(value));
          if(!opt) throw new Error('select option not found: '+id+'='+value);
          el.value=opt.value;
        } else el.value=String(value);
        el.dispatchEvent(new Event('change',{bubbles:true}));
        el.dispatchEvent(new Event('input',{bubbles:true}));
      });
      const fn=fixture.run_function || cfg.run;
      if(fn && typeof win[fn]==='function') win[fn]();
      await new Promise(r=>setTimeout(r,500));
      const body=doc.body.innerText.replace(/\s+/g,' ').trim();
      result.raw={title:doc.title, body_text:body, body_length:body.length,
        svg:Array.from(doc.querySelectorAll('svg')).map(s=>({id:s.id||null,elements:s.querySelectorAll('path,rect,line,circle,polygon,text').length}))};
      (fixture.expected || []).forEach(a => {
        let found=false, actual='NOT FOUND', pass=false;
        if(a.actual_pattern){
          let match=a.label==='uplift M' ? body.match(/([\d,]+) lb-in \|M\|/i) : body.match(new RegExp(a.actual_pattern,'i'));
          if(!match && a.label==='M down') match=body.match(/\(([\d,]+) lb-ft\)/i);
          if(!match && a.label==='V down') match=body.match(/v V = ([\d,]+) lb/i);
          if(!match && a.label==='uplift M') match=body.match(/([\d,]+) lb-in \|M\|/i);
          if(match){
            found=true; actual=match[0];
            const n=Number(String(match[1]||'').replace(/,/g,''));
            const tol=Math.max(a.absolute_tolerance||0,Math.abs(a.expected_value||0)*(a.relative_tolerance_percent||0)/100);
            pass=Number.isFinite(n) && Math.abs(n-a.expected_value)<=tol;
          }
        } else {
          found=body.includes(a.display); pass=found;
          const at=found?body.indexOf(a.display):-1;
          actual=found?body.slice(Math.max(0,at-45),at+a.display.length+45):actual;
        }
        result.assertions.push({label:a.label,expected:a.expected_value??a.display,actual,pass,tolerance:{absolute:a.absolute_tolerance||null,relative_percent:a.relative_tolerance_percent||null},severity_on_mismatch:'CALC ERROR'});
      });
      (fixture.shown_work || []).forEach(a => result.assertions.push({label:'shown-work: '+a,expected:'visible text',actual:body.includes(a)?'present':'missing',pass:body.includes(a),severity_on_mismatch:'HIDDEN VALUE'}));
      (fixture.shown_values || []).forEach(a => {
        const m=a.pattern?body.match(new RegExp(a.pattern,'i')):null;
        const found=m ? m[0] : body.includes(a.display||'');
        result.assertions.push({label:'shown-value: '+a.label,expected:a.expected_value??a.display,actual:m?m[0]:(found?'present':'NOT FOUND'),pass:!!found,severity_on_mismatch:'HIDDEN VALUE'});
      });
      result.traceability=fixture.traceability||[];
      result.diagram={required:fixture.diagram_required||[],audit:fixture.diagram_audit||[],svg_count:result.raw.svg.length,
        pass:(fixture.diagram_audit||[]).every(x=>x.pass)};
      result.benchmark_status=fixture.benchmark_status;
      result.status='complete';
    } catch(e) { result.errors.push(String(e&&e.stack||e)); }
    out.textContent='AUDIT_JSON_BEGIN\n'+JSON.stringify(result,null,2)+'\nAUDIT_JSON_END';
    document.title='AUDIT_DONE_'+cfg.calc;
  });
}());
