import './src/services/polyfills'; // MUST be first: fixes crypto under Hermes
import { registerRootComponent } from 'expo';
import App from './src/App';
import { useWayChainFonts } from './src/components/useWayChainFonts';

function Root() {
  useWayChainFonts(); // preload brand fonts (Playfair Display + Inter)
  return <App />;
}

registerRootComponent(Root);
