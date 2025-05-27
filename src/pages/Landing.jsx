const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col px-4 pt-8 pb-8">
      {}
      <header className="w-full max-w-6xl mx-auto flex justify-between items-center mb-16 px-4 md:px-0">
        {}
        <h1 className="text-4xl font-extrabold text-[var(--color-button-primary)]">SignSeal</h1>
        <nav className="space-x-6">
          {}
          <a
            href="/SignatureApp/login"
            className="text-gray-800 dark:text-white 
                         hover:text-[var(--color-text-accent-light)] dark:hover:text-[var(--color-text-accent-light)] 
                         transition duration-300 ease-in-out"
          >
            Login
          </a>
          <a
            href="/SignatureApp/register"
            className="bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] 
                         text-white font-semibold py-2 px-5 rounded-full shadow-lg 
                         transition duration-300 ease-in-out transform hover:scale-105"
          >
            Register
          </a>
        </nav>
      </header>

      {}
      <main className="flex-grow flex flex-col justify-center items-center text-center max-w-3xl mx-auto px-4">
        {}
        <h2
          className="text-5xl md:text-6xl font-bold leading-tight mb-6 animate-fade-in-up 
                         text-gray-800 dark:text-white"
        >
          Secure. Fast. <span className="text-[var(--color-button-primary)]">Paperless.</span>
        </h2>
        {}
        <p className="text-xl text-gray-600 mb-10 leading-relaxed animate-fade-in-up delay-200 dark:text-gray-300">
          Digitize your signature workflow. Upload, sign, and archive documents effortlessly with
          advanced security.
        </p>
        <a
          href="/SignatureApp/register"
          className="inline-block bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] 
                       text-white font-bold py-3 px-8 rounded-full shadow-xl 
                       transition duration-300 ease-in-out transform hover:scale-105 animate-fade-in-up delay-400"
        >
          Get Started Today
        </a>
      </main>

      {}
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        .delay-200 {
          animation-delay: 0.2s;
        }
        .delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </div>
  );
};

export default Landing;
