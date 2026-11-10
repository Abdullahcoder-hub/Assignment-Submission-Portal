import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0B1F3A] text-[#E3DCCF]/80 border-t border-[#102744] py-6 px-4 mt-auto shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs sm:text-sm">
        <div>
          <p className="font-semibold text-[#FFFDF7]">
            © 2026 <span className="text-[#D6A84F] font-bold">The Developers Hub</span>. All rights reserved.
          </p>
          <p className="text-[#E3DCCF] font-medium text-xs mt-1 tracking-wide">
            Assignments, Quizzes & Results
          </p>
        </div>
        
        <div className="flex flex-col items-center sm:items-end text-xs">
          <span className="text-[#E3DCCF]/90 font-medium">
            Developed by <span className="text-[#D6A84F] font-semibold">Abdullah Waqar</span>
          </span>
          <span className="text-[#E3DCCF]/90 font-medium mt-0.5">
            <span className="text-[#D6A84F] font-semibold">Naeem Ilyas</span>
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
