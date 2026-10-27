# HoteluriRo

Aplicație web pentru căutarea hotelurilor și gestionarea rezervărilor hoteliere din România.

Proiectul a fost realizat inițial pentru lucrarea de licență. Versiunea acelei etape este păstrată în tagul [licenta-v1.0](https://github.com/Rby9/Licenta/tree/licenta-v1.0). Dezvoltarea ulterioară continuă ca proiect personal, începând cu integrarea asistentului AI pentru explorarea catalogului și pregătirea rezervărilor.

## Funcționalități

- Catalog de hoteluri cu filtre după oraș, stele, preț, facilități și perioadă.
- Hartă interactivă cu Leaflet și OpenStreetMap.
- Asistent de căutare cu conversație AI opțională prin Groq și criterii presetate în aceeași conversație: întrebări despre orașe, hoteluri, facilități și categorii, extragerea criteriilor din text, rezumat de confirmat, rezultate disponibile și informații despre plată, anulare și rambursare.
- Pagini de hotel cu galerii foto, categorii de camere, disponibilitate și recenzii.
- Conturi de utilizator, autentificare JWT și resetarea parolei.
- Rezervări, integrare Stripe, notificări email și generare de documente PDF.
- Panou de administrare cu acces pe roluri pentru hoteluri, rezervări, utilizatori și oferte.

## Tehnologii

| Componentă | Tehnologii |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, React Leaflet |
| Backend | Node.js, Express 5, mysql2 |
| Bază de date | MySQL, InnoDB |
| Integrări | Stripe, Nodemailer, PDFKit, Multer |

## Rulare locală

Sunt necesare Node.js compatibil cu Vite 8, npm și MySQL 8. Schema completă și datele demonstrative sunt în `backend/database/`. Instalarea pe o bază nouă este descrisă mai jos; baza existentă nu trebuie reinițializată.

Instalează dependențele din rădăcina proiectului:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

La prima configurare, copiază șablonul public, apoi completează valorile în `backend/.env`. Comanda păstrează un fișier `.env` care există deja:

```sh
cp -n backend/.env.example backend/.env
```

Șablonul conține doar exemple. Completează următoarele variabile cu propriile setări:

| Variabile | Utilizare |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexiunea MySQL |
| `JWT_SECRET` | Semnarea și verificarea tokenurilor |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Opționale: Stripe în modul de test și semnarea webhook-ului |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Autentificarea și expeditorul emailurilor |
| `HOST`, `PORT`, `SITE_URL` | Adresa API și adresa frontendului folosită pentru linkuri și redirecturi |

Configurația privată nu se publică; doar `.env.example` este inclus în Git. Valorile din șablon nu permit conectarea la servicii fără configurare. API-ul poate porni fără Stripe; rutele de plată răspund cu 503 până la configurare. Emailurile necesită configurarea contului Gmail. Nu folosi chei de producție pentru dezvoltare.

Pornește backendul și frontendul în terminale separate:

```sh
npm start --prefix backend
```

```sh
npm run dev --prefix frontend
```

Aplicația este disponibilă la **http://localhost:5173**. API-ul rulează pe **http://127.0.0.1:5001**. În dezvoltare, Vite redirecționează cererile `/api` și `/uploads` către backend.

## Configurarea opțională a asistentului AI

Adaugă în `backend/.env` cheia privată `GROQ_API_KEY` creată în Groq Console și, opțional, `GROQ_MODEL` (implicit `qwen/qwen3.8-27b`, model cu ieșire JSON structurată). Repornește backendul după schimbarea configurației. Cheia nu se introduce în frontend, în conversație sau în Git. Integrarea folosește `fetch` din Node.js, fără un serviciu Python sau SDK suplimentar.

Conversațiile noi încep în română. Mesajele în engleză schimbă răspunsurile și interfața asistentului în engleză; răspunsurile scurte sau numele de orașe păstrează limba curentă. Limba este păstrată în istoricul local. Descrierile și denumirile hotelurilor rămân în limba originală din catalog.

AI-ul extrage criteriile din conversație; backendul validează orașul, perioada, persoanele și sensul bugetului. Conversația este trimisă către Groq doar la trimiterea unui mesaj AI și nu este salvată în MySQL. Panoul se deschide pe toată înălțimea din dreapta (aproximativ un sfert din lățimea desktopului, cu lățime minimă lizibilă), poate fi micșorat, iar istoricul și criteriile au vederi separate. Ultimele zece conversații sunt păstrate în localStorage, separat pentru contul curent sau vizitator, cu opțiune de ștergere din panou. Istoricul nu se sincronizează între dispozitive. La reluare, rezultatele sunt căutate din nou. Nu introduce date personale, parole sau date de card. Limitele planului și politica de date trebuie verificate în propriul cont Groq.

Fără cheie sau în cazul unei erori, criteriile pot fi completate în același panou, fără o interfață separată. Presetele sunt validate de backend fără apel la model. Întrebările uzuale despre catalog sunt recunoscute direct, iar formulările suplimentare pot fi interpretate de AI. Informațiile despre orașe, hoteluri, facilități și categorii provin din interogări SELECT; prețurile de catalog nu confirmă disponibilitatea unui sejur. AI-ul nu execută SQL, nu modifică rezervări și nu procesează plăți. Căutarea integrată acceptă momentan numai adulți într-o singură cameră comună. Solicitările cu copii sau camere multiple sunt recunoscute în rezumat, dar nu sunt trimise către checkout-ul actual, care gestionează o singură cameră. Răspunsurile despre plată/anulare/rambursare sunt controlate de aplicație. După căutare se alege hotelul și o categorie disponibilă, apoi se deschide checkout-ul cu hotelul, categoria, perioada și persoanele completate. Sumarul precizează că este rezervată o singură cameră; plata este confirmată separat de utilizator.

Testele AI folosesc un furnizor simulat și nu consumă cota Groq. Calitatea modelului în română și disponibilitatea contului necesită o verificare separată cu cheia proprie.

## Inițializarea unei baze noi

Setează `DB_NAME` în configurația locală pentru baza dorită, apoi rulează:

```sh
npm run db:init --prefix backend -- --confirm-empty-database --demo
```

Comanda creează schema și un hotel cu camere demonstrative, fără utilizatori sau parole prestabilite. Omite `--demo` pentru schema goală. Utilizatorul MySQL trebuie să aibă drepturile necesare pentru creare. **Dacă baza conține deja tabele, comanda refuză inițializarea.** Nu este un utilitar de migrare a bazei existente.

## Plăți în dezvoltare

Configurează Stripe în modul de test și endpointul `POST /api/plati/webhook` pentru evenimentele `checkout.session.completed` și `checkout.session.async_payment_succeeded`. Completează `STRIPE_WEBHOOK_SECRET` cu secretul de semnare al endpointului. La dezvoltarea locală este necesară redirecționarea evenimentelor Stripe către serverul local.

Totalul și avansul sunt calculate de backend. Confirmarea verifică utilizatorul, suma, moneda și starea plății. Webhook-ul permite confirmarea fără revenirea browserului. Dacă disponibilitatea sau limita reducerii se schimbă în timpul plății, confirmarea inițiază rambursarea în loc să creeze o rezervare suprapusă. Anularea ulterioară a unei rezervări nu inițiază automat rambursarea.

## Administrare locală

Pentru crearea unui administrator, rulează într-un terminal interactiv:

```sh
node backend/creeaza_admin.js
```

Utilitarul cere numele, emailul, unul dintre rolurile `super_admin`, `admin_hotel`, `admin_booking` sau `admin_marketing` și parola, introdusă fără afișare. Nu există conturi sau parole prestabilite. După confirmare, creează un singur cont în baza configurată prin `backend/.env`; conturile existente nu sunt modificate. Parola este stocată ca hash bcrypt.

La adăugarea unui hotel se alege poziția prin click pe hartă; coordonatele sunt salvate în câmpurile existente. Hotelul apare pe hartă după salvare. La crearea unei categorii se indică și numărul camerelor, create în aceeași tranzacție; apoi hotelul poate fi rezervat. Ștergerea hotelurilor și categoriilor cu rezervări este blocată pentru păstrarea istoricului.

Fotografiile demonstrative sunt generate și păstrate local; se pot reutiliza sau înlocui din administrare cu un URL propriu ori un fișier încărcat. Camerele au un interior demonstrativ separat, fără asociere cu o cameră reală.

Scripturile din `backend/migratii/` modifică schema sau datele și nu trebuie rulate automat la pornire. Necesită verificare și backup înainte de utilizare.

## Verificări

```sh
npm test --prefix frontend
npm run test:e2e --prefix frontend
TEST_MYSQL=1 npm run test:e2e --prefix frontend
npm test --prefix backend
TEST_MYSQL=1 npm test --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

Testele unitare frontend verifică gestionarea răspunsurilor API, sesiunea locală, redarea secțiunilor administrative, paginarea, graficele și descărcarea PDF. Acestea rulează cu Node și Vite, fără browser sau servicii externe.

Testele Playwright (`test:e2e`) folosesc Google Chrome instalat local, în mod headless și cu profil temporar. Verifică pagini la 390, 768 și 1440 px, derularea hărților, meniurile pe roluri, formularele și salvarea la dublu click. Testele obișnuite simulează cererile API și nu scriu în MySQL. Cu `TEST_MYSQL=1` se activează și un flux complet de administrare în browser, conectat la backendul real și o bază temporară `hoteluriro_test_e2e_<aleator>`. Acesta verifică autentificarea, crearea și editarea hotelului cu păstrarea coordonatelor, inventarul camerelor, uploadul unei imagini, rezervarea afișată în profil, descărcarea PDF-ului și protejarea istoricului rezervărilor. Imaginile încărcate de teste sunt stocate într-un director temporar, curățat la final. Baza temporară se șterge la final; baza aplicației nu este modificată. Stripe și transportul de email rămân simulate. Vite pornește pe 5173 dacă nu există deja o instanță locală. Rezultatele testelor de browser sunt excluse din Git.

Testele backend obișnuite folosesc baze simulate, un transport email fals și un client Stripe simulat. Uploadurile sunt verificate pentru fișiere simultane distincte, extensii permise, limita de 5 MB și autentificare, fără scriere în directorul de imagini al aplicației. Semnăturile webhook sunt verificate cu SDK-ul Stripe, fără apeluri de rețea către procesator.

`TEST_MYSQL=1` activează verificările SQL și integrarea tranzacțională. Suita creează o bază temporară `hoteluriro_test_<aleator>`, importă schema și date sintetice, apoi o șterge. Contul MySQL de test trebuie să aibă drepturi `CREATE DATABASE` și `DROP DATABASE`. Testele nu scriu în baza aplicației. Sunt verificate suprapunerile, concurența, confirmările duplicate, reducerile, rollback-ul și inițializarea de la zero.

Testele HTTP folosesc porturi temporare locale. PDF-ul este verificat inclusiv pentru diacritice și accesul proprietarului. Testele nu înlocuiesc verificarea manuală a Stripe și Gmail cu propriile conturi de test. Frontendul se încarcă pe pagini prin importuri dinamice. Buildul și lintul trec; testele de redare nu înlocuiesc verificarea vizuală și interacțiunile într-un browser.

## Documentație tehnică

- [Arhitectură, structură și limitări](docs/STRUCTURA.md)
- [Modelul bazei de date](docs/BAZA-DE-DATE.md)
