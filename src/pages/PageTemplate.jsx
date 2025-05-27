// frontend/src/pages/PageTemplate.jsx

import React, { useState, useEffect } from "react";

const PageTemplate = () => {
  // Example state for data or loading status
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    // This runs once when the component mounts
    const fetchData = async () => {
      try {
        // --- Your data fetching logic goes here ---
        // Example: Fetch from a Supabase table
        // const { data: fetchedData, error } = await supabase.from('your_table').select('*');
        // if (error) throw error;
        // setData(fetchedData);

        // Example: Call an Edge Function
        // const response = await fetch('https://[your-project-ref].functions.supabase.co/your-function');
        // const result = await response.json();
        // setData(result);

        // Simulate fetching
        setTimeout(() => {
          setData({ message: "Hello from your new page!" });
          setLoading(false);
        }, 1000);
      } catch (err) {
        console.error("Error fetching data:", err);
        // Handle error display
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty array means run once on mount

  if (loading) {
    return <div className="p-4 text-center text-gray-600">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Your New Page Title</h1>
      <p className="text-lg text-gray-700 mb-4">Start building your page content here!</p>

      {/* Display fetched data (example) */}
      {data && (
        <div className="bg-gray-100 p-3 rounded text-sm mt-4">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      {/* Add buttons, forms, or other components below */}
      <button
        onClick={() => alert("Action performed!")}
        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
      >
        Perform Action
      </button>
    </div>
  );
};

export default PageTemplate;
