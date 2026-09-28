# مُنشئ المحافظ — Portfolio Builder

أداة ويب لبناء المحافظ الاستثمارية: تختار الصناديق وتحدد الأوزان، وتظهر لك النتائج المالية التاريخية فوراً بنفس معادلات ملف الإكسل «New Portfolios Allocation». التصميم مستوحى من هوية أبيان المالية (خط Almarai، الكحلي والأزرق المتدرج، بطاقات دائرية الحواف)، والواجهة بالعربية مع زر للإنجليزية.

A web tool for building investment portfolios: pick funds, set weights and get the historical financial results instantly, computed with the same formulas as the “New Portfolios Allocation” workbook. Arabic (RTL) first, with an English toggle.

## ما الذي تقدمه الأداة / Features

- **البناء:** 18 صندوقاً (أسهم، قطاعات، صكوك وعقار، سلع وبيتكوين)، أوزان بالنسبة المئوية أو بالمنزلق، تحقق من مجموع 100٪، تقريب لأقرب 1٪، أوزان متساوية، ومحافظ الإكسل الجاهزة (النمو الفائق 1–7، النمو 1–6) كنقطة بداية. مقارنة حتى 8 محافظ.
- **النتائج:** قيمة الاستثمار، العائد التراكمي، العائد السنوي المركب (CAGR)، التذبذب، شارب، سورتينو، أقصى تراجع وتاريخ القاع والتعافي، أفضل وأسوأ يوم، الانحراف السلبي، العوائد السنوية والشهرية، العائد المتحرك لسنة، مصفوفة الارتباط، توزيع الأوزان ومساهمة كل صندوق في العائد.
- **جودة البيانات:** نسبة البيانات الفعلية مقابل التقديرية (back-cast) لكل صندوق، وفحص «الفعلي فقط» لكل محفظة.
- **القيود:** قيود ورقة Scenario قابلة للتعديل (مجموع 100٪، أقصى صندوق، أقصى فئة، الحد الأدنى للأساس، الحد الأقصى للأصول التقديرية) مع التقدير السريع.
- **المُحسِّن:** الحد الفعّال، أعلى شارب، أقل تذبذب، حدود دنيا/عليا لكل صندوق، قيود ملف الإكسل الجاهزة، وأوزان بأعداد صحيحة — مع زر لتطبيق الأوزان.
- **الفترة والإعدادات:** كامل الفترة، 2021–2025، منذ 2022، منذ 2023، آخر 3 سنوات… أو فترة مخصصة؛ إعادة توازن يومية (مثل الإكسل) أو شهرية/ربع سنوية/سنوية/بدون؛ العائد الخالي من المخاطر؛ مبلغ الاستثمار.
- **المشاركة والحفظ:** رابط مشاركة يحمل المحافظ والإعدادات، حفظ تلقائي في المتصفح، و«مكتبة الفريق» على Firebase (اختيارية).

## مطابقة ملف الإكسل / Matching the workbook

محرك الحسابات في `src/lib/finance/` ينفذ معادلات الملف نفسها: عائد المحفظة اليومي = `SUMPRODUCT` للعوائد والأوزان (الخلايا الفارغة = 0٪)، مؤشر الثروة، `CAGR = W^(252/n) − 1`، التذبذب = `STDEV × √252`، شارب وسورتينو بالعائد الخالي من المخاطر، أقصى تراجع، وغيرها.

الملف الأصلي محفوظ بدون نتائج محسوبة، فتمت إعادة حسابه بـ LibreOffice واستخراج نتائجه إلى `tests/fixtures/excel-recalc.json`. الاختبارات (`npm test`) تقارن المحرك بها: 13 محفظة × 3 فترات × 11 مقياساً، ومصفوفة الارتباط، وتواريخ القاع، والعوائد السنوية، ومعادلات الحد الفعّال وورقة Scenario — والفرق أقل من 10⁻⁷. المُحسِّن يعطي نفس نتيجة SLSQP في الملف أو أفضل منها بقليل (شارب 1.5955 مقابل 1.5950).

