'use client';

import { useState } from 'react';

export default function SocialDinnerRow({ person }) {
  const [expanded, setExpanded] = useState(false);

  // Format the date
  const purchaseDate = new Date(person.purchase_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <>
      <tr 
        className="hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td>
          <div className="font-medium text-[13px]">{person.name}</div>
        </td>
        <td>
          <div className="text-[13px] text-[var(--muted)]">{person.email}</div>
        </td>
        <td>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#0071e3]/10 text-[#0071e3]">
            {person.conference}
          </span>
        </td>
        <td>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            person.payment_status === 'paid' ? 'bg-[#34c759]/10 text-[#34c759]' :
            person.payment_status === 'pending' ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]' :
            'bg-[#ff3b30]/10 text-[#ff3b30]'
          }`}>
            {person.payment_status || 'Unknown'}
          </span>
        </td>
        <td>
          <div className="text-[13px] font-medium">{person.dietary_preference}</div>
        </td>
        <td className="text-right text-[var(--muted)]">
          <svg 
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`inline-block transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </td>
      </tr>
      
      {expanded && (
        <tr className="bg-white/[0.01]">
          <td colSpan="6" className="p-0 border-t-0">
            <div className="px-4 py-3 text-[12px] text-[var(--muted)] grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/[0.04]">
              <div>
                <span className="uppercase text-[10px] font-bold block mb-1 tracking-wider opacity-60">Price Paid</span>
                <span className="font-medium text-black">{person.amount_paid} {person.currency}</span>
              </div>
              <div>
                <span className="uppercase text-[10px] font-bold block mb-1 tracking-wider opacity-60">Invoice Code</span>
                <span className="font-medium text-black">{person.invoice_code || 'N/A'}</span>
              </div>
              <div>
                <span className="uppercase text-[10px] font-bold block mb-1 tracking-wider opacity-60">Purchase Date</span>
                <span className="font-medium text-black">{purchaseDate}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
