(function(){
  'use strict';

  const STORAGE_KEY = 'telecomInfoLogs';
  const MAX_LOGS = 500; // حد أقصى اختياري
  // إعدادات الاتصال
  // استخدم 'proxy' لتجاوز CORS عبر خادم محلي ASP.NET Core (أنشأناه في مجلد proxy-aspnet)
  // أو استخدم 'direct' للاتصال المباشر بالدومين الخارجي (قد يفشل بسبب CORS عند التشغيل محليًا)
  const API_MODE = 'proxy'; // 'proxy' | 'direct'
  const PROXY_BASE = 'http://localhost:5080';

  /** Utilities **/
  const $ = (sel) => document.querySelector(sel);
  const formatDate = (iso) => new Date(iso).toLocaleString('ar-SY');
  const saveLogs = (arr) => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  const loadLogs = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /** Elements **/
  const form = $('#fetchForm');
  const usernameEl = $('#username');
  const passwordEl = $('#password');
  const latestEl = $('#latestResult');
  const historyEl = $('#historyList');
  const exportBtn = $('#exportBtn');
  const clearBtn = $('#clearBtn');
  const testSampleBtn = $('#testSample');
  const intervalInput = $('#intervalMinutes');
  const startAutoBtn = $('#startAuto');
  const stopAutoBtn = $('#stopAuto');
  const nextRunEl = $('#nextRun');

  let logs = loadLogs();
  let autoTimer = null;
  let nextRunAt = null;

  /** Renderers **/
  function renderLatest(){
    if (!logs.length){
      latestEl.classList.add('empty');
      latestEl.textContent = 'لا توجد بيانات بعد.';
      return;
    }
    latestEl.classList.remove('empty');
    const last = logs[logs.length - 1];
    latestEl.innerHTML = formatRecord(last);
  }

  function formatRecord(rec){
    const d = rec.data || {};
    const kv = [
      ['success', d.success],
      ['phone', d.phone],
      ['f_name', d.f_name],
      ['l_name', d.l_name],
      ['online', d.online],
      ['exp', d.exp],
      ['usage', d.usage],
      ['pkg', d.pkg],
      ['serv', d.serv],
      ['limitcomb', d.limitcomb],
      ['limitexpiration', d.limitexpiration],
      ['last_inovice', d.last_inovice]
    ];

    const items = kv.map(([k,v]) => `
      <div class="k">${escapeHtml(k)}</div>
      <div class="v">${escapeHtml(String(v ?? ''))}</div>
    `).join('');

    return `
      <div class="kv">
        ${items}
      </div>
    `;
  }

  function escapeHtml(str){
    return str
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function renderHistory(){
    if (!logs.length){
      historyEl.innerHTML = '<div class="muted">لا يوجد سجل محفوظ بعد.</div>';
      return;
    }
    historyEl.innerHTML = logs.map((rec, idx) => `
      <article class="item">
        <time datetime="${rec.timestamp}">#${idx+1} — ${escapeHtml(formatDate(rec.timestamp))}</time>
        ${formatRecord(rec)}
      </article>
    `).join('');
  }

  /** Core **/
  async function fetchAndStore({username, password}){
    if (!username || !password) throw new Error('الرجاء إدخال اسم المستخدم وكلمة المرور');
    let url;
    if (API_MODE === 'proxy'){
      url = new URL(PROXY_BASE + '/api/gso');
    } else {
      url = new URL('https://user.telecomsy.com/users/gso.php');
    }
    url.searchParams.set('userfrom_ui', username);
    url.searchParams.set('passfrom_ui', password);

    let data;
    try{
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) throw new Error('فشل الجلب: ' + res.status + ' ' + res.statusText);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')){
        // حاول مع النص كخطة بديلة
        const text = await res.text();
        try { data = JSON.parse(text); }
        catch { throw new Error('الاستجابة ليست JSON. قد يكون هناك حظر CORS أو رد غير متوقع.'); }
      } else {
        data = await res.json();
      }
    } catch (err){
      // رسائل شائعة عند CORS
      if (err instanceof TypeError){
        throw new Error('فشل الشبكة (قد يكون CORS). راجع README لتجاوز CORS عبر Proxy محلي.\nالتفاصيل: ' + err.message);
      }
      throw err;
    }

    const record = {
      timestamp: new Date().toISOString(),
      data
    };
    logs.push(record);
    if (logs.length > MAX_LOGS){
      logs = logs.slice(-MAX_LOGS);
    }
    saveLogs(logs);
    renderLatest();
    renderHistory();
    return record;
  }

  /** Handlers **/
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    setBusy(form, true);
    try{
      const rec = await fetchAndStore({username, password});
      toast('تم الجلب والتخزين بنجاح.');
      // لا نخزن بيانات الدخول
    } catch(err){
      toast(err.message || String(err), true);
    } finally {
      setBusy(form, false);
    }
  });

  testSampleBtn.addEventListener('click', () => {
    const sample = { success: true, phone: '261496@idleb.com', f_name: 'طه', l_name: 'جبيرو', online: 'y', exp: '2028-10-20', usage: '36.16 GB', pkg: '4,379.33 GB', serv: '1000 GB', limitcomb: '1', limitexpiration: '0', last_inovice: '2025-08-06' };
    const record = { timestamp: new Date().toISOString(), data: sample };
    logs.push(record);
    saveLogs(logs);
    renderLatest();
    renderHistory();
    toast('تمت إضافة مثال محلي (بدون اتصال).');
  });

  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const d = String(dt.getDate()).padStart(2,'0');
    a.href = URL.createObjectURL(blob);
    a.download = `telecom-info-logs-${y}${m}${d}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('هل أنت متأكد من مسح كل السجل؟')) return;
    logs = [];
    saveLogs(logs);
    renderLatest();
    renderHistory();
    toast('تم المسح.');
  });

  // Auto Refresh
  startAutoBtn.addEventListener('click', () => {
    const minutes = clamp(parseInt(intervalInput.value,10) || 15, 1, 1440);
    intervalInput.value = String(minutes);
    if (autoTimer) clearInterval(autoTimer);

    scheduleNext(minutes);
    autoTimer = setInterval(async () => {
      if (!usernameEl.value || !passwordEl.value){
        nextRunEl.textContent = 'أوقف: يلزم ملء بيانات الدخول';
        stopAuto();
        return;
      }
      try{
        await fetchAndStore({ username: usernameEl.value.trim(), password: passwordEl.value });
        scheduleNext(minutes);
      } catch(err){
        toast('فشل التحديث التلقائي: ' + (err.message||err), true);
        scheduleNext(minutes);
      }
    }, minutes * 60 * 1000);

    startAutoBtn.disabled = true;
    stopAutoBtn.disabled = false;
    toast('تم تشغيل التحديث التلقائي.');
  });

  stopAutoBtn.addEventListener('click', stopAuto);
  function stopAuto(){
    if (autoTimer){
      clearInterval(autoTimer);
      autoTimer = null;
    }
    nextRunEl.textContent = '';
    startAutoBtn.disabled = false;
    stopAutoBtn.disabled = true;
    toast('تم إيقاف التحديث التلقائي.');
  }

  function scheduleNext(minutes){
    nextRunAt = new Date(Date.now() + minutes*60*1000);
    nextRunEl.textContent = 'التنفيذ التالي حوالي: ' + formatDate(nextRunAt.toISOString());
  }

  // UI helpers
  function setBusy(node, busy){
    node.querySelectorAll('button, input').forEach(el => el.disabled = !!busy);
  }

  function toast(msg, isError){
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.position = 'fixed';
    div.style.bottom = '16px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.background = isError ? '#7f1d1d' : '#065f46';
    div.style.color = '#e5e7eb';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '10px';
    div.style.boxShadow = '0 6px 16px rgba(0,0,0,.35)';
    div.style.zIndex = '9999';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }

  // Initial paint
  renderLatest();
  renderHistory();
})();
