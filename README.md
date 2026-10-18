# HoteluriRo

Aplicație web pentru căutarea hotelurilor și gestionarea rezervărilor hoteliere din România.

## Funcționalități

- Catalog de hoteluri cu filtre după oraș, stele, preț, facilități și perioadă.
- Hartă interactivă cu Leaflet și OpenStreetMap.
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

Scripturile din `backend/migratii/` modifică schema sau datele și nu trebuie rulate automat la pornire. Necesită verificare și backup înainte de utilizare.

## Verificări

```sh
npm test --prefix backend
TEST_MYSQL=1 npm test --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

Testele obișnuite folosesc baze simulate, un transport email fals și un client Stripe simulat. Semnăturile webhook sunt verificate cu SDK-ul Stripe, fără apeluri de rețea către procesator.

`TEST_MYSQL=1` activează verificările SQL și integrarea tranzacțională. Suita creează o bază temporară `hoteluriro_test_<aleator>`, importă schema și date sintetice, apoi o șterge. Contul MySQL de test trebuie să aibă drepturi `CREATE DATABASE` și `DROP DATABASE`. Testele nu scriu în baza aplicației. Sunt verificate suprapunerile, concurența, confirmările duplicate, reducerile, rollback-ul și inițializarea de la zero.

Testele HTTP folosesc porturi temporare locale. PDF-ul este verificat inclusiv pentru diacritice și accesul proprietarului. Testele nu înlocuiesc verificarea manuală a Stripe și Gmail cu propriile conturi de test. Buildul frontend trece, cu avertismentul de dimensiune a bundle-ului; lintul frontend are probleme existente.

## Documentație tehnică

- [Arhitectură, structură și limitări](docs/STRUCTURA.md)
- [Modelul bazei de date](docs/BAZA-DE-DATE.md)
