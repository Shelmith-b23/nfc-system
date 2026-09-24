import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Wifi, ShieldCheck, Church } from 'lucide-react';

interface NfcCardGraphicProps {
  cardNumber?: string;
  participantName?: string;
  participantNumber?: string;
  parishGroup?: string;
  status?: string;
  flip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const NfcCardGraphic: React.FC<NfcCardGraphicProps> = ({
  cardNumber = 'BSC-CARD-000124',
  participantName = 'Shelmith Wambui',
  participantNumber = 'BSC-000124',
  parishGroup = 'YSC Member',
  status = 'ACTIVE',
  flip = false,
  size = 'md',
}) => {
  const [isFlipped, setIsFlipped] = useState(flip);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setIsFlipped(flip);
  }, [flip]);

  useEffect(() => {
    const qrPayload = `https://events.blessedsacramentcatholichurch.com/verify/${participantNumber}`;
    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#221F1F',
        light: '#FFFFFF',
      },
    }).then(setQrDataUrl).catch(console.error);
  }, [participantNumber]);

  const scaleClasses = {
    sm: 'w-[280px] h-[175px] text-xs',
    md: 'w-[360px] h-[225px] text-sm',
    lg: 'w-[420px] h-[262px] text-base',
  }[size];

  return (
    <div
      id={`nfc-card-${cardNumber}`}
      onClick={() => setIsFlipped(!isFlipped)}
      className={`relative cursor-pointer transition-transform duration-500 [transform-style:preserve-3d] select-none ${scaleClasses} rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300`}
      title="Click to flip card between Front and Back"
    >
      {/* Front Face */}
      <div
        className={`absolute inset-0 w-full h-full rounded-2xl p-5 flex flex-col justify-between overflow-hidden border border-[#D4AF37]/50 [backface-visibility:hidden] transition-opacity duration-300 ${
          isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          background: 'linear-gradient(135deg, #6B1D2F 0%, #801B2E 50%, #4A121E 100%)',
          color: '#FFFFFF',
        }}
      >
        {/* Subtle watermark background texture */}
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <Church className="w-56 h-56 text-[#D4AF37]" />
        </div>

        {/* Card Header */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]"></span>
              <p className="font-serif tracking-widest text-[11px] font-bold uppercase text-[#EAD098]">
                Blessed Sacrament Catholic Parish
              </p>
            </div>
            <p className="text-[10px] text-white/70 tracking-wider pl-4">Buru-Phase III, Mumias Road, Nairobi</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 border border-[#D4AF37]/40">
            <Wifi className="w-3.5 h-3.5 text-[#EAD098] rotate-90" />
            <span className="text-[10px] font-mono tracking-widest font-semibold text-[#EAD098]">NFC</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-auto relative z-10">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-[#EAD098] uppercase">
            Parish Event Identification Card
          </p>
          <h3 className="font-serif text-lg md:text-xl font-bold tracking-wide text-white drop-shadow-sm mt-0.5">
            {participantName}
          </h3>
          <p className="text-xs text-[#EAD098] font-medium mt-0.5">{parishGroup}</p>
        </div>

        {/* Card Footer */}
        <div className="flex items-end justify-between relative z-10 pt-2 border-t border-white/15">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-white/60 block">Participant ID</span>
            <span className="font-mono text-xs md:text-sm font-bold tracking-wider text-white">
              {participantNumber}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-white/60 block">Card Serial</span>
            <span className="font-mono text-[11px] text-[#EAD098] font-medium">{cardNumber}</span>
          </div>
        </div>

        {/* Status tag */}
        {status !== 'ACTIVE' && (
          <div className="absolute top-3 right-20 z-20 px-2 py-0.5 rounded bg-red-600/90 text-[10px] font-bold text-white uppercase tracking-wider shadow">
            {status}
          </div>
        )}
      </div>

      {/* Back Face */}
      <div
        className={`absolute inset-0 w-full h-full rounded-2xl p-5 flex flex-col justify-between overflow-hidden border border-[#D4AF37]/40 bg-[#FAF7F2] text-[#221F1F] [backface-visibility:hidden] transition-opacity duration-300 ${
          isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#221F1F]/10 pb-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#801B2E]" />
            <span className="font-serif text-xs font-bold text-[#801B2E] tracking-wider uppercase">
              Tap To Check In
            </span>
          </div>
          <span className="font-mono text-[11px] text-gray-500 font-semibold">{cardNumber}</span>
        </div>

        <div className="flex items-center justify-center gap-4 py-1">
          {qrDataUrl && (
            <div className="bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
              <img src={qrDataUrl} alt="Participant QR Code" className="w-20 h-20 rounded" />
            </div>
          )}
          <div className="text-left space-y-1">
            <span className="text-[10px] text-gray-500 block uppercase tracking-wider">Passholder</span>
            <p className="text-xs font-bold text-gray-900 leading-tight">{participantName}</p>
            <p className="font-mono text-xs font-semibold text-[#801B2E]">{participantNumber}</p>
            <span className="inline-block text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
              Encrypted NFC Token
            </span>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-[#221F1F]/10">
          <p className="text-[9px] text-gray-600 font-medium leading-tight">
            If found, please return to Blessed Sacrament Catholic Parish Office
          </p>
          <p className="text-[8px] text-gray-400 mt-0.5">Buru-Phase III, Mumias Road, Nairobi • For official use only</p>
        </div>
      </div>
    </div>
  );
};
