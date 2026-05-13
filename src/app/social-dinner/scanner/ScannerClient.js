'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { validateTicket } from '../../actions/social-dinner';
import { CheckCircle2, XCircle, Camera, RefreshCw, User, Utensils } from 'lucide-react';

export default function ScannerClient() {
    const [scanResult, setScanResult] = useState(null);
    const [isScanning, setIsScanning] = useState(true);
    const [lastToken, setLastToken] = useState(null);
    const scannerRef = useRef(null);
    const [isLibLoaded, setIsLibLoaded] = useState(false);

    const initScanner = () => {
        if (!window.Html5QrcodeScanner || scannerRef.current) return;

        const scanner = new window.Html5QrcodeScanner("reader", { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment"
            },
            rememberLastUsedCamera: true
        });

        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
    };

    useEffect(() => {
        if (isLibLoaded) {
            initScanner();
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
                scannerRef.current = null;
            }
        };
    }, [isLibLoaded]);

    const resetScanner = () => {
        setScanResult(null);
        setLastToken(null);
        setIsScanning(true);
        // Resume scanning
        if (scannerRef.current) {
            scannerRef.current.resume();
        }
    };

    async function onScanSuccess(decodedText) {
        if (decodedText === lastToken) return;
        
        // PAUSE the scanner immediately to stop CPU and Network load
        if (scannerRef.current) {
            try {
                scannerRef.current.pause();
            } catch (e) {
                console.error("Pause failed", e);
            }
        }
        
        let token = decodedText;
        if (decodedText.includes('/checkin/')) {
            token = decodedText.split('/checkin/').pop();
        } else if (decodedText.includes('/qr/')) {
            token = decodedText.split('/qr/').pop();
        }

        setLastToken(decodedText);
        setIsScanning(false);
        setScanResult({ loading: true });

        try {
            const result = await validateTicket(token);
            setScanResult(result);
        } catch (error) {
            setScanResult({ success: false, error: 'Network Error' });
        }
    }

    function onScanFailure(error) {}

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <Script 
                src="https://unpkg.com/html5-qrcode" 
                strategy="lazyOnload"
                onLoad={() => setIsLibLoaded(true)}
            />
            <style>{`
                #reader { border: none !important; }
                #reader__dashboard_section_csr button {
                    background-color: #0f172a !important;
                    color: white !important;
                    padding: 10px 20px !important;
                    border-radius: 12px !important;
                    border: none !important;
                    font-weight: bold !important;
                    font-size: 14px !important;
                    cursor: pointer !important;
                    margin-top: 10px !important;
                }
                #reader__dashboard_section_csr button:hover {
                    background-color: #000 !important;
                }
                #reader__status_span {
                    color: white !important;
                    font-weight: bold !important;
                    display: block !important;
                    margin-bottom: 10px !important;
                }
                #reader select {
                    padding: 8px !important;
                    border-radius: 8px !important;
                    border: 1px solid #e2e8f0 !important;
                    margin-bottom: 10px !important;
                    width: 100% !important;
                    background: white !important;
                    color: #0f172a !important;
                }
                #reader img {
                    display: none !important;
                }
            `}</style>
            <header className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-slate-900">Dinner Check-in</h2>
                <p className="text-slate-500 text-sm mt-1">High-speed continuous scanner</p>
            </header>

            <div className="relative aspect-square max-w-md mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900">
                <div id="reader" className="w-full h-full"></div>

                {scanResult && (
                    <div 
                        onClick={resetScanner}
                        className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200 cursor-pointer ${
                            scanResult.loading ? 'bg-slate-900/80' :
                            scanResult.success && scanResult.paymentStatus === 'paid' ? 'bg-green-600/95' : 
                            scanResult.success && scanResult.paymentStatus !== 'paid' ? 'bg-amber-500/95' : 
                            'bg-red-600/95'
                        }`}
                    >
                        {scanResult.loading ? (
                            <RefreshCw className="w-16 h-16 text-white animate-spin mb-4" />
                        ) : scanResult.success ? (
                            <>
                                {scanResult.paymentStatus === 'paid' ? (
                                    <CheckCircle2 className="w-24 h-24 text-white mb-6 animate-bounce" />
                                ) : (
                                    <RefreshCw className="w-24 h-24 text-white mb-6 animate-spin-slow" />
                                )}
                                
                                <h3 className="text-3xl font-black text-white mb-2">
                                    {scanResult.paymentStatus === 'paid' ? 'VALID TICKET' : 'PAYMENT INCIDENCE'}
                                </h3>
                                
                                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 w-full">
                                    <div className="flex items-center justify-center gap-2 text-white font-bold text-xl mb-1">
                                        <User className="w-5 h-5" />
                                        {scanResult.attendee}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-center gap-2 text-white/90 font-black text-lg uppercase tracking-widest">
                                            <Utensils className="w-4 h-4" />
                                            {scanResult.dietary}
                                        </div>
                                        {scanResult.paymentStatus !== 'paid' && (
                                            <div className="mt-2 px-3 py-1 bg-white/30 rounded-lg text-white font-black text-xs uppercase tracking-tighter">
                                                STATUS: {scanResult.paymentStatus || 'UNKNOWN'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="mt-8 flex flex-col items-center gap-2 animate-pulse">
                                    <div className="px-6 py-2 bg-white/10 rounded-full border border-white/20 text-white font-bold text-sm tracking-widest uppercase">
                                        Tap screen for next scan
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <XCircle className="w-24 h-24 text-white mb-6 animate-pulse" />
                                <h3 className="text-3xl font-black text-white mb-2">INVALID</h3>
                                <p className="text-white/90 font-bold text-xl px-4 mb-8">{scanResult.error}</p>
                                
                                <div className="px-6 py-2 bg-white/10 rounded-full border border-white/20 text-white font-bold text-sm tracking-widest uppercase animate-pulse">
                                    Tap screen to try again
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isScanning && !scanResult && (
                    <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20 flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/50 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 text-slate-900">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-green-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Ready
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Device</div>
                    <div className="text-xs font-bold text-slate-700 truncate flex items-center justify-center gap-1.5">
                        <Camera className="w-3 h-3" />
                        Active
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dinner</div>
                    <div className="text-xs font-bold text-blue-600">Active</div>
                </div>
            </div>

            <p className="mt-8 text-center text-[10px] text-slate-400 font-medium px-12 leading-relaxed italic">
                Place the QR code inside the frame to scan. Success or failure will flash immediately. No page reload required.
            </p>
        </div>
    );
}
