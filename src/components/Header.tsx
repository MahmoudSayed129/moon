const Header = () => {
  return (
    <header className="bg-gradient-to-r from-[#13091d] via-[#3f1169] to-[#7b22cc] text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black tracking-[0.35em] text-[#f3e9ff] drop-shadow-[0_0_18px_rgba(192,132,252,0.45)]">
              MO<span className="text-[#efe5ff]">☾</span>N
            </h1>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-[#f4eefe] backdrop-blur">
              مون ستور - نظام إدارة المحل
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
