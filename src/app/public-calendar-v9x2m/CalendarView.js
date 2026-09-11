'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Link as LinkIcon, Calendar } from 'lucide-react';
import Link from 'next/link';

// Helpers
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const isDateInRange = (date, startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) return false;
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const current = new Date(date);
  
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  current.setHours(0, 0, 0, 0);

  return current >= start && current <= end;
};

const isStartDate = (date, startDateStr) => {
  if (!startDateStr) return false;
  const start = new Date(startDateStr);
  const current = new Date(date);
  start.setHours(0,0,0,0);
  current.setHours(0,0,0,0);
  return start.getTime() === current.getTime();
}

// Convert hex to rgba for better cross-browser safe opacity
const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(0, 122, 255, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 122;
  const b = parseInt(hex.slice(5, 7), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function CalendarView({ initialConferences = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1; // Start on Monday

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const activeConferences = useMemo(() => {
     return initialConferences.filter(conf => {
        if (!conf.start_date || !conf.end_date) return false;
        const start = new Date(conf.start_date);
        const end = new Date(conf.end_date);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        return start <= monthEnd && end >= monthStart;
     });
  }, [initialConferences, currentMonth, currentYear]);

  const renderCells = () => {
    const cells = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // Empty cells before start of month
    for (let i = 0; i < firstDayAdjusted; i++) {
      cells.push(<div key={`empty-${i}`} className="bg-slate-50/50 border-r border-b border-slate-100 min-h-[140px]"></div>);
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(currentYear, currentMonth, day);
      cellDate.setHours(0,0,0,0);
      const isToday = cellDate.getTime() === today.getTime();

      const daysEvents = activeConferences.filter(conf => isDateInRange(cellDate, conf.start_date, conf.end_date));

      cells.push(
        <div key={`day-${day}`} className={`border-r border-b border-slate-100 min-h-[140px] p-2 relative flex flex-col gap-1.5 transition-colors hover:bg-slate-50/30 ${isToday ? 'bg-indigo-50/20' : ''}`}>
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}`}>
              {day}
            </span>
          </div>
          
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1">
            {daysEvents.map(conf => {
              const isStart = isStartDate(cellDate, conf.start_date);
              const bgColor = conf.accent_color || '#007aff';
              const textColor = '#ffffff'; // White text on solid background

              return (
                <div 
                  key={conf.id} 
                  title={`${conf.name}\nDates: ${conf.start_date} to ${conf.end_date}`}
                  className="px-2 py-1.5 text-[10px] font-bold rounded-md truncate transition-all hover:-translate-y-[1px] cursor-pointer shadow-sm relative group"
                  style={{ 
                    backgroundColor: bgColor,
                    color: textColor
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{conf.acronym}</span>
                    <a href={`https://www.nanoge.org/${conf.acronym}/home`} target="_blank" rel="noopener noreferrer" title="View Conference Page" className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/50 rounded-full hover:bg-white text-slate-800">
                      <LinkIcon className="w-3 h-3" />
                    </a>
                  </div>
                  {isStart && <div className="font-medium text-[9px] truncate opacity-70 mt-0.5 leading-tight">{conf.name}</div>}
                  
                  {/* Deadline Indicators (if any deadlines fall on this day) */}
                  {conf.deadlines && Object.entries(conf.deadlines).map(([key, dl]) => {
                     if (!dl || !dl.$date) return null;
                     const dlDate = new Date(dl.$date);
                     dlDate.setHours(0,0,0,0);
                     if (dlDate.getTime() === cellDate.getTime()) {
                         return (
                             <div key={key} className="mt-1 inline-flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider w-max">
                                 🚨 {key} deadline
                             </div>
                         )
                     }
                     return null;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Fill remaining cells
    const totalCells = firstDayAdjusted + daysInMonth;
    const remainingCells = 42 - totalCells; // Always 6 rows
    for (let i = 0; i < remainingCells; i++) {
      cells.push(<div key={`empty-end-${i}`} className="bg-slate-50/50 border-r border-b border-slate-100 min-h-[140px]"></div>);
    }

    return cells;
  };

  return (
    <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col h-full min-h-[700px] animate-in fade-in zoom-in-95 duration-400">
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #cbd5e1; }
      `}} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-500" />
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button onClick={goToToday} className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all shadow-sm">
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shadow-sm bg-white border border-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={nextMonth} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shadow-sm bg-white border border-slate-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col bg-slate-50/20">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          {dayNames.map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-white">
           {renderCells()}
        </div>
      </div>
    </div>
  )
}
