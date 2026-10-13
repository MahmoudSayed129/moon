const Header = () => {
  return (
    <header className="bg-gradient-to-r from-[#0a0a0a] via-[#151515] to-[#222222] text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <h1>
              <img src="/ravin-logo-light.png" alt="Ravin" className="h-10 w-auto" />
            </h1>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-neutral-200">
              رافين ستور - نظام إدارة المحل
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
