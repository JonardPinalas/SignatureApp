// src/App.jsx
import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { supabase } from "./utils/supabaseClient";
import AppRoutes from "./AppRoutes"; // We'll create this component below

function App() {
  const basename = "/SignatureApp/";
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px", fontSize: "1.2em", color: "#666" }}>
        Loading application...
      </div>
    );
  }

  return (
    <Router basename={basename}>
      <AppRoutes session={session} />
    </Router>
  );
}

export default App;
