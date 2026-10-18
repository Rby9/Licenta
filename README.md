# HoteluriRo — pornire locală pe Mac

MySQL trebuie să ruleze, cu baza existentă `licenta_booking` importată.
Configurația privată este în `backend/.env`; nu o publicați.

Din directorul proiectului, în două terminale:

```sh
npm start --prefix backend
```

```sh
npm run dev --prefix frontend
```

Deschideți http://localhost:5173. Backendul ascultă doar local, pe 127.0.0.1:5001.
AirPlay poate folosi în continuare 5000. Vite trimite `/api` și `/uploads` către backend.
Adresa API comună este în `frontend/src/api.js`; configurația proxy în `frontend/vite.config.js`.
După schimbarea proxy-ului, reporniți Vite dacă nu se repornește automat.

Verificare:

```sh
curl http://127.0.0.1:5001/api/orase
curl http://localhost:5173/api/orase
npm run build --prefix frontend
```

Nu rulați scripturile de migrare sau creare administratori pentru simpla pornire.
URL-urile istorice ale imaginilor locale sunt adaptate în răspunsurile JSON, fără modificări în MySQL.
Fișierele `.env` și `.env.*` sunt ignorate, cu excepția `.env.example`.
Directorul primit nu conține `.git`, deci nu există aici un istoric Git de verificat.

## Analiză inițială și pași următori

- Backendul are aproximativ 1.700 de linii într-un singur server. Separați configurația, conexiunea DB, middleware-urile, rutele și serviciile pe domenii: hoteluri, disponibilitate, rezervări, autentificare, plăți, administrare.
- Dashboardul admin are peste 2.100 de linii, pagina de detalii peste 1.100. Extrageți secțiuni și hook-uri; păstrați schimbările de structură separate de schimbările funcționale.
- Buildul trece, dar bundle-ul principal depășește 500 kB. Încărcarea paginilor la cerere poate reduce dimensiunea inițială.
- ESLint raportează 34 de erori și 7 avertismente existente; remediați-le etapizat înaintea unei reorganizări ample.
- Unele scripturi auxiliare au configurație de conectare hardcodată. Mutați-o în variabile de mediu înainte de folosire sau publicarea codului.
- Disponibilitatea există deja în API. Calculul per categorie scade numărul rezervărilor, nu numărul camerelor distincte ocupate; trebuie revizuit pentru rezervări multiple în interval și camere inactive.
- Revizuiți calculul prețului pe server și rezervarea atomică a camerei înainte de extinderea fluxului de plată.

## Chatbot propus

Prima variantă poate fi un asistent conversațional local cu hotel/oraș, check-in, check-out și număr de persoane. Interoghează serviciul comun de disponibilitate și afișează camere libere plus link către cazare. Nu necesită un model AI pentru această primă etapă. Verificați întâi corectitudinea disponibilității și validați datele calendaristice; răspunsurile trebuie calculate din DB la fiecare cerere. Rezervarea propriu-zisă va reverifica disponibilitatea. Chatbotul nu este încă implementat.
