// frontend/src/pages/HomePage.jsx

import React from "react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300"
      style={{
        backgroundColor: "var(--brand-bg-light)",
        backgroundImage:
          "linear-gradient(to bottom right, var(--brand-bg-light), var(--brand-bg-dark))",
        color: "var(--brand-text)",
      }}
    >
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto flex justify-between items-center mb-16 px-4 md:px-0 z-10">
        <h1
          className="text-4xl font-extrabold drop-shadow-lg"
          style={{ color: "var(--color-button-primary)" }}
        >
          SignSeal
        </h1>
        <nav className="space-x-6">
          <Link
            to="/login"
            className="transition duration-300 ease-in-out font-medium"
            style={{ color: "var(--brand-text)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text-accent-light)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--brand-text)")}
          >
            Login
          </Link>
          <Link
            to="/register"
            className="py-2 px-5 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 font-semibold"
            style={{ backgroundColor: "var(--color-button-primary)", color: "white" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-button-primary-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-button-primary)")
            }
          >
            Register
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col justify-center items-center text-center max-w-4xl mx-auto px-4 z-0 relative">
        {/* Subtle background glow for main section */}
        <div
          className="absolute -top-16 -left-16 w-64 h-64 rounded-full mix-blend-multiply filter blur-xl animate-blob -z-10"
          style={{ backgroundColor: "var(--color-button-primary)", opacity: 0.1 }}
        ></div>
        <div
          className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000 -z-10"
          style={{ backgroundColor: "var(--color-button-primary)", opacity: 0.1 }}
        ></div>

        <h2
          className="text-6xl md:text-7xl font-extrabold leading-tight mb-6 animate-fade-in-up drop-shadow-md"
          style={{ color: "var(--brand-heading)" }}
        >
          Signature Simplified.
          <br /> <span style={{ color: "var(--color-button-primary)" }}>Future Forward.</span>
        </h2>
        <p
          className="text-xl md:text-2xl mb-10 leading-relaxed animate-fade-in-up delay-200"
          style={{ color: "var(--brand-text-light)" }}
        >
          Streamline your workflow with secure, legally binding electronic signatures. Fast,
          intuitive, and designed for the modern era.
        </p>
        <Link
          to="/register"
          className="inline-block py-3 px-8 rounded-full shadow-xl transition duration-300 ease-in-out transform hover:scale-105 animate-fade-in-up delay-400 font-bold"
          style={{ backgroundColor: "var(--color-button-primary)", color: "white" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--color-button-primary-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--color-button-primary)")
          }
        >
          Get Started Free
        </Link>
      </main>

      {/* Feature Highlights */}
      <section className="mt-20 w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 px-4 z-10">
        <div
          className="p-8 rounded-xl shadow-2xl flex flex-col items-center text-center border transform hover:scale-105 transition-transform duration-300"
          style={{ backgroundColor: "var(--brand-card)", borderColor: "var(--brand-border)" }}
        >
          <div
            className="text-6xl mb-4 transform rotate-3 hover:rotate-0 transition-transform duration-300"
            style={{ color: "var(--color-button-primary)" }}
          >
            ✍️
          </div>
          <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--brand-heading)" }}>
            Effortless Signing
          </h3>
          <p style={{ color: "var(--brand-text-light)" }}>
            Sign documents from anywhere, on any device. Simple and intuitive process.
          </p>
        </div>

        <div
          className="p-8 rounded-xl shadow-2xl flex flex-col items-center text-center border transform hover:scale-105 transition-transform duration-300"
          style={{ backgroundColor: "var(--brand-card)", borderColor: "var(--brand-border)" }}
        >
          <div
            className="text-6xl mb-4 transform -rotate-3 hover:rotate-0 transition-transform duration-300"
            style={{ color: "var(--color-button-primary)" }}
          >
            🔒
          </div>
          <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--brand-heading)" }}>
            Robust Security
          </h3>
          <p style={{ color: "var(--brand-text-light)" }}>
            Your data is protected with advanced encryption, audit trails, and compliance.
          </p>
        </div>

        <div
          className="p-8 rounded-xl shadow-2xl flex flex-col items-center text-center border transform hover:scale-105 transition-transform duration-300"
          style={{ backgroundColor: "var(--brand-card)", borderColor: "var(--brand-border)" }}
        >
          <div
            className="text-6xl mb-4 transform rotate-3 hover:rotate-0 transition-transform duration-300"
            style={{ color: "var(--color-button-primary)" }}
          >
            ⚡
          </div>
          <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--brand-heading)" }}>
            Blazing Fast
          </h3>
          <p style={{ color: "var(--brand-text-light)" }}>
            Streamline approvals and get documents signed in minutes, not days.
          </p>
        </div>
      </section>

      <section
        className="mt-12 text-center text-sm z-10"
        style={{ color: "var(--brand-text-light)" }}
      >
        <p>Powered by Vite & modern web technologies for a seamless experience.</p>
      </section>
    </div>
  );
};

export default Landing;
