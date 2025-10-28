# Telecom Info Logger (LocalStorage)

واجهة بسيطة (HTML + JS) لجلب بيانات المستخدم من: 

```
https://user.telecomsy.com/users/gso.php?userfrom_ui=<EMAIL>&passfrom_ui=<PASSWORD>
```

وتخزين النتيجة محليًا في LocalStorage مع ختم زمني في كل مرة يتم فيها الجلب.

## كيف أستخدمه؟

1. افتح الملف `index.html` مباشرة في المتصفح (يفضل Chrome/Edge). لا حاجة لتثبيت أي شيء.
2. أدخل البريد وكلمة المرور.
3. اضغط "جلب وتخزين الآن". سترى "آخر نتيجة"، وسيتم إضافة سجل جديد في الأسفل.
4. يمكنك:
   - تشغيل "التحديث التلقائي" كل X دقائق.
   - تصدير السجل (JSON) بزر "تصدير JSON".
   - مسح السجل بالكامل بزر "مسح السجل".

> حماية خصوصيتك: لا نخزن اسم المستخدم أو كلمة المرور في LocalStorage. فقط نتيجة الاستجابة مع وقت الجلب.

## ملاحظات مهمة عن CORS
عند فتح `index.html` كملف محلي والاتصال بموقع خارجي، قد يمنع المتصفح الطلبات بسبب CORS.
إذا ظهرت رسالة خطأ مشابهة لـ "Network error (CORS)", لديك خياران:

- سريع وبسيط: جرّب فتح الصفحة عبر خادم محلي بسيط (قد يساعد في بعض السيناريوهات، لكنه لا يحل CORS إن كان السيرفر لا يسمح). مثال: استخدم أي أداة لخدمة مجلد كويب سيرفر محلي.
- الحل المضمون: استخدام Proxy محلي (سيرفر صغير) يقوم بالجلب من `telecomsy.com` ثم يعيد نتيجته للمتصفح. بهذه الطريقة، المتصفح يتصل بخادمك المحلي فقط، وCORS لا يطبق على اتصالك من الخادم إلى TelecomSY.

### فكرة Proxy (اختيارية)
لو أردت، يمكنك إنشاء خادم صغير بـ ASP.NET Core أو Node.js يقوم بالآتي:
- يستقبل طلب GET إلى `/api/gso?userfrom_ui=..&passfrom_ui=..`
- يجلب داخليًا من `https://user.telecomsy.com/users/gso.php?...`
- يعيد نفس JSON مع ترويسة CORS مسموحة `Access-Control-Allow-Origin: *`

ثم غيّر كود `app.js` ليوجه الطلب إلى خادمك المحلي بدلًا من الدومين الخارجي.

> هذا المشروع الحالي لا يحتاج Backend — هو يعمل مباشرة من المتصفح — لكن إن واجهت CORS، فالـ Proxy هو الحل المضمون.

## البنية والتخزين
- المفتاح المستخدم في LocalStorage: `telecomInfoLogs`
- الشكل المخزن:

```json
[
  {
    "timestamp": "2025-10-29T09:35:12.000Z",
    "data": {
      "success": true,
      "phone": "261496@idleb.com",
      "f_name": "طه",
      "l_name": "جبيرو",
      "online": "y",
      "exp": "2028-10-20",
      "usage": "36.16 GB",
      "pkg": "4,379.33 GB",
      "serv": "1000 GB",
      "limitcomb": "1",
      "limitexpiration": "0",
      "last_inovice": "2025-08-06"
    }
  }
]
```

## أسئلة شائعة
- هل تُخزن كلمة المرور؟ لا. لا نخزن سوى نتيجة الاستجابة ووقت الجلب.
- كيف أفرغ السجل؟ استخدم زر "مسح السجل".
- كيف أحفظ نسخة؟ استخدم زر "تصدير JSON".

## English (short)
Small static HTML+JS app to GET the gso.php endpoint and store each response in localStorage with a timestamp. If CORS blocks the request, use a local proxy (ASP.NET Core or Node) that fetches the remote URL and returns JSON with permissive CORS.

## تشغيل Proxy محلي (ASP.NET Core)
للتغلب على مشكلة CORS بشكل مضمون، أضفت خادماً محلياً بسيطاً بـ ASP.NET Core داخل المجلد `proxy-aspnet`.

1) تأكد من تثبيت .NET 8 SDK.

2) من PowerShell (pwsh) يمكنك تشغيل أحد الخيارين:

```powershell
# الخيار A: من الجذر (هذا المجلد)
./run-proxy.ps1

# الخيار B: من داخل مجلد المشروع
cd proxy-aspnet
dotnet restore
dotnet run
```

سيعمل الخادم على: `http://localhost:5080`

3) الواجهة الأمامية (`app.js`) مضبوطه على الوضع `proxy` افتراضياً:

- `API_MODE = 'proxy'`
- `PROXY_BASE = 'http://localhost:5080'`

بالتالي لن ترى خطأ CORS، وسيتم الجلب عبر مسار: `GET /api/gso?userfrom_ui=...&passfrom_ui=...`

إذا رغبت بالاتصال المباشر (بدون Proxy)، غيّر `API_MODE` إلى `'direct'` في `app.js`، مع العلم أنه قد يفشل بسبب CORS عند الفتح محلياً.
