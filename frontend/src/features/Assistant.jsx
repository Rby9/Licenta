import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import AiConversation from './assistant/AiConversation';
import './assistant/assistant.css';

export default function Assistant() {
  const { pathname } = useLocation();
  const { utilizator } = useSession();
  const publicPage = pathname === '/' || /^\/hoteluri(?:\/\d+)?\/?$/.test(pathname);
  return publicPage ? <AssistantWidget key={utilizator?.id_utilizator || utilizator?.id || 'guest'}
    owner={utilizator?.id_utilizator || utilizator?.id || 'guest'} /> : null;
}

function AssistantWidget({ owner }) {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState('ro');
  const [expanded, setExpanded] = useState(true);
  const launcherRef = useRef(null);
  function close() {
    setIsOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  }
  return <div className="hotel-assistant">
    <button ref={launcherRef} type="button" className="assistant-launcher" aria-expanded={isOpen}
      aria-controls="hotel-assistant-panel" onClick={() => isOpen ? close() : setIsOpen(true)}>
      {language === 'en' ? (isOpen ? 'Close assistant' : 'Hotel assistant') : (isOpen ? 'Închide asistentul' : 'Asistent hoteluri')}
    </button>
    <section hidden={!isOpen} tabIndex={-1} id="hotel-assistant-panel" className={`assistant-panel${expanded ? ' assistant-panel-expanded' : ''}`} title={language === 'en' ? (expanded ? 'Expanded assistant' : 'Compact assistant') : (expanded ? 'Asistent extins' : 'Asistent compact')}
      lang={language} role="dialog" aria-label={language === 'en' ? 'HoteluriRo Assistant' : 'Asistent HoteluriRo'} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <AiConversation active={isOpen} onClose={close} owner={owner}
        onLanguageChange={setLanguage} expanded={expanded} onToggleSize={() => setExpanded(value => !value)} />
    </section>
  </div>;
}
