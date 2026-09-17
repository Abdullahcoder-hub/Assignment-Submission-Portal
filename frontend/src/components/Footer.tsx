import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-900 text-slate-400 border-t border-slate-800 py-6 px-4 mt-auto shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs sm:text-sm">
        <div>
          <p className="font-semibold text-slate-200">
            © 2026 <span className="text-white font-bold">The Developers Hub</span>. All rights reserved.
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            Assignment & Project Submission Portal
          </p>
        </div>
        
        <div className="flex flex-col items-center sm:items-end text-xs">
          <span className="text-slate-300 font-medium">
            Developed by <span className="text-blue-400 font-semibold">Abdullah Waqar</span>
          </span>
          <span className="text-slate-300 font-medium mt-0.5">
            <span className="text-blue-400 font-semibold">Naeem Ilyas</span>
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
