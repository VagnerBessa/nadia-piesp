import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Box, CircularProgress, Typography, Stack } from '@mui/material';
import { GOOGLE_MAPS_API_KEY } from '../config';

// --- CONFIGURAÇÃO DO MAPA ---
// Um Map ID é OBRIGATÓRIO para ativar a renderização vetorial (WebGL) e prédios 3D.
const MAP_ID: string = 'bf51a910020fa25a'; 

interface GoogleMaps3DViewProps {
  locationQuery: string;
}

export interface MapHandles {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface Telemetry {
    lat: string;
    lng: string;
    zoom: string;
    heading: string;
    tilt: string;
}

let googleMapsLoadingPromise: Promise<void> | null = null;

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  if (googleMapsLoadingPromise) return googleMapsLoadingPromise;

  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return;

    if ((window as any).google?.maps?.importLibrary) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`) as HTMLScriptElement;
    if (existingScript) {
        resolve();
        return;
    }

    (window as any).initGoogleMapsCallback = () => {
        resolve();
    };

    const script = document.createElement('script');
    let src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,geocoding,places,marker,maps3d&loading=async&v=weekly&callback=initGoogleMapsCallback`;
    
    if (MAP_ID && MAP_ID.trim() !== '') {
        src += `&map_ids=${MAP_ID}`;
    }

