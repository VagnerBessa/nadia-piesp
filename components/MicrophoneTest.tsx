import React, { useState } from 'react';

export const MicrophoneTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Clique no botão para testar o microfone');
  const [permissionState, setPermissionState] = useState<string>('unknown');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const testMicrophone = async () => {
    setStatus('Verificando suporte...');

    // Check browser support
    if (!navigator.mediaDevices) {
      setStatus('❌ navigator.mediaDevices não está disponível');
      return;
    }

    if (!navigator.mediaDevices.getUserMedia) {
      setStatus('❌ getUserMedia não está disponível');
      return;
    }

    setStatus('✓ Browser suporta getUserMedia');

    // Check permission state
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionState(permissionStatus.state);
        setStatus(`✓ Permissão de microfone: ${permissionStatus.state}`);
      }
    } catch (err) {
      console.log('Não foi possível verificar permissões:', err);
    }

    // Try to access microphone
    setStatus('Solicitando acesso ao microfone...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setStatus('✓ Acesso ao microfone concedido!');

      const audioTracks = stream.getAudioTracks();
      console.log('Audio tracks:', audioTracks);

      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        setStatus(`✓ Microfone detectado: ${track.label}`);

        // Create audio context to visualize audio level
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();

        // Stop after 10 seconds
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          setStatus('✓ Teste concluído');
          setAudioLevel(0);
        }, 10000);
      }
    } catch (err: any) {
      console.error('Erro ao acessar microfone:', err);
      setStatus(`❌ Erro: ${err.name} - ${err.message}`);
    }
  };

  return (
    <div className="p-6 bg-slate-800 rounded-lg border border-slate-700 max-w-md">
      <h3 className="text-xl font-bold text-white mb-4">Teste de Microfone</h3>

      <button
        onClick={testMicrophone}
        className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg mb-4"
      >
        Testar Microfone
      </button>

      <div className="space-y-2">
        <p className="text-slate-300 text-sm">{status}</p>
        {permissionState !== 'unknown' && (
          <p className="text-slate-400 text-xs">Estado da permissão: {permissionState}</p>
        )}
        {audioLevel > 0 && (
          <div className="mt-4">
            <p className="text-slate-400 text-xs mb-2">Nível de Áudio:</p>
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-100"
                style={{ width: `${Math.min(100, (audioLevel / 255) * 100)}%` }}
              />
            </div>
            <p className="text-slate-400 text-xs mt-1">
              {audioLevel > 10 ? '🎤 Som detectado!' : 'Silêncio'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-900 rounded text-xs text-slate-400">
        <p className="font-semibold mb-1">Instruções:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Clique no botão acima</li>
          <li>Permita o acesso ao microfone quando solicitado</li>
          <li>Fale para verificar se o som está sendo detectado</li>
          <li>Verifique o console (F12) para mais detalhes</li>
        </ul>
      </div>
    </div>
  );
};