The engine is verified against a LibreOffice recalculation of the workbook (58 tests, all metrics within 1e-7).

### ملاحظات على ملف المصدر / Notes on the source workbook

- أوزان «النمو 6» مجموعها 95٪، فالباقي يبقى نقداً بعائد 0٪ (الأداة تعرض تنبيهاً بذلك).
- نطاقات «العائد المتحرك لسنة» في Risk Dashboard غير متطابقة الطول (`W257:W2669` ÷ `W5:W2391`)؛ الأداة تحسب كل النوافذ الـ252 يوماً بشكل صحيح.
- بعض الأوراق (Risk Dashboard، Reliability، إثبات نمو المحفظة) تتوقف عند الصف 2669 (13 أغسطس 2026) بينما البيانات تصل إلى 25 سبتمبر 2026؛ الأداة تستخدم كل البيانات.
- في ورقة Growth عنوان «2021 to end-2025» يبدأ فعلياً من 2020-01-01، و«2022 to Today» من 2023-01-01.
- ورقة Summary قيم ثابتة (ليست معادلات) تختلف قليلاً عن البيانات الحالية؛ الأداة تحسب إحصاءات الصناديق مباشرة من العوائد اليومية.

## التشغيل محلياً / Local development

```bash
npm install
npm run dev          # http://localhost:3000 → /ar
npm run check        # lint + typecheck + tests
npm run build
```

## تحديث البيانات / Updating the data

```bash
pip install openpyxl
npm run data:import -- path/to/New_Portfolios_Allocation.xlsx
```

السكربت يقرأ `Daily Returns (Total)` و`Summary` و`Methodology` وأوزان `Ultra Growth` و`Growth`، ويكتب `src/data/generated/universe.json` و`public/data/returns.<hash>.json`. **لا يُرفع ملف الإكسل للمستودع** (المستودع عام والملف فيه ملاحظات داخلية) — `.gitignore` يمنع ذلك.

To refresh the test fixtures after a data update: `python3 scripts/recalc_with_libreoffice.py book.xlsx recalc.xlsx && python3 scripts/make_test_fixtures.py recalc.xlsx`.

## النشر / Deployment

Frontend on **Vercel**, optional backend on **Firebase** (Firestore + anonymous auth for the team library). One command sets everything up and deploys:

```bash
export VERCEL_TOKEN=...                               # vercel.com/account/tokens
export PORTFOLIO_FIREBASE_SERVICE_ACCOUNT="$(cat key.json)"  # optional, dedicated Firebase project
npm run deploy                                        # add --dry-run to preview
```

The script (idempotent) enables the Firebase APIs, registers the web app, creates Firestore (`me-central2` by default), deploys `firestore.rules`, enables anonymous sign-in, creates the Vercel project (linking the GitHub repo when the Vercel GitHub app is installed), sets the `NEXT_PUBLIC_FIREBASE_*` variables, deploys to production and authorises the Vercel domain in Firebase Auth. Without Firebase credentials the site deploys without the team library; everything else runs in the browser.

The service account needs the **Editor** role on its project (to create the database and publish rules).

## البنية / Structure

```
src/lib/finance/     calculation engine (backtest, metrics, stats, reliability, constraints, optimizer)
src/components/      builder, results tabs, charts, optimizer, site chrome
src/i18n/            Arabic / English dictionaries
src/data/            asset metadata (bilingual) + generated data from the workbook
public/data/         daily returns (content-hashed, cached forever)
scripts/             Excel import, LibreOffice recalculation, fixtures, deploy
tests/               engine tests against the recalculated workbook
```

الأداء السابق لا يضمن النتائج المستقبلية. النتائج محاكاة تاريخية تشمل بيانات تقديرية قبل تأسيس بعض الصناديق، وليست توصية استثمارية.
