-- Date sintetice pentru demonstrație. Se importă numai împreună cu o schemă nouă.
INSERT INTO Orase (id_oras,nume_oras) VALUES (1,'Brașov');
INSERT INTO Hoteluri (id_hotel,id_oras,nume_hotel,adresa,stele,descriere,latitudine,longitudine)
VALUES (1,1,'Hotel Demo','Adresă demonstrativă',4,'Hotel fictiv pentru testarea aplicației.',45.6579,25.6012);
INSERT INTO Categorii_Camere (id_categorie,id_hotel,denumire,capacitate,pret_pe_noapte,descriere)
VALUES (1,1,'Cameră dublă',2,250.00,'Categorie demonstrativă');
INSERT INTO Camere (id_categorie,numar_camera) VALUES (1,'101'),(1,'102');
INSERT INTO Facilitati (id_facilitate,nume,icon,categorie) VALUES (1,'Wi-Fi','◈','servicii');
INSERT INTO Hoteluri_Facilitati (id_hotel,id_facilitate) VALUES (1,1);
