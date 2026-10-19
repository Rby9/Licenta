import { useState } from 'react';
import placeholder from '../assets/hotel-placeholder.svg';

export default function HotelImage({ src, alt, fallback = placeholder, ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  const resolved = !src || failedSource === src ? fallback : src;
  return <img {...props} src={resolved} alt={alt} onError={() => {
    if (resolved !== fallback) setFailedSource(src);
  }} />;
}
