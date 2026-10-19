import modern from '../assets/demo/hotel-modern.jpg';
import mountain from '../assets/demo/hotel-mountain.jpg';
import boutique from '../assets/demo/hotel-boutique.jpg';
import room from '../assets/demo/room-standard.jpg';

export const hotelDemoImages = [modern, boutique, mountain];
export const demoImageChoices = { modern, boutique, mountain };
export const roomDemoImage = room;
export const demoImageNote = 'Imagine demonstrativă generată';

export function demoHotelImage(hotel = {}) {
  const id = Number(hotel.id_hotel) || 0;
  return hotelDemoImages[Math.abs(id) % hotelDemoImages.length];
}

// Legacy stock URLs receive a stable local illustration. Custom admin uploads/URLs win.
export function hotelCover(hotel = {}) {
  const original = hotel.imagine_url;
  if (original?.startsWith('demo:')) return demoImageChoices[original.slice(5)] || demoHotelImage(hotel);
  return !original || /^https?:\/\/images\.unsplash\.com\//.test(original) ? demoHotelImage(hotel) : original;
}

export function usesDemoImage(hotel = {}) {
  return !hotel.imagine_url || hotel.imagine_url.startsWith('demo:') || /^https?:\/\/images\.unsplash\.com\//.test(hotel.imagine_url);
}
