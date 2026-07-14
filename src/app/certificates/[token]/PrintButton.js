'use client';

import { Download } from 'lucide-react';

export default function PrintButton() {
    return (
        <button 
            type="button"
            onClick={() => {
                if (typeof window !== 'undefined') window.print();
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
            <Download className="w-4 h-4" />
            Download PDF
        </button>
    );
}
