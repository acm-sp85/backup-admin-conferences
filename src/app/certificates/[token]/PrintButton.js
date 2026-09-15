'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function PrintButton({ filename = 'certificate.pdf' }) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const element = document.getElementById('certificate-content');
            
            if (!element) {
                window.print();
                return;
            }
            
            // Temporarily disable any box shadow or margins for the capture
            const originalShadow = element.style.boxShadow;
            const originalMargin = element.style.margin;
            element.style.boxShadow = 'none';
            element.style.margin = '0';
            
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true,
                scrollY: -window.scrollY // Fixes an issue where scrolling affects capture
            });
            
            // Restore original styles
            element.style.boxShadow = originalShadow;
            element.style.margin = originalMargin;

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            
            // Create a perfectly sized A4 PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Add the image exactly filling the first and only page
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            pdf.save(filename);
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
