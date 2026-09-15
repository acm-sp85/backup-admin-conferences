'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function PrintButton({ filename = 'certificate.pdf' }) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('certificate-content');
            
            if (!element) {
                window.print();
                return;
            }
            
            const opt = {
                margin: 0,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    letterRendering: true,
                    onclone: (clonedDoc) => {
                        const el = clonedDoc.getElementById('certificate-content');
                        if (el) {
                            el.style.marginBottom = '0';
                            el.style.pageBreakAfter = 'auto';
                            el.style.boxShadow = 'none';
                        }
                    }
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().from(element).set(opt).save();
        } catch (error) {
            console.error('Error generating PDF:', error);
            window.print();
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <button 
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Download PDF'}
        </button>
    );
}