    script.src = src;
    script.async = true;
    script.defer = true;
    script.onerror = (e) => {
        console.error("Script load error:", e);
        reject(new Error("Falha ao carregar o script do Google Maps."));
        googleMapsLoadingPromise = null;
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadingPromise;
};

const GoogleMaps3DView = forwardRef<MapHandles, GoogleMaps3DViewProps>(({ locationQuery }, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Controls the "Warp" overlay visibility
  const [isWarping, setIsWarping] = useState(false);
  const [warpStage, setWarpStage] = useState<'idle' | 'masking' | 'teleporting' | 'revealing'>('idle');

  // Telemetry Data for HUD
  const [telemetry, setTelemetry] = useState<Telemetry>({ lat: '00.0000', lng: '00.0000', zoom: '00', heading: '000', tilt: '00' });

  const previousLocationRef = useRef<string>("");
  const isMountedRef = useRef(true);
  const animationFrameRef = useRef<number | null>(null);
  const orbitFrameRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapInstanceRef.current) {
        const currentZoom = mapInstanceRef.current.getZoom();
        mapInstanceRef.current.setZoom(currentZoom + 1);
      }
    },
    zoomOut: () => {
       if (mapInstanceRef.current) {
        const currentZoom = mapInstanceRef.current.getZoom();
        mapInstanceRef.current.setZoom(currentZoom - 1);
      }
    }
  }));

  // Easing function for smooth landing
  const easeOutQuart = (x: number): number => {
      return 1 - Math.pow(1 - x, 4);
  };

  /**
   * UPDATE TELEMETRY
   */
  const updateTelemetry = () => {
      if(mapInstanceRef.current) {
          const center = mapInstanceRef.current.getCenter();
          // Check if center is defined before accessing its methods
          if (!center) {
              console.warn('[GoogleMaps3D] Center not yet available');
              return;
          }

          setTelemetry({
              lat: center.lat().toFixed(4),
              lng: center.lng().toFixed(4),
              zoom: mapInstanceRef.current.getZoom()?.toFixed(1) || '0',
              heading: Math.round(mapInstanceRef.current.getHeading() || 0).toString().padStart(3, '0'),
              tilt: Math.round(mapInstanceRef.current.getTilt() || 0).toString().padStart(2, '0')
          });
      }
  };

  /**
   * ORBIT ANIMATION
   */
  const startOrbiting = (map: any) => {
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
      
      const animateOrbit = () => {
          if (!isUserInteractingRef.current && map) {
              const currentHeading = map.getHeading() || 0;
              const newHeading = (currentHeading + 0.1) % 360; // Slightly slower for more cinematic feel
              
              map.moveCamera({
                  heading: newHeading
              });
              
              // Telemetry updates automatically via listener, but visual smoothness helps
              orbitFrameRef.current = requestAnimationFrame(animateOrbit);
          }
      };

      orbitFrameRef.current = requestAnimationFrame(animateOrbit);
  };

  /**
   * PERFORMS THE "WARP JUMP"
   */
  const performWarpAndLand = async (map: any, targetLocation: any) => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
      
      const google = (window as any).google;

      setIsWarping(true);
      setWarpStage('masking');

      await new Promise(r => setTimeout(r, 800));

      setWarpStage('teleporting');
      
      map.moveCamera({
          center: targetLocation,
          zoom: 13,
          tilt: 0,
          heading: 0
      });

      await new Promise(r => setTimeout(r, 1200));

      setWarpStage('revealing');
      
      const START_ZOOM = 13;
      const TARGET_ZOOM = 17.5;
      const START_TILT = 45;
      const TARGET_TILT = 67.5;
      const DURATION = 4000;

      let startTime: number | null = null;

      const animateLanding = (currentTime: number) => {
          if (!startTime) startTime = currentTime;
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / DURATION, 1);
          const ease = easeOutQuart(progress);

          const currentZoom = START_ZOOM + (TARGET_ZOOM - START_ZOOM) * ease;
          const currentTilt = START_TILT + (TARGET_TILT - START_TILT) * ease;
          const currentHeading = ease * 120; 

          map.moveCamera({
              center: targetLocation,
              zoom: currentZoom,
              tilt: currentTilt,
              heading: currentHeading
          });

          if (progress < 1) {
              animationFrameRef.current = requestAnimationFrame(animateLanding);
          } else {
               setIsWarping(false);
               setWarpStage('idle');
               
               if (markerRef.current) markerRef.current.setMap(null);
               markerRef.current = new google.maps.Marker({
                  map,
                  position: targetLocation,
                  animation: google.maps.Animation.DROP
              });

              isUserInteractingRef.current = false; 
              startOrbiting(map);
          }
      };
      
      animationFrameRef.current = requestAnimationFrame(animateLanding);
  };

  useEffect(() => {
    isMountedRef.current = true;

    const initMap = async () => {
      const apiKey = GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.trim() : "";
      if (!apiKey) {
          if (isMountedRef.current) {
            setError("Chave de API não encontrada.");
            setIsLoading(false);
          }
          return;
      }

      try {
        await loadGoogleMapsScript(apiKey);
        if (!isMountedRef.current || !mapContainerRef.current || mapInstanceRef.current) return;

        const gMaps = (window as any).google?.maps;
        if (!gMaps) throw new Error("API do Google Maps falhou.");

        let MapConstructor = gMaps.Map;
        if (gMaps.importLibrary) {
            try {
                const { Map } = await gMaps.importLibrary("maps");
                MapConstructor = Map;
            } catch (e) { console.warn("Fallback Map constructor"); }
        }

        const mapOptions: any = {
            center: { lat: -23.5505, lng: -46.6333 }, 
            zoom: 17, 
            heading: 0,
            tilt: 67.5, 
            disableDefaultUI: true, 
            gestureHandling: 'greedy',
            backgroundColor: '#0f172a',
            mapTypeId: 'hybrid',
            // Otimizações de renderização
            isFractionalZoomEnabled: true,
        };

        if (MAP_ID && MAP_ID.trim() !== '') {
            mapOptions.mapId = MAP_ID;
        }

        const map = new MapConstructor(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;

        console.log('[GoogleMaps3D] Map instance created successfully');

        // Setup Listeners for Telemetry
        const listeners = [
            map.addListener('center_changed', updateTelemetry),
            map.addListener('zoom_changed', updateTelemetry),
            map.addListener('heading_changed', updateTelemetry),
            map.addListener('tilt_changed', updateTelemetry),
        ];

        // Wait for the map to be fully loaded before reading telemetry
        google.maps.event.addListenerOnce(map, 'idle', () => {
            console.log('[GoogleMaps3D] Map is idle and ready');
            updateTelemetry(); // Initial read after map is ready
        });

        setIsLoading(false);

        // Listeners to stop orbit on interaction
        const stopOrbit = () => { isUserInteractingRef.current = true; };
        const orbitListeners = [
            map.addListener('mousedown', stopOrbit),
            map.addListener('dragstart', stopOrbit),
            map.addListener('zoom_changed', stopOrbit)
        ];

      } catch (e: any) {
        console.error("Erro mapa:", e);
        if (isMountedRef.current && !error) {
          setError(`Erro: ${e.message}`);
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      isMountedRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !locationQuery || isLoading || error) return;
    if (locationQuery === previousLocationRef.current) return;
    previousLocationRef.current = locationQuery;

    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address: locationQuery }, (results: any, status: string) => {
        if (status === 'OK' && results[0]) {
            const targetLoc = results[0].geometry.location;
            performWarpAndLand(mapInstanceRef.current, targetLoc);
        }
    });

  }, [locationQuery, isLoading, error]);

  const getOverlayOpacity = () => {
      if (warpStage === 'idle') return 0;
      if (warpStage === 'revealing') return 0; 
      return 1;
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', bgcolor: '#0f172a', overflow: 'hidden' }}>
      
      {/* MAP CONTAINER */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* --- CINEMATIC HUD OVERLAY --- */}
      <Box 
        sx={{ 
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
            display: isWarping ? 'none' : 'block' // Hide HUD during warp for cleaner transition
        }}
      >
          {/* VIGNETTE & SCANLINES */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(15,23,42,0.8)_100%)] opacity-80 mix-blend-multiply" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[2] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20" />
          
          {/* TOP RIGHT TELEMETRY */}
          <Box sx={{ position: 'absolute', top: 24, left: 24, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
             <Box display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ width: 8, height: 8, bgcolor: '#ef4444', borderRadius: '50%', boxShadow: '0 0 8px #ef4444', animation: 'pulse 2s infinite' }} />
                <Typography variant="overline" sx={{ color: '#ef4444', fontWeight: 800, letterSpacing: '0.2em', fontSize: '0.7rem' }}>
                    AO VIVO
                </Typography>
             </Box>
             <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem' }}>
                SAT FEED: B-72 / VECTOR
             </Typography>
          </Box>

          {/* BOTTOM LEFT TELEMETRY */}
          <Box sx={{ position: 'absolute', bottom: 32, left: 32, borderLeft: '2px solid rgba(255,255,255,0.2)', pl: 2 }}>
             <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#22d3ee', fontSize: '0.7rem', fontWeight: 700 }}>
                    LAT: {telemetry.lat}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#22d3ee', fontSize: '0.7rem', fontWeight: 700 }}>
                    LNG: {telemetry.lng}
                </Typography>
                <Box display="flex" gap={2} mt={1}>
                     <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                        HDG: {telemetry.heading}°
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                        TLT: {telemetry.tilt}°
                    </Typography>
                     <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                        Z: {telemetry.zoom}
                    </Typography>
                </Box>
             </Stack>
          </Box>

           {/* CORNER DECORATIONS */}
           <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-white/10 rounded-tr-xl"></div>
           <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-white/10 rounded-br-xl"></div>
      </Box>
      
      {/* WARP OVERLAY */}
      <Box 
        sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            bgcolor: '#0f172a',
            opacity: getOverlayOpacity(), 
            transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1)', 
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backdropFilter: 'blur(10px)' // Efeito vidro fosco
        }}
      >
          {(warpStage === 'masking' || warpStage === 'teleporting') && (
            <>
                <div className="relative">
                    {/* Animated Radar Rings */}
                    <div className="absolute inset-0 bg-rose-500/20 rounded-full animate-ping"></div>
                    <div className="absolute -inset-4 border border-rose-500/10 rounded-full animate-[spin_4s_linear_infinite]"></div>
                    <div className="absolute -inset-8 border border-rose-500/5 rounded-full animate-[spin_8s_linear_infinite_reverse]"></div>
                    
                    <div className="relative z-10 p-4 bg-slate-900/50 rounded-full border border-rose-500/30 backdrop-blur-md">
                        <CircularProgress size={40} sx={{ color: '#f43f5e' }} thickness={2} />
                    </div>
                </div>
                <Stack alignItems="center" spacing={0.5}>
                    <Typography 
                        variant="overline" 
                        sx={{ 
                            color: '#f43f5e', 
                            letterSpacing: '0.3em', 
                            fontWeight: 'bold',
                            animation: 'pulse 1.5s infinite',
                            textShadow: '0 0 10px rgba(244, 63, 94, 0.5)'
                        }}
                    >
                        ACESSANDO SATÉLITE
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                        TRIANGULANDO COORDENADAS...
                    </Typography>
                </Stack>
            </>
          )}
      </Box>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}
      </style>

      {isLoading && !error && (
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {error && (
        <Box sx={{ 
            position: 'absolute', inset: 0, zIndex: 20,
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            p: 4, textAlign: 'center'
        }}>
           <Typography variant="body1" color="#f43f5e">
             {error}
           </Typography>
        </Box>
      )}
    </Box>
  );
});

export default GoogleMaps3DView;