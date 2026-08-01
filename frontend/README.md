# HoteluriRo

Platformă web full-stack de rezervări hoteliere, dezvoltată ca proiect de licență la Facultatea de Automatică, Calculatoare, Inginerie Electrică și Electronică, Universitatea "Dunărea de Jos" din Galați.

## Despre proiect

HoteluriRo este o aplicație de rezervare hotelieră gândită pentru piața din România, care permite utilizatorilor să caute și să rezerve camere de hotel, iar administratorilor să gestioneze disponibilitatea și rezervările în timp real.

## Funcționalități

- Sistem securizat de autentificare pentru utilizatori și administratori
- Vizualizarea disponibilității camerelor în timp real
- Bază de date optimizată pentru a preveni suprapunerea rezervărilor
- API RESTful pentru toată logica de backend
- Interfață responsive, adaptată pentru desktop și mobil

## Tehnologii folosite

**Frontend:** React 19, Vite

**Backend:** Node.js, Express 5

**Bază de date:** MySQL

## Structura proiectului

```
Licenta/
├── backend/
│   ├── fonts/
│   ├── migratii/
│   ├── uploads/
│   ├── server.js
│   └── package.json
└── frontend/
    ├── public/
    └── src/
        ├── assets/
        ├── components/
        ├── pages/
        ├── App.jsx
        └── main.jsx
```

## Instalare și rulare locală

Clonează repository-ul:

```bash
git clone https://github.com/Rby9/Licenta.git
cd Licenta
```

Instalează dependențele pentru backend:

```bash
cd backend
npm install
npm start
```

Instalează dependențele pentru frontend:

```bash
cd frontend
npm install
npm run dev
```

## Autor

**Robert-Andrei Balaban**
Inginerie Calculatoare, UGAL
Coordonator: Conf. Dr. Ing. Munteanu Dan
