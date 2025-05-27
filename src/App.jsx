import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-4">Digital Signature Portal</h1>
      <p className="text-gray-700 max-w-xl text-center mb-8">
        Upload documents, request signatures, and manage digital signing workflows easily.
      </p>
      <button className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition">
        Get Started
      </button>
    </div>
  )
}


export default App
