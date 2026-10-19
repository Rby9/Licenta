import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function LocationMarker({ position, onChange }) {
  const map = useMapEvents({
    click(event) { onChange(event.latlng); },
    keypress(event) { if (event.originalEvent.key === 'Enter') onChange(map.getCenter()); },
  });
  return position ? <CircleMarker center={position} radius={9} pathOptions={{ color: '#9b7d42', fillColor: '#c4a050', fillOpacity: .9 }} /> : null;
}

export default function HotelLocationPicker({ value, onChange }) {
  const hasPosition = value.latitudine != null && value.latitudine !== '' && value.longitudine != null && value.longitudine !== '';
  const position = hasPosition ? [Number(value.latitudine), Number(value.longitudine)] : null;
  return (
    <div className="hotel-location-picker" role="group" aria-label="Poziția hotelului pe hartă">
      <p style={{ fontSize: '.8rem', lineHeight: 1.6, marginBottom: 10 }}>Alege poziția hotelului printr-un click pe hartă. Pentru tastatură, deplasează harta și apasă Enter.</p>
      <MapContainer center={position || [45.94, 24.96]} zoom={position ? 13 : 6} scrollWheelZoom={false} style={{ height: 260, width: '100%' }}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <LocationMarker position={position} onChange={onChange} />
      </MapContainer>
      <div className="coordinate-fields">
        <label>Latitudine<input aria-label="Latitudine" value={value.latitudine ?? ''} readOnly /></label>
        <label>Longitudine<input aria-label="Longitudine" value={value.longitudine ?? ''} readOnly /></label>
      </div>
    </div>
  );
}
