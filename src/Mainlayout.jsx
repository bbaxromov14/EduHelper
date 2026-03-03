import React from 'react'
import Navbar from './Components/Navbar/Navbar'
import Footer from './Components/Footer/Footer'
import { Outlet } from 'react-router-dom'
import GlobalNotification from './Components/GlobalNotification/GlobalNotification'

const Mainlayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <GlobalNotification/>   
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default Mainlayout